import { useState } from 'react';
import { supabase, must, niceError } from '../lib/supabase';
import { useLoad } from '../lib/hooks';
import { uploadBookingPhoto, deletePhoto, usePhotoUrls } from '../lib/photos';
import { ConfirmButton, useToast } from './ui';
import { IconCamera, IconClose } from './icons';

export function PhotoGrid({ photos, onOpen }) {
  const urls = usePhotoUrls(photos.map((p) => p.path));
  return (
    <div className="photos">
      {photos.map((p) => (
        <button key={p.id} className="photo" onClick={() => onOpen(p)} aria-label="Vis billede">
          {urls[p.path] ? <img src={urls[p.path]} alt="" loading="lazy" /> : <span className="photo-ph" />}
        </button>
      ))}
    </div>
  );
}

export function Lightbox({ photo, onClose, onDelete }) {
  const urls = usePhotoUrls([photo.path]);
  return (
    <div className="lightbox" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button className="icon-btn lb-close" onClick={onClose} aria-label="Luk"><IconClose /></button>
      {urls[photo.path] ? <img src={urls[photo.path]} alt="Billede af behandling" /> : <p className="muted">Henter billede…</p>}
      {onDelete && (
        <div className="lb-actions">
          <ConfirmButton onConfirm={onDelete}>Slet billede</ConfirmButton>
        </div>
      )}
    </div>
  );
}

/** Billeder til én booking. Admin kan tilføje og slette, kunden kan kun se. */
export function PhotoSection({ booking, editable, consent }) {
  const toast = useToast();
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data: photos, reload } = useLoad(
    async () => must(await supabase.from('booking_photos').select('*').eq('booking_id', booking.id).order('created_at')),
    [booking.id],
  );
  const list = photos || [];

  async function onFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) await uploadBookingPhoto(booking, f);
      toast(files.length === 1 ? 'Billedet er gemt' : `${files.length} billeder er gemt`);
      reload();
    } catch (err) {
      toast(niceError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!editable && !list.length) return null;
  return (
    <div className="stack-sm">
      <div className="row-between">
        <h3>Billeder</h3>
        {editable && booking.customer_id && (
          <label className={`btn small gold ${busy ? 'disabled' : ''}`}>
            <IconCamera /> {busy ? 'Gemmer…' : 'Tilføj'}
            <input type="file" accept="image/*" multiple hidden onChange={onFiles} disabled={busy} />
          </label>
        )}
      </div>
      {editable && consent === false && (
        <p className="note warn">Kunden har ikke givet samtykke til billeder. Spørg før du tager billeder.</p>
      )}
      {list.length ? (
        <PhotoGrid photos={list} onOpen={setOpen} />
      ) : (
        <p className="muted small">Ingen billeder endnu.</p>
      )}
      {open && (
        <Lightbox
          photo={open}
          onClose={() => setOpen(null)}
          onDelete={
            editable
              ? async () => {
                  try { await deletePhoto(open); setOpen(null); reload(); toast('Billedet er slettet'); }
                  catch (err) { toast(niceError(err)); }
                }
              : null
          }
        />
      )}
    </div>
  );
}
