import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, must, niceError } from '../../lib/supabase';
import { useLoad } from '../../lib/hooks';
import { kr, fmtDateShort, fmtDateYear, fmtTime, initials } from '../../lib/format';
import { ConfirmButton, Empty, Field, LoadError, PageTitle, Sheet, Spinner, StatusPill, useToast } from '../../components/ui';
import { IconPlus } from '../../components/icons';
import { BookingSheet, NewBookingSheet, BOOKING_SELECT } from '../../components/BookingSheets';
import { PhotoSection } from '../../components/Photos';
import { deleteCustomerFolder } from '../../lib/photos';

export function CustomerList() {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const nav = useNavigate();
  const { data, error, loading, reload } = useLoad(async () => {
    const [customers, visits] = await Promise.all([
      supabase.from('customers').select('*').order('full_name').then(must),
      supabase.from('bookings').select('customer_id, starts_at').in('status', ['confirmed', 'completed']).lte('starts_at', new Date().toISOString()).then(must),
    ]);
    const last = {};
    for (const v of visits) if (!last[v.customer_id] || v.starts_at > last[v.customer_id]) last[v.customer_id] = v.starts_at;
    return { customers, last };
  }, []);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const all = data?.customers || [];
    if (!t) return all;
    return all.filter((c) => c.full_name.toLowerCase().includes(t) || (c.phone || '').replace(/\s/g, '').includes(t.replace(/\s/g, '')) || (c.email || '').toLowerCase().includes(t));
  }, [q, data]);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <LoadError error={error} onRetry={reload} />;

  return (
    <div className="stack-lg">
      <PageTitle eyebrow={`${data.customers.length} kunder`} title="Kunder" right={<button className="btn small gold" onClick={() => setAdding(true)}><IconPlus /> Ny</button>} />
      <input className="search" type="search" placeholder="Søg navn, telefon eller e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
      {!data.customers.length ? (
        <Empty>Kunderne kommer her af sig selv, når de opretter en konto. Du kan også tilføje dem selv.</Empty>
      ) : !list.length ? (
        <Empty>Ingen kunder matcher “{q}”.</Empty>
      ) : (
        <ul className="list">
          {list.map((c) => (
            <li key={c.id}>
              <Link className="row" to={`/admin/kunder/${c.id}`}>
                <span className="avatar">{initials(c.full_name)}</span>
                <span className="grow">
                  <strong>{c.full_name || 'Uden navn'}</strong>
                  <span className="muted">{c.phone || c.email || 'Ingen kontaktinfo'}</span>
                </span>
                <span className="end muted small">{data.last[c.id] ? `Sidst ${fmtDateShort(data.last[c.id])}` : c.user_id ? 'Ny' : 'Uden login'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {adding && <NewCustomerSheet onClose={() => setAdding(false)} onDone={(id) => nav(`/admin/kunder/${id}`)} />}
    </div>
  );
}

function NewCustomerSheet({ onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ full_name: '', phone: '', email: '' });
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const row = { full_name: f.full_name.trim(), phone: f.phone.trim(), email: f.email.trim().toLowerCase() || null };
      const c = must(await supabase.from('customers').insert(row).select('id').single());
      toast('Kunden er oprettet');
      onDone(c.id);
    } catch (err) {
      toast(niceError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title="Ny kunde" onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <Field label="Navn"><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></Field>
        <Field label="Telefon"><input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="E-mail" hint="Hvis kunden senere opretter login med samme e-mail, kobles historikken automatisk på.">
          <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <button className="btn gold" disabled={busy}>{busy ? 'Gemmer…' : 'Opret kunde'}</button>
      </form>
    </Sheet>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [booking, setBooking] = useState(false);
  const { data, error, loading, reload } = useLoad(async () => {
    const [c, priv, bookings] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).maybeSingle().then(must),
      supabase.from('customer_private').select('*').eq('customer_id', id).maybeSingle().then(must),
      supabase.from('bookings').select(BOOKING_SELECT).eq('customer_id', id).order('starts_at', { ascending: false }).then(must),
    ]);
    return { c, priv, bookings };
  }, [id]);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <LoadError error={error} onRetry={reload} />;
  if (!data.c) return <Empty action={<Link className="btn small" to="/admin/kunder">Til kunder</Link>}>Kunden findes ikke længere.</Empty>;

  const { c, priv, bookings } = data;
  const done = bookings.filter((b) => b.status === 'completed');
  const total = done.reduce((s, b) => s + Number(b.price), 0);

  return (
    <div className="stack-lg">
      <PageTitle back title={c.full_name || 'Uden navn'} eyebrow="Kundekort" />
      <div className="chips">
        <span className="pill soft">{done.length} besøg</span>
        <span className="pill soft">{kr(total)} i alt</span>
        <span className={`pill ${c.photo_consent ? 'confirmed' : 'muted'}`}>{c.photo_consent ? 'Ja til billeder' : 'Ikke samtykke til billeder'}</span>
        <span className="pill soft">{c.user_id ? 'Har login' : 'Uden login'}</span>
      </div>

      <button className="btn gold" onClick={() => setBooking(true)}><IconPlus /> Book tid til {c.full_name.split(' ')[0] || 'kunden'}</button>

      <PrivateNotes customerId={c.id} priv={priv} onSaved={reload} />
      <ContactForm c={c} onSaved={reload} />

      <section className="stack-sm">
        <h2>Historik</h2>
        {!bookings.length ? <Empty>Ingen besøg endnu.</Empty> : (
          <ul className="cards">
            {bookings.map((b) => (
              <li key={b.id} className={`card stack-sm ${['cancelled', 'declined'].includes(b.status) ? 'faded' : ''}`}>
                <button className="plain row-between" onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                  <span className="grow">
                    <strong>{b.service_name}</strong>
                    <span className="muted small block">{fmtDateYear(b.starts_at)} · {fmtTime(b.starts_at)} · {kr(b.price)}</span>
                  </span>
                  <StatusPill status={b.status} />
                </button>
                {expanded === b.id && (
                  <div className="stack-sm">
                    {b.customer_note && <p className="quote">“{b.customer_note}”</p>}
                    <PhotoSection booking={b} editable consent={c.photo_consent} />
                    <button className="btn small ghost" onClick={() => setOpen(b)}>Håndtér booking</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmButton
        confirmText="Tryk igen: sletter kunde, noter og billeder"
        onConfirm={async () => {
          try {
            await deleteCustomerFolder(c.id);
            must(await supabase.from('customers').delete().eq('id', c.id));
            toast('Kunden er slettet');
            nav('/admin/kunder', { replace: true });
          } catch (e) {
            toast(niceError(e));
          }
        }}
      >
        Slet kunden
      </ConfirmButton>
      <p className="muted small">Indtjening fra tidligere besøg bliver stående i økonomien. Kundens login slettes i Supabase under Authentication → Users.</p>

      {open && <BookingSheet booking={open} onClose={() => setOpen(null)} onChanged={reload} />}
      {booking && <NewBookingSheet customerId={c.id} onClose={() => setBooking(false)} onDone={reload} />}
    </div>
  );
}

function PrivateNotes({ customerId, priv, onSaved }) {
  const toast = useToast();
  const [prefs, setPrefs] = useState(priv?.preferences || '');
  const [notes, setNotes] = useState(priv?.notes || '');
  const dirty = prefs !== (priv?.preferences || '') || notes !== (priv?.notes || '');
  async function save() {
    try {
      must(await supabase.from('customer_private').upsert({ customer_id: customerId, preferences: prefs, notes, updated_at: new Date().toISOString() }));
      toast('Noterne er gemt');
      onSaved();
    } catch (e) {
      toast(niceError(e));
    }
  }
  return (
    <section className="card stack-sm">
      <div className="row-between"><h2>Noter</h2><span className="muted small">Kun du kan se dem</span></div>
      <Field label="Præferencer"><textarea rows={2} value={prefs} onChange={(e) => setPrefs(e.target.value)} placeholder="Fx kan lide kaffe med mælk, mandelform, kort længde" /></Field>
      <Field label="Noter"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Fx følsom neglebånd, allergisk over for …" /></Field>
      <button className="btn small gold" disabled={!dirty} onClick={save}>Gem noter</button>
    </section>
  );
}

function ContactForm({ c, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ full_name: c.full_name, phone: c.phone, email: c.email || '' });
  const dirty = f.full_name !== c.full_name || f.phone !== c.phone || f.email !== (c.email || '');
  async function save(e) {
    e.preventDefault();
    try {
      must(await supabase.from('customers').update({ full_name: f.full_name.trim(), phone: f.phone.trim(), email: f.email.trim().toLowerCase() || null }).eq('id', c.id));
      toast('Kontaktoplysningerne er gemt');
      onSaved();
    } catch (err) {
      toast(niceError(err));
    }
  }
  return (
    <form className="card stack-sm" onSubmit={save}>
      <h2>Kontakt</h2>
      <Field label="Navn"><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></Field>
      <div className="two">
        <Field label="Telefon"><input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="E-mail"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} readOnly={!!c.user_id} /></Field>
      </div>
      {c.phone && <a className="link" href={`tel:${c.phone.replace(/\s/g, '')}`}>Ring til {c.full_name.split(' ')[0]}</a>}
      <button className="btn small" disabled={!dirty}>Gem kontakt</button>
    </form>
  );
}
