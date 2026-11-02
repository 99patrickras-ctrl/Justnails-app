import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, must, niceError } from '../../lib/supabase';
import { useLoad } from '../../lib/hooks';
import { kr, fmtDateLong, fmtTime, monthBounds, todayKey, keyLong, localToISO, addDays, addMonths, dayKey } from '../../lib/format';
import { Empty, LoadError, Spinner, Stat, useToast } from '../../components/ui';
import { BookingRow, BookingSheet, BOOKING_SELECT } from '../../components/BookingSheets';

export default function Dashboard() {
  const toast = useToast();
  const [open, setOpen] = useState(null);
  const month = todayKey().slice(0, 7);

  const { data, error, loading, reload } = useLoad(async () => {
    const [from, to] = monthBounds(month);
    const nowIso = new Date().toISOString();
    const weekEnd = localToISO(addDays(todayKey(), 8));
    const [pending, upcoming, done, expenses, products] = await Promise.all([
      supabase.from('bookings').select(BOOKING_SELECT).eq('status', 'pending').gte('ends_at', nowIso).order('starts_at').then(must),
      supabase.from('bookings').select(BOOKING_SELECT).eq('status', 'confirmed').gte('ends_at', nowIso).lt('starts_at', weekEnd).order('starts_at').then(must),
      supabase.from('bookings').select('price').eq('status', 'completed').gte('starts_at', from).lt('starts_at', to).then(must),
      supabase.from('expenses').select('amount').gte('spent_on', month + '-01').lt('spent_on', addMonths(month, 1) + '-01').then(must),
      supabase.from('products').select('*').order('name').then(must),
    ]);
    const income = done.reduce((s, b) => s + Number(b.price), 0);
    const spent = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const low = products.filter((p) => Number(p.qty) <= 0 || (Number(p.min_qty) > 0 && Number(p.qty) <= Number(p.min_qty)));
    return { pending, upcoming, income, spent, low };
  }, [month]);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <LoadError error={error} onRetry={reload} />;
  const { pending, upcoming, income, spent, low } = data;
  const profit = income - spent;
  const today = todayKey();
  const todays = upcoming.filter((b) => dayKey(b.starts_at) === today);

  async function quick(b, status) {
    try {
      must(await supabase.from('bookings').update({ status }).eq('id', b.id));
      toast(status === 'confirmed' ? 'Tiden er bekræftet' : 'Forespørgslen er afvist');
      reload();
    } catch (e) {
      toast(niceError(e));
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <p className="eyebrow">{keyLong(today)}</p>
        <h1>{todays.length ? `${todays.length} ${todays.length === 1 ? 'kunde' : 'kunder'} i dag` : 'Ingen kunder i dag'}</h1>
      </div>

      <div className="stats">
        <Stat label={`Indtjent i ${new Intl.DateTimeFormat('da-DK', { month: 'long', timeZone: 'UTC' }).format(new Date(month + '-15T12:00:00Z'))}`} value={kr(income)} />
        <Stat label="Udgifter" value={kr(spent)} />
        <Stat label="Overskud" value={kr(profit)} tone={profit >= 0 ? 'pos' : 'neg'} />
      </div>

      <section className="stack-sm">
        <div className="row-between">
          <h2>Venter på svar {pending.length > 0 && <span className="count">{pending.length}</span>}</h2>
        </div>
        {pending.length === 0 ? (
          <Empty>Ingen nye forespørgsler.</Empty>
        ) : (
          <ul className="cards">
            {pending.map((b) => (
              <li key={b.id} className="card stack-sm pending-card">
                <button className="plain" onClick={() => setOpen(b)}>
                  <p className="eyebrow">{fmtDateLong(b.starts_at)} · {fmtTime(b.starts_at)}</p>
                  <strong>{b.customer?.full_name || 'Ukendt'}</strong>
                  <p className="muted small">{b.service_name} · {kr(b.price)}{b.customer_note ? ` · “${b.customer_note}”` : ''}</p>
                </button>
                <div className="btn-row">
                  <button className="btn gold small" onClick={() => quick(b, 'confirmed')}>Godkend</button>
                  <button className="btn small" onClick={() => quick(b, 'declined')}>Afvis</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack-sm">
        <div className="row-between">
          <h2>Kommende 7 dage</h2>
          <Link to="/admin/kalender" className="link">Kalender</Link>
        </div>
        {upcoming.length === 0 ? <Empty>Ingen bekræftede tider de næste 7 dage.</Empty> : (
          <ul className="list">
            {upcoming.map((b) => <BookingRow key={b.id} b={b} showDate onClick={() => setOpen(b)} />)}
          </ul>
        )}
      </section>

      {low.length > 0 && (
        <section className="stack-sm">
          <div className="row-between">
            <h2>Skal bestilles</h2>
            <Link to="/admin/lager" className="link">Lager</Link>
          </div>
          <ul className="list">
            {low.map((p) => (
              <li key={p.id} className="row static">
                <span className="grow"><strong>{p.name}</strong><span className="muted">{p.category || 'Andet'}</span></span>
                <span className="end"><span className="num">{Number(p.qty)} {p.unit}</span><span className={`pill ${Number(p.qty) <= 0 ? 'bad' : 'pending'}`}>{Number(p.qty) <= 0 ? 'Tom' : 'Lav'}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && <BookingSheet booking={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
