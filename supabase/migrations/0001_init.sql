-- =====================================================================
-- Just Nails by AK — database
-- Kør hele filen én gang i Supabase: SQL Editor → New query → Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Roller: hver login-bruger har en profil med rollen 'admin' eller 'customer'
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('admin', 'customer')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- Kunder. En kunde kan findes uden login (oprettet af admin, fx en telefonbooking).
-- Når kunden senere opretter login med samme e-mail, kobles de sammen.
-- ---------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null default '',
  phone text not null default '',
  email text,
  photo_consent boolean not null default false,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index customers_email_unique on public.customers (lower(email))
  where email is not null and email <> '';

create or replace function public.my_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.customers where user_id = auth.uid();
$$;

-- Noter og præferencer: kun admin kan se dem (kunden ser dem aldrig)
create table public.customer_private (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  notes text not null default '',
  preferences text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indstillinger (én række)
-- ---------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  salon_name text not null default 'Just Nails by AK',
  phone text not null default '',
  address text not null default '',
  cancel_hours int not null default 24 check (cancel_hours between 0 and 168),
  booking_days_ahead int not null default 60 check (booking_days_ahead between 1 and 365),
  min_notice_hours int not null default 12 check (min_notice_hours between 0 and 168),
  slot_step_min int not null default 15 check (slot_step_min in (10, 15, 20, 30, 60))
);
insert into public.settings (id) values (1);

-- ---------------------------------------------------------------------
-- Ydelser
-- ---------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null default 0 check (price >= 0),
  duration_min int not null check (duration_min between 5 and 600),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Åbne dage: kun de dage der står her kan kunderne booke
-- ---------------------------------------------------------------------
create table public.open_days (
  day date primary key,
  start_time time not null default '09:00',
  end_time time not null default '17:00',
  note text not null default '',
  check (end_time > start_time)
);

-- ---------------------------------------------------------------------
-- Bookinger
-- pending = venter på godkendelse, confirmed = bekræftet, declined = afvist,
-- cancelled = aflyst, completed = gennemført (tæller som indtægt)
-- ---------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  price numeric(10, 2) not null default 0 check (price >= 0),
  duration_min int not null check (duration_min > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed')),
  customer_note text not null default '',
  created_by text not null default 'customer' check (created_by in ('customer', 'admin')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- To aktive bookinger kan aldrig overlappe, heller ikke hvis to kunder trykker samtidig
  constraint bookings_no_overlap exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
    where (status in ('pending', 'confirmed', 'completed'))
);
create index bookings_starts_at_idx on public.bookings (starts_at);
create index bookings_customer_idx on public.bookings (customer_id);

-- Billeder af behandlinger (filerne ligger i Storage-mappen "photos")
create table public.booking_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  path text not null unique,
  created_at timestamptz not null default now()
);
create index booking_photos_booking_idx on public.booking_photos (booking_id);

-- ---------------------------------------------------------------------
-- Lager og udgifter
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '',
  qty numeric(10, 2) not null default 0 check (qty >= 0),
  unit text not null default 'stk',
  min_qty numeric(10, 2) not null default 0 check (min_qty >= 0),
  unit_cost numeric(10, 2) not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  amount numeric(10, 2) not null check (amount >= 0),
  description text not null default '',
  category text not null default 'Andet',
  product_id uuid references public.products(id) on delete set null,
  product_qty numeric(10, 2),
  created_at timestamptz not null default now()
);
create index expenses_spent_on_idx on public.expenses (spent_on);

-- =====================================================================
-- Nye brugere: profil oprettes straks; kundekortet først når e-mailen er bekræftet,
-- så ingen kan overtage en eksisterende kundes historik med en falsk e-mail.
-- =====================================================================
create or replace function public.handle_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  cid uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id) values (new.id) on conflict do nothing;
  end if;

  if new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null)
     and not exists (select 1 from public.customers where user_id = new.id)
     and not exists (select 1 from public.profiles where id = new.id and role = 'admin') then
    select id into cid from public.customers
      where user_id is null and email is not null and lower(email) = lower(new.email)
      limit 1;
    if cid is not null then
      update public.customers set
        user_id = new.id,
        full_name = coalesce(nullif(trim(m ->> 'full_name'), ''), full_name),
        phone = coalesce(nullif(trim(m ->> 'phone'), ''), phone),
        photo_consent = coalesce((m ->> 'photo_consent')::boolean, photo_consent),
        privacy_accepted_at = now()
      where id = cid;
    else
      insert into public.customers (user_id, full_name, phone, email, photo_consent, privacy_accepted_at)
      values (new.id, coalesce(trim(m ->> 'full_name'), ''), coalesce(trim(m ->> 'phone'), ''),
              lower(new.email), coalesce((m ->> 'photo_consent')::boolean, false), now());
    end if;
  end if;
  return new;
end $$;

create trigger on_auth_user_insert after insert on auth.users
  for each row execute function public.handle_auth_user();
create trigger on_auth_user_confirm after update of email_confirmed_at on auth.users
  for each row execute function public.handle_auth_user();

-- Gør en bruger til admin. Kun til brug i SQL Editor:  select public.make_admin('navn@mail.dk');
create or replace function public.make_admin(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'Der findes ingen bruger med e-mailen %. Opret først login i appen.', p_email;
  end if;
  insert into public.profiles (id, role) values (uid, 'admin')
    on conflict (id) do update set role = 'admin';
  delete from public.customers c
    where c.user_id = uid and not exists (select 1 from public.bookings b where b.customer_id = c.id);
  return p_email || ' er nu admin';
end $$;

-- =====================================================================
-- Ledige tider. Regnes ud fra åbne dage, ydelsens varighed og eksisterende bookinger.
-- Kunderne ser kun tidspunkter, aldrig hvem der har booket.
-- =====================================================================
create or replace function public.available_slots(p_service_id uuid, p_from date default null, p_to date default null)
returns table (slot_start timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  s public.settings%rowtype;
  svc public.services%rowtype;
  d public.open_days%rowtype;
  today date := (now() at time zone 'Europe/Copenhagen')::date;
  earliest timestamptz;
  t timestamptz;
  day_end timestamptz;
  dur interval;
begin
  select * into s from public.settings where id = 1;
  select * into svc from public.services where id = p_service_id and active;
  if not found then return; end if;
  dur := make_interval(mins => svc.duration_min);
  earliest := now() + make_interval(hours => s.min_notice_hours);

  for d in
    select * from public.open_days
    where day >= greatest(coalesce(p_from, today), today)
      and day <= least(coalesce(p_to, today + s.booking_days_ahead), today + s.booking_days_ahead)
    order by day
  loop
    t := (d.day + d.start_time) at time zone 'Europe/Copenhagen';
    day_end := (d.day + d.end_time) at time zone 'Europe/Copenhagen';
    while t + dur <= day_end loop
      if t >= earliest and not exists (
        select 1 from public.bookings b
        where b.status in ('pending', 'confirmed', 'completed')
          and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(t, t + dur, '[)')
      ) then
        slot_start := t;
        return next;
      end if;
      t := t + make_interval(mins => s.slot_step_min);
    end loop;
  end loop;
end $$;

-- Kunden sender en bookingforespørgsel (status 'pending' indtil admin godkender)
create or replace function public.request_booking(p_service_id uuid, p_starts_at timestamptz, p_note text default '')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.my_customer_id();
  svc public.services%rowtype;
  local_day date := (p_starts_at at time zone 'Europe/Copenhagen')::date;
  bid uuid;
begin
  if cid is null then
    raise exception 'Log ind som kunde for at booke.';
  end if;
  select * into svc from public.services where id = p_service_id and active;
  if not found then
    raise exception 'Ydelsen findes ikke længere. Vælg en anden.';
  end if;
  if (select count(*) from public.bookings where customer_id = cid and status = 'pending') >= 3 then
    raise exception 'Du har allerede 3 tider, der venter på svar. Vent til de er bekræftet.';
  end if;
  if not exists (
    select 1 from public.available_slots(p_service_id, local_day, local_day) a where a.slot_start = p_starts_at
  ) then
    raise exception 'Tiden er ikke ledig længere. Vælg en anden tid.';
  end if;

  insert into public.bookings
    (customer_id, service_id, service_name, price, duration_min, starts_at, ends_at, status, customer_note, created_by)
  values
    (cid, svc.id, svc.name, svc.price, svc.duration_min, p_starts_at,
     p_starts_at + make_interval(mins => svc.duration_min), 'pending', left(coalesce(p_note, ''), 500), 'customer')
  returning id into bid;
  return bid;
exception
  when exclusion_violation then
    raise exception 'Tiden er ikke ledig længere. Vælg en anden tid.';
end $$;

-- Kunden aflyser selv. Bekræftede tider kun indtil X timer før (standard 24).
-- En forespørgsel der ikke er bekræftet endnu, kan altid trækkes tilbage.
create or replace function public.cancel_my_booking(p_booking_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings%rowtype;
  hrs int := (select cancel_hours from public.settings where id = 1);
begin
  select * into b from public.bookings
    where id = p_booking_id and customer_id = public.my_customer_id()
    for update;
  if not found then
    raise exception 'Bookingen blev ikke fundet.';
  end if;
  if b.status not in ('pending', 'confirmed') then
    raise exception 'Denne booking kan ikke aflyses.';
  end if;
  if b.status = 'confirmed' and b.starts_at - now() < make_interval(hours => hrs) then
    raise exception 'Der er under % timer til din tid. Ring til salonen for at aflyse.', hrs;
  end if;
  update public.bookings set status = 'cancelled', cancelled_at = now() where id = b.id;
end $$;

-- Kunden retter egne kontaktoplysninger (e-mail ændres via login)
create or replace function public.update_my_contact(p_full_name text, p_phone text, p_photo_consent boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_customer_id() is null then
    raise exception 'Log ind som kunde for at rette dine oplysninger.';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Skriv dit navn.';
  end if;
  update public.customers
    set full_name = left(trim(p_full_name), 120),
        phone = left(trim(coalesce(p_phone, '')), 40),
        photo_consent = coalesce(p_photo_consent, photo_consent)
    where user_id = auth.uid();
end $$;

-- Udgift, eventuelt med varer der lægges direkte på lager
create or replace function public.add_expense(
  p_spent_on date, p_amount numeric, p_description text, p_category text,
  p_product_id uuid default null, p_new_product_name text default null,
  p_qty numeric default null, p_unit text default 'stk'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  pid uuid := p_product_id;
  eid uuid;
begin
  if not public.is_admin() then raise exception 'Kun admin kan registrere udgifter.'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Skriv et beløb.'; end if;

  if p_qty is not null and p_qty > 0 then
    if pid is null and coalesce(trim(p_new_product_name), '') <> '' then
      insert into public.products (name, qty, unit, unit_cost)
      values (trim(p_new_product_name), 0, coalesce(nullif(trim(p_unit), ''), 'stk'), round(p_amount / p_qty, 2))
      returning id into pid;
    end if;
    if pid is null then raise exception 'Vælg en vare eller skriv navnet på en ny.'; end if;
    update public.products
      set qty = qty + p_qty,
          unit_cost = case when p_amount > 0 then round(p_amount / p_qty, 2) else unit_cost end
      where id = pid;
  else
    pid := null;
  end if;

  insert into public.expenses (spent_on, amount, description, category, product_id, product_qty)
  values (coalesce(p_spent_on, current_date), p_amount, coalesce(trim(p_description), ''),
          coalesce(nullif(trim(p_category), ''), 'Andet'), pid, case when pid is not null then p_qty end)
  returning id into eid;
  return eid;
end $$;

-- Slet udgift. Varer den lagde på lager, trækkes fra igen.
create or replace function public.delete_expense(p_expense_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e public.expenses%rowtype;
begin
  if not public.is_admin() then raise exception 'Kun admin kan slette udgifter.'; end if;
  select * into e from public.expenses where id = p_expense_id;
  if not found then return; end if;
  if e.product_id is not null and e.product_qty is not null then
    update public.products set qty = greatest(0, qty - e.product_qty) where id = e.product_id;
  end if;
  delete from public.expenses where id = e.id;
end $$;

-- =====================================================================
-- Sikkerhedsregler (Row Level Security)
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_private enable row level security;
alter table public.settings enable row level security;
alter table public.services enable row level security;
alter table public.open_days enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_photos enable row level security;
alter table public.products enable row level security;
alter table public.expenses enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy customers_read on public.customers for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy customers_admin on public.customers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy customer_private_admin on public.customer_private for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_admin on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy services_read on public.services for select to anon, authenticated
  using (active or public.is_admin());
create policy services_admin on public.services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy open_days_admin on public.open_days for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy bookings_read on public.bookings for select to authenticated
  using (customer_id = public.my_customer_id() or public.is_admin());
create policy bookings_admin on public.bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy photos_read on public.booking_photos for select to authenticated
  using (customer_id = public.my_customer_id() or public.is_admin());
create policy photos_admin on public.booking_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy products_admin on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy expenses_admin on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.settings, public.services to anon;

revoke execute on function public.make_admin(text) from public, anon, authenticated;
revoke execute on function public.handle_auth_user() from public, anon, authenticated;
revoke execute on function public.request_booking(uuid, timestamptz, text) from public, anon;
revoke execute on function public.cancel_my_booking(uuid) from public, anon;
revoke execute on function public.update_my_contact(text, text, boolean) from public, anon;
revoke execute on function public.add_expense(date, numeric, text, text, uuid, text, numeric, text) from public, anon;
revoke execute on function public.delete_expense(uuid) from public, anon;
grant execute on function public.request_booking(uuid, timestamptz, text) to authenticated;
grant execute on function public.cancel_my_booking(uuid) to authenticated;
grant execute on function public.update_my_contact(text, text, boolean) to authenticated;
grant execute on function public.add_expense(date, numeric, text, text, uuid, text, numeric, text) to authenticated;
grant execute on function public.delete_expense(uuid) to authenticated;

-- =====================================================================
-- Billeder: privat mappe. Stien er <kunde-id>/<booking-id>/<fil>.jpg
-- Admin kan alt; en kunde kan kun se filer i sin egen mappe.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "photos: admin" on storage.objects for all to authenticated
  using (bucket_id = 'photos' and public.is_admin())
  with check (bucket_id = 'photos' and public.is_admin());

create policy "photos: egen mappe" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_customer_id()::text);
