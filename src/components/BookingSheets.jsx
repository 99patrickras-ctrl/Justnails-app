import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, must, niceError } from '../lib/supabase';
import { useLoad } from '../lib/hooks';
import { kr, num, fmtDateLong, fmtTime, localToISO, todayKey, dayKey } from '../lib/format';
import { ConfirmButton, Field, Sheet, StatusPill, useToast } from './ui';
import { PhotoSection } from './Photos';

export const BOOKING_SELECT = '*, customer:customers(id, full_name, phone, email, photo_consent)';

/** Admin: se og håndtér én booking */
export function BookingSheet({ booking: b, onClose, onChanged }) {
  const toast = useToast();
  const [price, setPrice] = useState(String(Number(b.price)));
  const [busy, setBusy] = useState(false);

  async function setStatus(status, extra = {}, msg) {
    setBusy(true);
    try {
      const patch = { status, ...extra };
      if (status === 'cancelled') patch.cancelled_at = new Date().toISOString();
      must(await supabase.from('bookings').update(patch).eq('id', b.id));
      toast(msg);
      onChanged?.();
      onClose();
    } catch (e) {
      toast(niceError(e));
    } finally {
      setBusy(false);
    }
  }

  const c = b.customer;
  return (
    <Sheet title={b.service_name} sub={`${fmtDateLong(b.starts_at)} · ${fmtTime(b.starts_at)}–${fmtTime(b.ends_at)}`} onClose={onClose}>
      <div className="stack">
        <div className="card">
          <div className="row-between">
            <div className="grow">
              <strong>{c?.full_name || 'Slettet kunde'}</strong>
              {c?.phone && <p className="muted small">{c.phone}</p>}
              {c?.email && <p className="muted small">{c.email}</p>}
            </div>
            <StatusPill status={b.status} />
          </div>
          {b.customer_note && <p className="quote">“{b.customer_note}”</p>}
          <p className="muted small">{b.duration_min} min · {kr(b.price)} · {b.created_by === 'admin' ? 'Booket af dig' : 'Booket af kunden'}</p>
        </div>

        {b.status === 'pending' && (
          <div className="btn-row">
            <button className="btn gold" disabled={busy} onClick={() => setStatus('confirmed', {}, 'Tiden er bekræftet')}>Godkend</button>
            <button className="btn" disabled={busy} onClick={() => setStatus('declined', {}, 'Forespørgslen er afvist')}>Afvis</button>
          </div>
        )}

        {b.status === 'confirmed' && (
          <div className="stack-sm">
            <Field label="Pris betalt (kr.)">
              <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <button className="btn gold" disabled={busy} onClick={() => setStatus('completed', { price: num(price) }, `${kr(num(price))} er lagt i indtjeningen`)}>
              Marker som gennemført
            </button>
            <ConfirmButton className="btn ghost" onConfirm={() => setStatus('cancelled', {}, 'Tiden er aflyst')}>Aflys tiden</ConfirmButton>
          </div>
        )}

        {b.status === 'completed' && (
          <button className="btn ghost" disabled={busy} onClick={() => setStatus('confirmed', {}, 'Ændret til bekræftet')}>Fortryd gennemført</button>
        )}

        {(b.status === 'cancelled' || b.status === 'declined') && (
          <button className="btn ghost" disabled={busy} onClick={() => setStatus('confirmed', { cancelled_at: null }, 'Tiden er genåbnet')}>Genåbn som bekræftet</button>
        )}

        {b.status !== 'pending' && <PhotoSection booking={b} editable consent={c?.photo_consent} />}

        {c && (
          <Link className="btn ghost" to={`/admin/kunder/${c.id}`} onClick={onClose}>Åbn kundekort</Link>
        )}
        <ConfirmButton
          onConfirm={async () => {
            try {
              must(await supabase.from('bookings').delete().eq('id', b.id));
              toast('Bookingen er slettet');
              onChanged?.();
              onClose();
            } catch (e) {
              toast(niceError(e));
            }
          }}
        >
          Slet booking
        </ConfirmButton>
      </div>
    </Sheet>
  );
}

/** Admin: opret en booking direkte (fx når en kunde ringer) */
export function NewBookingSheet({ date, customerId, onClose, onDone }) {
  const toast = useToast();
  const { data } = useLoad(async () => {
    const [services, customers] = await Promise.all([
      supabase.from('services').select('*').eq('active', true).order('sort').order('name').then(must),
      supabase.from('customers').select('id, full_name, phone').order('full_name').then(must),
    ]);
    return { services, customers };
  }, []);
  const services = data?.services || [];
  const customers = data?.customers || [];

  const [q, setQ] = useState('');
  const [custId, setCustId] = useState(customerId || '');
  const [newCust, setNewCust] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [day, setDay] = useState(date || todayKey());
  const [time, setTime] = useState('10:00');
  const [dur, setDur] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const svc = services.find((s) => s.id === serviceId);
  const chosen = customers.find((c) => c.id === custId);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return customers.slice(0, 6);
    return customers.filter((c) => c.full_name.toLowerCase().includes(t) || (c.phone || '').replace(/\s/g, '').includes(t.replace(/\s/g, ''))).slice(0, 6);
  }, [q, customers]);

  function pickService(id) {
    setServiceId(id);
    const s = services.find((x) => x.id === id);
    if (s) { setDur(String(s.duration_min)); setPrice(String(Number(s.price))); }
  }

  async function save(e) {
    e.preventDefault();
    if (!svc) return toast('Vælg en ydelse.');
    if (!newCust && !custId) return toast('Vælg en kunde.');
    if (newCust && !newName.trim()) return toast('Skriv kundens navn.');
    setBusy(true);
    try {
      let cid = custId;
      if (newCust) {
        const c = must(await supabase.from('customers').insert({ full_name: newName.trim(), phone: newPhone.trim() }).select('id').single());
        cid = c.id;
      }
      const minutes = Math.max(5, Math.round(num(dur) || svc.duration_min));
      const starts = localToISO(day, time);
      const ends = new Date(new Date(starts).getTime() + minutes * 60000).toISOString();
      must(await supabase.from('bookings').insert({
        customer_id: cid, service_id: svc.id, service_name: svc.name, price: num(price),
        duration_min: minutes, starts_at: starts, ends_at: ends, status: 'confirmed',
        customer_note: note.trim(), created_by: 'admin',
      }));
      toast('Tiden er booket');
      onDone?.(day);
      onClose();
    } catch (err) {
      toast(niceError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Ny booking" onClose={onClose}>
      <form className="stack" onSubmit={save}>
        {!newCust ? (
          <div className="stack-sm">
            <Field label="Kunde">
              {chosen ? (
                <div className="chosen">
                  <span className="grow">{chosen.full_name} <span className="muted">{chosen.phone}</span></span>
                  <button type="button" className="link" onClick={() => setCustId('')}>Skift</button>
                </div>
              ) : (
                <input placeholder="Søg navn eller telefon" value={q} onChange={(e) => setQ(e.target.value)} />
              )}
            </Field>
            {!chosen && (
              <div className="picklist">
                {matches.map((c) => (
                  <button type="button" key={c.id} onClick={() => setCustId(c.id)}>
                    {c.full_name} <span className="muted">{c.phone}</span>
                  </button>
                ))}
                <button type="button" className="gold-text" onClick={() => { setNewCust(true); setNewName(q); }}>+ Ny kunde</button>
              </div>
            )}
          </div>
        ) : (
          <div className="stack-sm">
            <div className="two">
              <Field label="Navn"><input value={newName} onChange={(e) => setNewName(e.target.value)} required /></Field>
              <Field label="Telefon"><input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></Field>
            </div>
            <button type="button" className="link" onClick={() => setNewCust(false)}>Vælg eksisterende kunde i stedet</button>
          </div>
        )}

        <Field label="Ydelse">
          <select value={serviceId} onChange={(e) => pickService(e.target.value)} required>
            <option value="">Vælg…</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_min} min · {kr(s.price)}</option>)}
          </select>
        </Field>
        <div className="two">
          <Field label="Dato"><input type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></Field>
          <Field label="Tid"><input type="time" step="300" value={time} onChange={(e) => setTime(e.target.value)} required /></Field>
        </div>
        <div className="two">
          <Field label="Varighed (min)"><input inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value)} /></Field>
          <Field label="Pris (kr.)"><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        </div>
        <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Fx ønsker mørkerød" /></Field>
        <button className="btn gold" disabled={busy}>{busy ? 'Gemmer…' : 'Book tiden'}</button>
      </form>
    </Sheet>
  );
}

/** Liste-række til en booking (bruges flere steder i admin) */
export function BookingRow({ b, onClick, showDate }) {
  return (
    <li>
      <button className={`row ${b.status === 'cancelled' || b.status === 'declined' ? 'faded' : ''}`} onClick={onClick}>
        <span className="time">
          {showDate ? <>{dayKey(b.starts_at) === todayKey() ? 'I dag' : new Intl.DateTimeFormat('da-DK', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short' }).format(new Date(b.starts_at))}<small>{fmtTime(b.starts_at)}</small></> : <>{fmtTime(b.starts_at)}<small>{b.duration_min} min</small></>}
        </span>
        <span className="grow">
          <strong>{b.customer?.full_name || 'Slettet kunde'}</strong>
          <span className="muted">{b.service_name}{b.customer_note ? ` · ${b.customer_note}` : ''}</span>
        </span>
        <span className="end">
          <span className="num">{kr(b.price)}</span>
          <StatusPill status={b.status} />
        </span>
      </button>
    </li>
  );
}
