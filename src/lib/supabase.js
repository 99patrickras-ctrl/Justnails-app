import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

export const configured = Boolean(url && key);

export const supabase = configured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** Returnerer data eller kaster fejlen, så kald kan skrives som `must(await supabase...)`. */
export function must({ data, error }) {
  if (error) throw error;
  return data;
}

/** Oversætter tekniske fejl til en dansk besked, man kan handle på. */
export function niceError(e) {
  const msg = (e && (e.message || e.error_description || String(e))) || 'Ukendt fejl';
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Ingen forbindelse. Tjek internettet og prøv igen.';
  if (/Invalid login credentials/i.test(msg)) return 'Forkert e-mail eller adgangskode.';
  if (/Email not confirmed/i.test(msg)) return 'Bekræft din e-mail først. Tjek din indbakke (og spam).';
  if (/already registered|already been registered/i.test(msg)) return 'Der findes allerede en konto med den e-mail. Log ind i stedet.';
  if (/Password should be at least|weak.?password/i.test(msg)) return 'Adgangskoden skal være på mindst 8 tegn.';
  if (/rate limit|too many/i.test(msg)) return 'For mange forsøg. Vent et par minutter og prøv igen.';
  if (/bookings_no_overlap|exclusion constraint/i.test(msg)) return 'Tiden overlapper en anden booking.';
  if (/customers_email_unique|duplicate key/i.test(msg)) return 'Der findes allerede en kunde med den e-mail.';
  if (/row-level security|permission denied/i.test(msg)) return 'Du har ikke adgang til at gøre det.';
  if (/JWT expired/i.test(msg)) return 'Du er blevet logget ud. Log ind igen.';
  return msg;
}
