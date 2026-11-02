import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, niceError } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import Logo from '../../components/Logo';
import { Field, useToast } from '../../components/ui';

export default function ResetPassword() {
  const { session, endRecovery } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (pw.length < 8) return setError('Adgangskoden skal være på mindst 8 tegn.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(niceError(error));
    endRecovery();
    toast('Din nye adgangskode er gemt');
    nav('/', { replace: true });
  }

  return (
    <div className="auth">
      <div className="auth-logo"><Logo size="lg" /></div>
      {!session ? (
        <div className="card stack-sm">
          <h2>Linket er udløbet</h2>
          <p className="muted">Bed om et nyt link fra log ind-siden.</p>
          <button className="btn ghost" onClick={() => nav('/')}>Til log ind</button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <h2>Vælg ny adgangskode</h2>
          <Field label="Ny adgangskode" hint="Mindst 8 tegn">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
          </Field>
          {error && <p className="note error">{error}</p>}
          <button className="btn gold" disabled={busy}>{busy ? 'Gemmer…' : 'Gem adgangskode'}</button>
        </form>
      )}
    </div>
  );
}
