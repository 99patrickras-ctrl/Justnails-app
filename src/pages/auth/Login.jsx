import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, niceError } from '../../lib/supabase';
import Logo from '../../components/Logo';
import { Field } from '../../components/ui';

export default function Login() {
  const [mode, setMode] = useState('login'); // login | signup | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [photos, setPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const go = (m) => { setMode(m); setError(''); setDone(''); };

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === 'signup') {
        if (!privacy) throw new Error('Sæt flueben ved privatlivspolitikken for at oprette en konto.');
        if (password.length < 8) throw new Error('Adgangskoden skal være på mindst 8 tegn.');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name.trim(), phone: phone.trim(), photo_consent: photos },
          },
        });
        if (error) throw error;
        if (!data.session) setDone(`Vi har sendt en mail til ${email.trim()}. Tryk på linket i mailen for at aktivere din konto. Kig også i spam.`);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + '/nulstil-adgangskode',
        });
        if (error) throw error;
        setDone('Hvis der findes en konto med den e-mail, har vi sendt et link til at vælge en ny adgangskode.');
      }
    } catch (err) {
      setError(niceError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-logo"><Logo size="lg" /></div>

      {mode !== 'forgot' && (
        <div className="seg" role="tablist">
          <button className={`seg-item ${mode === 'login' ? 'active' : ''}`} onClick={() => go('login')} role="tab" aria-selected={mode === 'login'}>Log ind</button>
          <button className={`seg-item ${mode === 'signup' ? 'active' : ''}`} onClick={() => go('signup')} role="tab" aria-selected={mode === 'signup'}>Opret konto</button>
        </div>
      )}

      {done ? (
        <div className="card stack-sm">
          <h2>Tjek din indbakke</h2>
          <p className="muted">{done}</p>
          <button className="btn ghost" onClick={() => go('login')}>Tilbage til log ind</button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          {mode === 'forgot' && (
            <div>
              <h2>Glemt adgangskode</h2>
              <p className="muted small">Skriv din e-mail, så sender vi et link, hvor du kan vælge en ny.</p>
            </div>
          )}
          {mode === 'signup' && (
            <>
              <Field label="Navn"><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></Field>
              <Field label="Telefon"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required /></Field>
            </>
          )}
          <Field label="E-mail">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />
          </Field>
          {mode !== 'forgot' && (
            <Field label="Adgangskode" hint={mode === 'signup' ? 'Mindst 8 tegn' : null}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'signup' ? 8 : undefined} />
            </Field>
          )}
          {mode === 'signup' && (
            <div className="stack-sm">
              <label className="check">
                <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
                <span>Jeg har læst og accepterer <Link to="/privatliv">privatlivspolitikken</Link>.</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} />
                <span>Billeder af mine negle må gemmes i min historik, så jeg selv kan se dem.</span>
              </label>
            </div>
          )}
          {error && <p className="note error" role="alert">{error}</p>}
          <button className="btn gold" disabled={busy}>
            {busy ? 'Et øjeblik…' : mode === 'login' ? 'Log ind' : mode === 'signup' ? 'Opret konto' : 'Send link'}
          </button>
          {mode === 'login' && <button type="button" className="link center" onClick={() => go('forgot')}>Glemt adgangskode?</button>}
          {mode === 'forgot' && <button type="button" className="link center" onClick={() => go('login')}>Tilbage til log ind</button>}
        </form>
      )}
    </div>
  );
}
