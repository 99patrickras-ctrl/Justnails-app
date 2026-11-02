import { useState } from 'react';
import { supabase, must, niceError } from '../../lib/supabase';
import { useLoad } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { kr, num } from '../../lib/format';
import { ConfirmButton, Empty, Field, LoadError, PageTitle, Sheet, Spinner, useToast } from '../../components/ui';
import { IconPlus } from '../../components/icons';

export default function Settings() {
  const { signOut, user } = useAuth();
  const toast = useToast();
  const [svc, setSvc] = useState(null);
  const { data, error, loading, reload } = useLoad(async () => {
    const [settings, services] = await Promise.all([
      supabase.from('settings').select('*').maybeSingle().then(must),
      supabase.from('services').select('*').order('sort').order('name').then(must),
    ]);
    return { settings, services };
  }, []);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <LoadError error={error} onRetry={reload} />;

  const link = window.location.origin;

  return (
    <div className="stack-lg">
      <PageTitle back eyebrow="Indstillinger" title="Salon og ydelser" />

      <section className="stack-sm">
        <div className="row-between">
          <h2>Ydelser</h2>
          <button className="btn small gold" onClick={() => setSvc({})}><IconPlus /> Ny</button>
        </div>
        {!data.services.length ? (
          <Empty>Opret dine behandlinger med pris og varighed. Kunderne vælger mellem dem, når de booker.</Empty>
        ) : (
          <ul className="list">
            {data.services.map((s) => (
              <li key={s.id}>
                <button className={`row ${s.active ? '' : 'faded'}`} onClick={() => setSvc(s)}>
                  <span className="grow">
                    <strong>{s.name}</strong>
                    <span className="muted">{s.duration_min} min{s.active ? '' : ' · Skjult for kunder'}</span>
                  </span>
                  <span className="end num">{kr(s.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SalonForm s={data.settings} onSaved={reload} />

      <section className="card stack-sm">
        <h2>Del appen med kunderne</h2>
        <p className="muted small">Læg linket i Instagram-bio, på visitkort eller send det på sms.</p>
        <div className="chosen">
          <span className="grow mono">{link}</span>
          <button className="link" onClick={async () => {
            try { await navigator.clipboard.writeText(link); toast('Linket er kopieret'); }
            catch { toast('Kunne ikke kopiere. Markér linket og kopiér selv.'); }
          }}>Kopiér</button>
        </div>
      </section>

      <section className="stack-sm">
        <p className="muted small">Logget ind som {user?.email}</p>
        <button className="btn ghost" onClick={signOut}>Log ud</button>
      </section>

      {svc && <ServiceSheet s={svc} onClose={() => setSvc(null)} onDone={reload} />}
    </div>
  );
}

function SalonForm({ s, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    salon_name: s.salon_name, phone: s.phone, address: s.address,
    cancel_hours: String(s.cancel_hours), min_notice_hours: String(s.min_notice_hours),
    booking_days_ahead: String(s.booking_days_ahead), slot_step_min: String(s.slot_step_min),
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    try {
      must(await supabase.from('settings').update({
        salon_name: f.salon_name.trim() || 'Just Nails by AK', phone: f.phone.trim(), address: f.address.trim(),
        cancel_hours: Math.round(num(f.cancel_hours)), min_notice_hours: Math.round(num(f.min_notice_hours)),
        booking_days_ahead: Math.max(1, Math.round(num(f.booking_days_ahead))), slot_step_min: Number(f.slot_step_min),
      }).eq('id', 1));
      toast('Indstillingerne er gemt');
      onSaved();
    } catch (err) {
      toast(niceError(err));
    }
  }
  return (
    <form className="card stack-sm" onSubmit={save}>
      <h2>Salon</h2>
      <Field label="Navn"><input value={f.salon_name} onChange={set('salon_name')} /></Field>
      <Field label="Telefon" hint="Vises for kunder, der vil aflyse med kort varsel."><input type="tel" value={f.phone} onChange={set('phone')} /></Field>
      <Field label="Adresse"><input value={f.address} onChange={set('address')} /></Field>
      <h3>Booking</h3>
      <div className="two">
        <Field label="Aflysning senest (timer før)"><input inputMode="numeric" value={f.cancel_hours} onChange={set('cancel_hours')} /></Field>
        <Field label="Booking senest (timer før)"><input inputMode="numeric" value={f.min_notice_hours} onChange={set('min_notice_hours')} /></Field>
      </div>
      <div className="two">
        <Field label="Kan bookes (dage frem)"><input inputMode="numeric" value={f.booking_days_ahead} onChange={set('booking_days_ahead')} /></Field>
        <Field label="Tider hvert">
          <select value={f.slot_step_min} onChange={set('slot_step_min')}>
            {[10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </Field>
      </div>
      <button className="btn small gold">Gem</button>
    </form>
  );
}

function ServiceSheet({ s, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: s.name || '', description: s.description || '',
    price: s.id ? String(Number(s.price)) : '', duration_min: s.id ? String(s.duration_min) : '60',
    sort: s.id ? String(s.sort) : '0', active: s.id ? s.active : true,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    const row = { name: f.name.trim(), description: f.description.trim(), price: num(f.price), duration_min: Math.round(num(f.duration_min)), sort: Math.round(num(f.sort)), active: f.active };
    if (row.duration_min < 5) return toast('Varighed skal være mindst 5 minutter.');
    try {
      if (s.id) must(await supabase.from('services').update(row).eq('id', s.id));
      else must(await supabase.from('services').insert(row));
      toast('Ydelsen er gemt');
      onDone();
      onClose();
    } catch (err) {
      toast(niceError(err));
    }
  }
  return (
    <Sheet title={s.id ? 'Ret ydelse' : 'Ny ydelse'} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <Field label="Navn"><input value={f.name} onChange={set('name')} required placeholder="Fx Gel lak hænder" /></Field>
        <Field label="Kort beskrivelse (valgfri)"><input value={f.description} onChange={set('description')} placeholder="Fx inkl. fjernelse af gammel gel" /></Field>
        <div className="two">
          <Field label="Pris (kr.)"><input inputMode="decimal" value={f.price} onChange={set('price')} required /></Field>
          <Field label="Varighed (min)"><input inputMode="numeric" value={f.duration_min} onChange={set('duration_min')} required /></Field>
        </div>
        <Field label="Rækkefølge" hint="Lavt tal vises først."><input inputMode="numeric" value={f.sort} onChange={set('sort')} /></Field>
        <label className="check">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          <span>Kan bookes af kunder</span>
        </label>
        <button className="btn gold">Gem ydelse</button>
        {s.id && (
          <ConfirmButton onConfirm={async () => {
            try { must(await supabase.from('services').delete().eq('id', s.id)); toast('Ydelsen er slettet'); onDone(); onClose(); }
            catch (err) { toast(niceError(err)); }
          }}>Slet ydelse</ConfirmButton>
        )}
        {s.id && <p className="muted small">Tidligere bookinger beholder navn og pris, selvom ydelsen slettes.</p>}
      </form>
    </Sheet>
  );
}
