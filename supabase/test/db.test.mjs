import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const db = new PGlite();
const migration = fs.readFileSync(process.argv[2], 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };
const q = async (sql, p) => (await db.query(sql, p)).rows;
const expectErr = async (fn, re, m) => {
  try { await fn(); ok(false, m + ' (no error)'); }
  catch (e) { ok(re.test(e.message), m + ' → ' + e.message); }
};

// --- Supabase stubs
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`);
await db.exec(migration);
console.log('Migration ran OK');

const as = async (uid) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false);`);
  if (uid) await db.exec('set role authenticated'); else await db.exec('set role anon');
};
const asSuper = () => db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);

// --- Users
await asSuper();
const [mom] = await q(`insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values ('mor@test.dk', '{"full_name":"Mor"}', now()) returning id`);
await q(`select public.make_admin('mor@test.dk')`);
// admin-created customer (phone booking) without login
const [walk] = await q(`insert into customers (full_name, phone, email) values ('Lise Telefon', '11111111', 'lise@test.dk') returning id`);
// Lise signs up later, unconfirmed first
const [lise] = await q(`insert into auth.users (email, raw_user_meta_data) values ('Lise@Test.dk', '{"full_name":"Lise L","phone":"22222222","photo_consent":true}') returning id`);
ok((await q(`select user_id from customers where id = $1`, [walk.id]))[0].user_id === null, 'unconfirmed signup does NOT link to existing customer');
await q(`update auth.users set email_confirmed_at = now() where id = $1`, [lise.id]);
const linked = (await q(`select * from customers where id = $1`, [walk.id]))[0];
ok(linked.user_id === lise.id && linked.full_name === 'Lise L' && linked.photo_consent === true, 'confirmed signup links to existing customer and updates info');
const [bo] = await q(`insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values ('bo@test.dk', '{"full_name":"Bo"}', now()) returning id`);
ok((await q(`select count(*)::int c from customers where user_id = $1`, [bo.id]))[0].c === 1, 'new confirmed user gets customer row');
ok((await q(`select count(*)::int c from customers where user_id = $1`, [mom.id]))[0].c === 0, 'admin has no customer row');

// --- Admin sets up services + open days
await as(mom.id);
ok((await q(`select public.is_admin() a`))[0].a === true, 'mom is admin');
const [gel] = await q(`insert into services (name, price, duration_min) values ('Gel hænder', 350, 60) returning id`);
const [lang] = await q(`insert into services (name, price, duration_min) values ('Nyt sæt', 550, 120) returning id`);
const tomorrow = (await q(`select ((now() at time zone 'Europe/Copenhagen')::date + 3)::text d`))[0].d;
const later = (await q(`select ((now() at time zone 'Europe/Copenhagen')::date + 10)::text d`))[0].d;
await q(`insert into open_days (day, start_time, end_time) values ($1, '10:00', '14:00'), ($2, '09:00', '12:00')`, [tomorrow, later]);
await q(`update settings set slot_step_min = 30`);

// --- Customer view
await as(bo.id);
let slots = await q(`select slot_start from available_slots($1)`, [gel.id]);
// 10:00..13:00 step 30 = 7 slots, + 09:00..11:00 = 5 slots => 12
ok(slots.length === 12, 'slots for 60 min service: ' + slots.length);
const firstLocal = (await q(`select to_char($1::timestamptz at time zone 'Europe/Copenhagen', 'HH24:MI') t`, [slots[0].slot_start]))[0].t;
ok(firstLocal === '10:00', 'first slot is 10:00 local time (' + firstLocal + ')');
const slots2 = await q(`select slot_start from available_slots($1)`, [lang.id]);
ok(slots2.length === 5 + 3, '120 min service slots: ' + slots2.length);
ok((await q(`select count(*)::int c from open_days`))[0].c === 0, 'customer cannot read open_days table directly');
await expectErr(() => q(`insert into bookings (customer_id, service_name, duration_min, starts_at, ends_at, status) values (my_customer_id(), 'x', 60, now()+interval '5 day', now()+interval '5 day 1 hour', 'confirmed')`), /row-level security/, 'customer cannot insert booking directly');

const s10 = slots[0].slot_start;
const b1 = (await q(`select request_booking($1, $2, 'Kaffe tak') id`, [gel.id, s10]))[0].id;
ok(!!b1, 'customer booked 10:00 (pending)');
slots = await q(`select slot_start from available_slots($1)`, [gel.id]);
ok(slots.length === 12 - 2, 'overlapping slots disappear (09:30 not on day, 10:00, 10:30 gone): ' + slots.length);
await expectErr(() => q(`select request_booking($1, $2)`, [gel.id, s10]), /ikke ledig/, 'double booking same slot refused');
const odd = (await q(`select ($1::timestamptz + interval '7 minutes') t`, [slots[0].slot_start]))[0].t;
await expectErr(() => q(`select request_booking($1, $2)`, [gel.id, odd]), /ikke ledig/, 'off-grid time refused');
await expectErr(() => q(`select request_booking($1, now() + interval '30 days')`, [gel.id]), /ikke ledig/, 'time on closed day refused');

// Lise cannot see Bo's booking
await as(lise.id);
ok((await q(`select count(*)::int c from bookings`))[0].c === 0, "Lise can't see Bo's booking");
ok((await q(`select count(*)::int c from customers`))[0].c === 1, 'Lise sees only her own customer row');
ok((await q(`select count(*)::int c from customer_private`))[0].c === 0, 'customer cannot read private notes');
await expectErr(() => q(`select cancel_my_booking($1)`, [b1]), /ikke fundet/, "Lise can't cancel Bo's booking");
await q(`select update_my_contact('Lise Larsen', '33333333', false)`);
ok((await q(`select full_name, phone from customers`))[0].phone === '33333333', 'customer updates own contact info');
await expectErr(() => q(`update customers set full_name = 'hack'`).then(r => { throw new Error('updated? ' + JSON.stringify(r)); }), /updated\?/, 'direct update silently affects nothing');
ok((await q(`select full_name from customers`))[0].full_name === 'Lise Larsen', 'direct update did not change row');

// anon
await as(null);
ok((await q(`select count(*)::int c from services`))[0].c === 2, 'anon can read active services (keep-alive)');
ok((await q(`select count(*)::int c from customers`).catch(() => [{ c: 0 }]))[0].c === 0, 'anon sees no customers');
await expectErr(() => q(`select request_booking($1, $2)`, [gel.id, s10]), /permission denied/, 'anon cannot call request_booking');

// --- Admin approval + pending cancel rules
await as(mom.id);
ok((await q(`select count(*)::int c from bookings where status='pending'`))[0].c === 1, 'admin sees pending request');
await q(`update bookings set status = 'confirmed' where id = $1`, [b1]);
await q(`insert into customer_private (customer_id, notes, preferences) values ($1, 'Følsom hud', 'Kan lide kaffe')`, [walk.id]);
// a confirmed booking < 24h ahead (admin made it)
const [soon] = await q(`insert into bookings (customer_id, service_name, price, duration_min, starts_at, ends_at, status, created_by)
  select id, 'Gel', 350, 60, now() + interval '5 hours', now() + interval '6 hours', 'confirmed', 'admin' from customers where user_id = $1 returning id`, [bo.id]);
await expectErr(() => q(`insert into bookings (customer_id, service_name, price, duration_min, starts_at, ends_at, status, created_by)
  select id, 'Gel', 350, 60, now() + interval '5 hours 30 minutes', now() + interval '6 hours 30 minutes', 'confirmed', 'admin' from customers where user_id = $1`, [bo.id]), /bookings_no_overlap|exclusion/, 'admin overlapping booking refused');

await as(bo.id);
await expectErr(() => q(`select cancel_my_booking($1)`, [soon.id]), /Ring til salonen/, 'cancel <24h refused');
await q(`select cancel_my_booking($1)`, [b1]);
ok((await q(`select status from bookings where id = $1`, [b1]))[0].status === 'cancelled', 'cancel >24h works');
slots = await q(`select slot_start from available_slots($1)`, [gel.id]);
ok(slots.length === 12, 'cancelled slot is free again: ' + slots.length);
// pending limit
const free = []; for (const s of slots) { const t = new Date(s.slot_start).getTime(); if (!free.length || t - new Date(free[free.length-1].slot_start).getTime() >= 3600e3) free.push(s); }
ok(free.length >= 4, 'found 4 non-overlapping slots');
for (const s of free.slice(0, 3)) await q(`select request_booking($1, $2)`, [gel.id, s.slot_start]);
await expectErr(() => q(`select request_booking($1, $2)`, [gel.id, free[3].slot_start]), /3 tider/, 'max 3 pending requests');

// --- expenses + stock
await as(mom.id);
await q(`select add_expense(current_date, 300, '6 gel top coats', 'Materialer', null, 'Gel top coat', 6, 'flasker')`);
let p = (await q(`select * from products where name = 'Gel top coat'`))[0];
ok(Number(p.qty) === 6 && Number(p.unit_cost) === 50, 'expense with new product adds stock (6, 50 kr/stk)');
const e2 = (await q(`select add_expense(current_date, 100, 'flere', 'Materialer', $1, null, 2) id`, [p.id]))[0].id;
p = (await q(`select * from products where id = $1`, [p.id]))[0];
ok(Number(p.qty) === 8, 'expense on existing product adds stock (8)');
await q(`select delete_expense($1)`, [e2]);
p = (await q(`select * from products where id = $1`, [p.id]))[0];
ok(Number(p.qty) === 6, 'deleting expense removes its stock again (6)');
await q(`select add_expense(current_date, 450, 'Husleje', 'Husleje')`);
ok((await q(`select count(*)::int c from expenses`))[0].c === 2, 'plain expense saved');
await as(bo.id);
await expectErr(() => q(`select add_expense(current_date, 1, 'x', 'y')`), /Kun admin/, 'customer cannot add expense');
ok((await q(`select count(*)::int c from products`))[0].c === 0, 'customer cannot see products');

// --- storage policies
await as(mom.id);
const boCid = (await q(`select id from customers where user_id = $1`, [bo.id]))[0].id;
await q(`insert into storage.objects (bucket_id, name) values ('photos', $1), ('photos', $2)`, [`${boCid}/${b1}/a.jpg`, `${walk.id}/x/b.jpg`]);
await q(`insert into booking_photos (booking_id, customer_id, path) values ($1, $2, $3)`, [b1, boCid, `${boCid}/${b1}/a.jpg`]);
await as(bo.id);
const objs = await q(`select name from storage.objects`);
ok(objs.length === 1 && objs[0].name.startsWith(boCid), 'customer sees only own photo files');
ok((await q(`select count(*)::int c from booking_photos`))[0].c === 1, 'customer sees own photo rows');
await expectErr(() => q(`insert into storage.objects (bucket_id, name) values ('photos', $1)`, [`${boCid}/z.jpg`]), /row-level security/, 'customer cannot upload');

// make_admin not callable by users
await expectErr(() => q(`select make_admin('bo@test.dk')`), /permission denied/, 'customer cannot call make_admin');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
