import { useMemo, useState } from 'react';
import { supabase, must, niceError } from '../../lib/supabase';
import { useLoad, useLocalState } from '../../lib/hooks';
import {
  addDays, addMonths, dayKey, hhmm, kr, keyLong, keyMonthTitle, localToISO, todayKey, weekdayIndex,
} from '../../lib/format';
import { ConfirmButton, Empty, Field, LoadError, Spinner, useToast } from '../../components/ui';
import { IconChevronLeft, IconChevronRight, IconPlus } from '../../components/icons';
import { BookingRow, BookingSheet, NewBookingSheet, BOOKING_SELECT } from '../../components/BookingSheets';

const WEEKDAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

export default function Calendar() {
  const toast = useToast();
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [sel, setSel] = useState(todayKey());
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState([]);
  const [hours, setHours] = useLocalState('jn-hours', { start: '10:00', end: '17:00' });
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editHours, setEditHours] = useState(false);

  const { data, error, loading, reload } = useLoad(async () => {
    const first = month + '-01';
    const gridStart = addDays(first, -weekdayIndex(first));
    const gridEnd = addDays(gridStart, 42);
    const [days, bookings] = await Promise.all([
      supabase.from('open_days').select('*').gte('day', gridStart).lt('day', gridEnd).then(must),
      supabase.from('bookings').select(BOOKING_SELECT).gte('starts_at', localToISO(gridStart)).lt('starts_at', localToISO(gridEnd)).order('starts_at').then(must),
    ]);
    return { gridStart, days, bookings };
  }, [month]);

  const grid = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: 42 }, (_, i) => addDays(data.gridStart, i));
  }, [data]);
  const openMap = useMemo(() => new Map((data?.days || []).map((d) => [d.day, d])), [data]);
  const byDay = useMemo(() => {
    const m = new Map();
    for (const b of data?.bookings || []) {
      const k = dayKey(b.starts_at);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(b);
    }
    return m;
  }, [data]);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <LoadError error={error} onRetry={reload} />;

  const today = todayKey();
  const selOpen = openMap.get(sel);
  const selBookings = byDay.get(sel) || [];
  const active = selBookings.filter((b) => ['pending', 'confirmed', 'completed'].includes(b.status));

  async function saveDays(keys, start, end) {
    if (end <= start) return toast('Sluttid skal være efter starttid.');
    try {
      must(await supabase.from('open_days').upsert(keys.map((day) => ({ day, start_time: start, end_time: end }))));
      setHours({ start, end });
      toast(keys.length === 1 ? 'Dagen er åben for booking' : `${keys.length} dage er åbne for booking`);
      setMulti(false);
      setPicked([]);
      setEditHours(false);
      reload();
    } catch (e) {
      toast(niceError(e));
    }
  }
  async function closeDay(key) {
    try {
      must(await supabase.from('open_days').delete().eq('day', key));
      toast('Dagen er lukket for nye bookinger');
      reload();
    } catch (e) {
      toast(niceError(e));
    }
  }

  function tap(k) {
    if (multi) {
      if (k < today) return;
      setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
    } else {
      setSel(k);
      setEditHours(false);
      if (k.slice(0, 7) !== month) setMonth(k.slice(0, 7));
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-title">
        <div className="grow">
          <p className="eyebrow">Kalender</p>
          <h1>{keyMonthTitle(month + '-01')}</h1>
        </div>
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Forrige måned"><IconChevronLeft /></button>
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Næste måned"><IconChevronRight /></button>
      </div>

      <div className="stack-sm">
        <div className="cal">
          {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
          {grid.map((k) => {
            const o = openMap.get(k);
            const bs = (byDay.get(k) || []).filter((b) => ['pending', 'confirmed', 'completed'].includes(b.status));
            const hasPending = bs.some((b) => b.status === 'pending');
            const cls = [
              'cal-day',
              k.slice(0, 7) !== month && 'other',
              k < today && 'past',
              o && 'open',
              k === today && 'today',
              !multi && k === sel && 'sel',
              multi && picked.includes(k) && 'picked',
            ].filter(Boolean).join(' ');
            return (
              <button key={k} className={cls} onClick={() => tap(k)} aria-label={`${keyLong(k)}${o ? ', åben' : ''}, ${bs.length} bookinger`}>
                <span>{Number(k.slice(8))}</span>
                <span className="cal-dots">
                  {bs.slice(0, 3).map((b) => <i key={b.id} className={b.status === 'pending' ? 'p' : ''} />)}
                </span>
                {hasPending && <em className="cal-flag" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="legend">
          <span><i className="lg-open" /> Åben for booking</span>
          <span><i className="lg-dot" /> Booking</span>
          <span><i className="lg-dot p" /> Venter</span>
        </div>
      </div>

      {multi ? (
        <div className="card stack-sm">
          <h2>Åbn flere dage</h2>
          <p className="muted small">Tryk på de dage, du vil åbne. {picked.length ? `${picked.length} valgt.` : ''}</p>
          <div className="two">
            <Field label="Fra"><input type="time" step="900" value={hours.start} onChange={(e) => setHours({ ...hours, start: e.target.value })} /></Field>
            <Field label="Til"><input type="time" step="900" value={hours.end} onChange={(e) => setHours({ ...hours, end: e.target.value })} /></Field>
          </div>
          <div className="btn-row">
            <button className="btn gold" disabled={!picked.length} onClick={() => saveDays(picked, hours.start, hours.end)}>Åbn {picked.length || ''} dage</button>
            <button className="btn ghost" onClick={() => { setMulti(false); setPicked([]); }}>Annullér</button>
          </div>
        </div>
      ) : (
        <section className="stack">
          <div className="row-between">
            <h2>{keyLong(sel)}</h2>
            {active.length > 0 && <span className="muted small num">{active.length} {active.length === 1 ? 'tid' : 'tider'} · {kr(active.reduce((s, b) => s + Number(b.price), 0))}</span>}
          </div>

          <div className="card stack-sm">
            {selOpen && !editHours ? (
              <>
                <div className="row-between">
                  <div>
                    <span className="pill confirmed">Åben</span>
                    <p className="serif-md">{hhmm(selOpen.start_time)}–{hhmm(selOpen.end_time)}</p>
                  </div>
                  <button className="btn small ghost" onClick={() => setEditHours(true)}>Ret tider</button>
                </div>
                <ConfirmButton className="btn ghost small" onConfirm={() => closeDay(sel)}>Luk dagen for booking</ConfirmButton>
                {active.length > 0 && <p className="muted small">Eksisterende tider bliver ikke aflyst, hvis du lukker dagen.</p>}
              </>
            ) : sel < today ? (
              <p className="muted">Dagen er passeret.</p>
            ) : (
              <DayHours
                initial={selOpen ? { start: hhmm(selOpen.start_time), end: hhmm(selOpen.end_time) } : hours}
                label={selOpen ? 'Gem tider' : 'Åbn dagen for booking'}
                onSave={(s, e) => saveDays([sel], s, e)}
                onCancel={selOpen ? () => setEditHours(false) : null}
              />
            )}
          </div>

          {selBookings.length ? (
            <ul className="list">
              {selBookings.map((b) => <BookingRow key={b.id} b={b} onClick={() => setOpen(b)} />)}
            </ul>
          ) : (
            <Empty>Ingen bookinger denne dag.</Empty>
          )}

          <div className="btn-row">
            <button className="btn" onClick={() => setCreating(true)}><IconPlus /> Ny booking</button>
            <button className="btn ghost" onClick={() => { setMulti(true); setPicked([]); }}>Åbn flere dage</button>
          </div>
        </section>
      )}

      {open && <BookingSheet booking={open} onClose={() => setOpen(null)} onChanged={reload} />}
      {creating && <NewBookingSheet date={sel} onClose={() => setCreating(false)} onDone={reload} />}
    </div>
  );
}

function DayHours({ initial, label, onSave, onCancel }) {
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  return (
    <div className="stack-sm">
      {!onCancel && <p className="muted small">Dagen er lukket. Kunderne kan ikke se den.</p>}
      <div className="two">
        <Field label="Fra"><input type="time" step="900" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Til"><input type="time" step="900" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <div className="btn-row">
        <button className="btn gold" onClick={() => onSave(start, end)}>{label}</button>
        {onCancel && <button className="btn ghost" onClick={onCancel}>Annullér</button>}
      </div>
    </div>
  );
}
