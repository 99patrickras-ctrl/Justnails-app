import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, must, niceError } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLoad } from '../../lib/hooks';
import { Field, useToast } from '../../components/ui';

export default function Profile() {
  const { customer, user, refreshCustomer, signOut } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(customer?.full_name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [consent, setConsent] = useState(!!customer?.photo_consent);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: s } = useLoad(async () => (await supabase.from('settings').select('*').maybeSingle()).data, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      must(await supabase.rpc('update_my_contact', { p_full_name: name, p_phone: phone, p_photo_consent: consent }));
      await refreshCustomer();
      toast('Dine oplysninger er gemt');
    } catch (err) {
      toast(niceError(err));
    } finally {
      setBusy(false);
    }
  }

  async function changePw(e) {
    e.preventDefault();
    if (pw.length < 8) return toast('Adgangskoden skal være på mindst 8 tegn.');
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast(niceError(error));
    setPw('');
    toast('Din nye adgangskode er gemt');
  }

  return (
    <div className="stack-lg">
      <div>
        <p className="eyebrow">Profil</p>
        <h1>Mine oplysninger</h1>
      </div>

      <form className="stack" onSubmit={save}>
        <Field label="Navn"><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></Field>
        <Field label="Telefon"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></Field>
        <Field label="E-mail" hint="E-mailen er dit login og kan ikke ændres her.">
          <input value={user?.email || ''} readOnly />
        </Field>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Billeder af mine negle må gemmes i min historik.</span>
        </label>
        <button className="btn gold" disabled={busy}>{busy ? 'Gemmer…' : 'Gem oplysninger'}</button>
      </form>

      <form className="stack-sm" onSubmit={changePw}>
        <h2>Skift adgangskode</h2>
        <Field label="Ny adgangskode" hint="Mindst 8 tegn">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
        <button className="btn ghost" disabled={!pw}>Gem ny adgangskode</button>
      </form>

      {s && (s.phone || s.address) && (
        <div className="card stack-sm">
          <h2>Kontakt salonen</h2>
          {s.phone && <p><a href={`tel:${s.phone.replace(/\s/g, '')}`}>{s.phone}</a></p>}
          {s.address && <p className="muted">{s.address}</p>}
        </div>
      )}

      <div className="stack-sm">
        <Link to="/privatliv" className="link">Privatlivspolitik</Link>
        <button className="btn ghost" onClick={signOut}>Log ud</button>
      </div>
    </div>
  );
}
