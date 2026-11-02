import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useLoad } from '../lib/hooks';
import { supabase } from '../lib/supabase';

/**
 * SKABELON. Gennemgå teksten og udfyld [FELTERNE] før appen bruges af kunder.
 * Det er ikke juridisk rådgivning.
 */
export default function Privacy() {
  const nav = useNavigate();
  const { data: s } = useLoad(async () => (await supabase.from('settings').select('*').maybeSingle()).data, []);
  return (
    <div className="auth prose">
      <div className="auth-logo"><Logo size="md" /></div>
      <h1>Privatlivspolitik</h1>
      <p>Denne app bruges til at booke tid hos {s?.salon_name || 'Just Nails by AK'}. Her kan du læse, hvilke oplysninger vi gemmer om dig, og hvorfor.</p>

      <h2>Hvem er ansvarlig</h2>
      <p>{s?.salon_name || 'Just Nails by AK'}, [ADRESSE], CVR [CVR-NUMMER]. Telefon {s?.phone || '[TELEFON]'}.</p>

      <h2>Hvad vi gemmer</h2>
      <ul>
        <li>Navn, telefonnummer og e-mail, så vi kan bekræfte og ændre dine tider.</li>
        <li>Dine bookinger og tidligere behandlinger.</li>
        <li>Noter om dine ønsker til behandlingen, fx farver, form eller hensyn til din hud.</li>
        <li>Billeder af dine negle efter behandlingen, men kun hvis du har sagt ja til det. Du kan altid ændre dit valg under Profil.</li>
      </ul>

      <h2>Hvorfor</h2>
      <p>Vi bruger oplysningerne til at håndtere dine bookinger og give dig den behandling, du ønsker. Vi deler dem ikke med andre og bruger dem ikke til markedsføring.</p>

      <h2>Hvor oplysningerne ligger</h2>
      <p>Data gemmes krypteret hos vores databehandler Supabase på servere i EU (Frankfurt). Teknisk drift varetages af [FELLOWUP, CVR].</p>

      <h2>Hvor længe</h2>
      <p>Vi gemmer dine oplysninger, så længe du er kunde. Har du ikke booket tid i [3] år, sletter vi dem. Regnskabsoplysninger gemmes i 5 år efter bogføringsloven.</p>

      <h2>Dine rettigheder</h2>
      <p>Du kan altid se og rette dine kontaktoplysninger i appen. Du har ret til at få indsigt i, rettet eller slettet dine oplysninger. Kontakt os på {s?.phone || '[TELEFON]'} eller [E-MAIL]. Du kan klage til Datatilsynet på datatilsynet.dk.</p>

      <button className="btn ghost" onClick={() => nav(-1)}>Tilbage</button>
    </div>
  );
}
