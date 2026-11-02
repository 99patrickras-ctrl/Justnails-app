import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, must, niceError } from '../../lib/supabase';
import { useLoad } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { kr, fmtDateLong, fmtDateYear, fmtTime, firstName } from '../../lib/format';
import { ConfirmButton, Empty, LoadError, Spinner, StatusPill, useToast } from '../../components/ui';
import { PhotoGrid, Lightbox } from '../../components/Photos';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

export default function MyBookings() {
  const { customer } = useAuth();
  const toast = useToast();
  const [photo, setPhoto] = useState(null);
  const { data, error, loading, reload } = useLoad(async () => {
    const [bookings, photos, settings] = await Promise.all([
      supabase.from('bookings').select('*').order('starts_at', { ascending: false }).then(must),
      supabase.from('booking_photos').select('*').order('created_at').then(must),
      supabase.from('settings').select('*').maybeSingle().then(must),
    ]);
    return { bookings, photos, settings };
  }, []);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <LoadError error={error} onRetry={reload} />;

  const { bookings, photos, settings } = data;
  const now = Date.now();
  const cancelMs = (settings?.cancel_hours ?? 24) * 3600e3;
  const upcoming = bookings
    .filter((b) => new Date(b.ends_at).getTime() > now && (b.status === 'pending' || b.status === 'confirmed'))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const history = bookings.filter((b) => !upcoming.includes(b));
  const photosBy = photos.reduce((m, p) => ((m[p.booking_id] ||= []).push(p), m), {});

  async function cancel(b) {
    try {
      must(await supabase.rpc('cancel_my_booking', { p_booking_id: b.id }));
      toast(b.status === 'pending' ? 'Forespørgslen er trukket tilbage' : 'Din tid er aflyst');
      reload();
    } catch (e) {
      toast(niceError(e));
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <p className="eyebrow">Velkommen</p>
        <h1>Hej {firstName(customer?.full_name) || 'og velkommen'}</h1>
      </div>

      {!isStandalone() && isIOS() && (
        <div className="card note-card">
          <strong>Læg appen på hjemmeskærmen</strong>
          <p className="muted small">Tryk på Del-knappen nederst i Safari og vælg “Føj til hjemmeskærm”. Så åbner den som en app.</p>
        </div>
      )}

      <section className="stack-sm">
        <div className="row-between">
          <h2>Mine tider</h2>
          <Link to="/book" className="link">Book tid</Link>
        </div>
        {upcoming.length === 0 ? (
          <Empty action={<Link to="/book" className="btn gold small">Book en tid</Link>}>Du har ingen kommende tider.</Empty>
        ) : (
          <ul className="cards">
            {upcoming.map((b) => {
              const canCancel = b.status === 'pending' || new Date(b.starts_at).getTime() - now >= cancelMs;
              return (
                <li key={b.id} className="card booking-card">
                  <div className="row-between">
                    <div>
                      <p className="eyebrow">{fmtDateLong(b.starts_at)}</p>
                      <h3 className="serif-lg">{fmtTime(b.starts_at)}</h3>
                    </div>
                    <StatusPill status={b.status} />
                  </div>
                  <p>{b.service_name} · {b.duration_min} min · {kr(b.price)}</p>
                  {b.status === 'pending' && <p className="muted small">Venter på at blive bekræftet. Du kan se svaret her.</p>}
                  {b.customer_note && <p className="muted small">Din note: {b.customer_note}</p>}
                  {canCancel ? (
                    <ConfirmButton className="btn ghost small" onConfirm={() => cancel(b)}>
                      {b.status === 'pending' ? 'Træk forespørgsel tilbage' : 'Aflys tiden'}
                    </ConfirmButton>
                  ) : (
                    <p className="note small">
                      Der er under {settings?.cancel_hours ?? 24} timer til din tid. Ring for at aflyse{settings?.phone ? <>: <a href={`tel:${settings.phone.replace(/\s/g, '')}`}>{settings.phone}</a></> : '.'}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section className="stack-sm">
          <h2>Historik</h2>
          <ul className="cards">
            {history.map((b) => (
              <li key={b.id} className={`card stack-sm ${b.status === 'cancelled' || b.status === 'declined' ? 'faded' : ''}`}>
                <div className="row-between">
                  <div>
                    <strong>{b.service_name}</strong>
                    <p className="muted small">{fmtDateYear(b.starts_at)} · {fmtTime(b.starts_at)}</p>
                  </div>
                  <StatusPill status={b.status === 'confirmed' ? 'completed' : b.status} />
                </div>
                {photosBy[b.id] && <PhotoGrid photos={photosBy[b.id]} onOpen={setPhoto} />}
              </li>
            ))}
          </ul>
        </section>
      )}
      {photo && <Lightbox photo={photo} onClose={() => setPhoto(null)} />}
    </div>
  );
}
