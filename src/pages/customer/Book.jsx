import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, must, niceError } from '../../lib/supabase';
import { useLoad } from '../../lib/hooks';
import { kr, dayKey, fmtTime, keyLong, keyMonthTitle, keyWeekdayShort } from '../../lib/format';
import { Empty, Field, LoadError, Spinner, useToast } from '../../components/ui';
import { IconBack } from '../../components/icons';

export default function Book() {
  const toast = useToast();
  const [service, setService] = useState(null);
  const [day, setDay] = useState(null);
  const [slot, setSlot] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [slots, setSlots] = useState(null);
  const [slotErr, setSlotErr] = useState(null);

  const { data: services, error, loading, reload } = useLoad(
    async () => must(await supabase.from('services').select('*').eq('active', true).order('sort').order('name')),
    [],
  );

  async function loadSlots(svc) {
    setSlots(null);
    setSlotErr(null);
    try {
      setSlots(must(await supabase.rpc('available_slots', { p_service_id: svc.id })) || []);
    } catch (e) {
      setSlotErr(e);
    }
  }
  useEffect(() => { if (service) loadSlots(service); }, [service]);

  const byDay = useMemo(() => {
    const m = new Map();
    for (const s of slots || []) {
      const k = dayKey(s.slot_start);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s.slot_start);
    }
    return m;
  }, [slots]);
  const days = [...byDay.keys()];
  const months = days.reduce((acc, k) => {
    const mk = k.slice(0, 7);
    (acc[mk] ||= []).push(k);
    return acc;
  }, {});

  async function send() {
    setBusy(true);
    try {
      must(await supabase.rpc('request_booking', { p_service_id: service.id, p_starts_at: slot, p_note: note.trim() }));
      setSent({ service, slot });
    } catch (e) {
      toast(niceError(e));
      if (/ledig/i.test(e.message || '')) {
        setSlot(null);
        loadSlots(service);
      }
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="stack-lg center-col">
        <div className="success-mark" aria-hidden="true">✓</div>
        <h1>Tak for din forespørgsel</h1>
        <p className="muted">
          {sent.service.name}, {keyLong(dayKey(sent.slot)).toLowerCase()} kl. {fmtTime(sent.slot)}.
          Tiden er reserveret til dig, mens den venter på at blive bekræftet. Du kan følge den under Mine tider.
        </p>
        <Link to="/" className="btn gold">Se mine tider</Link>
      </div>
    );
  }

  const step = !service ? 1 : !day ? 2 : !slot ? 3 : 4;
  const back = () => (slot ? setSlot(null) : day ? setDay(null) : setService(null));

  return (
    <div className="stack-lg">
      <div className="page-title">
        {step > 1 && <button className="icon-btn" onClick={back} aria-label="Tilbage"><IconBack /></button>}
        <div className="grow">
          <p className="eyebrow">Trin {step} af 4</p>
          <h1>{['Vælg behandling', 'Vælg dag', 'Vælg tid', 'Bekræft'][step - 1]}</h1>
        </div>
      </div>

      {step === 1 && (
        loading && !services ? <Spinner /> : error && !services ? <LoadError error={error} onRetry={reload} /> :
        !services.length ? <Empty>Der er ingen behandlinger at booke lige nu.</Empty> : (
          <ul className="cards">
            {services.map((s) => (
              <li key={s.id}>
                <button className="card service-card" onClick={() => setService(s)}>
                  <div className="grow">
                    <strong>{s.name}</strong>
                    {s.description && <p className="muted small">{s.description}</p>}
                    <p className="muted small">{s.duration_min} min</p>
                  </div>
                  <span className="price">{kr(s.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {step === 2 && (
        <div className="stack">
          <p className="muted">{service.name} · {service.duration_min} min · {kr(service.price)}</p>
          {slotErr ? <LoadError error={slotErr} onRetry={() => loadSlots(service)} /> : !slots ? <Spinner label="Finder ledige dage…" /> :
            !days.length ? <Empty>Der er ingen ledige tider lige nu. Kig forbi igen senere, eller ring til salonen.</Empty> :
            Object.entries(months).map(([mk, ks]) => (
              <section key={mk} className="stack-sm">
                <h3>{keyMonthTitle(mk + '-01')}</h3>
                <div className="daygrid">
                  {ks.map((k) => (
                    <button key={k} className="daychip" onClick={() => setDay(k)}>
                      <small>{keyWeekdayShort(k)}</small>
                      <b>{Number(k.slice(8))}</b>
                      <small>{byDay.get(k).length} tider</small>
                    </button>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <p className="muted">{keyLong(day)} · {service.name}</p>
          <div className="timegrid">
            {(byDay.get(day) || []).map((t) => (
              <button key={t} className="timechip" onClick={() => setSlot(t)}>{fmtTime(t)}</button>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="stack">
          <div className="card stack-sm">
            <p className="eyebrow">{keyLong(day)}</p>
            <h2 className="serif-lg">kl. {fmtTime(slot)}</h2>
            <p>{service.name}</p>
            <p className="muted small">{service.duration_min} min · {kr(service.price)}</p>
          </div>
          <Field label="Besked til salonen (valgfri)">
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Fx ønsket farve eller længde" maxLength={500} />
          </Field>
          <button className="btn gold" disabled={busy} onClick={send}>{busy ? 'Sender…' : 'Send forespørgsel'}</button>
          <p className="muted small center">Tiden er først endelig, når den er bekræftet.</p>
        </div>
      )}
    </div>
  );
}
