import { useEffect, useState } from 'react';
import { supabase, must } from './supabase';

const BUCKET = 'photos';

/** Gør billedet mindre før upload (max 1600 px), så de 1 GB gratis plads rækker langt. */
export function compressImage(file, maxSide = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Billedet kunne ikke læses.'))), 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Billedformatet kan ikke bruges. Prøv et andet billede.'));
    };
    img.src = url;
  });
}

export async function uploadBookingPhoto(booking, file) {
  if (!booking.customer_id) throw new Error('Bookingen har ingen kunde.');
  const blob = await compressImage(file);
  const path = `${booking.customer_id}/${booking.id}/${crypto.randomUUID()}.jpg`;
  must(await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
  const { error } = await supabase
    .from('booking_photos')
    .insert({ booking_id: booking.id, customer_id: booking.customer_id, path });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function deletePhoto(photo) {
  must(await supabase.storage.from(BUCKET).remove([photo.path]));
  must(await supabase.from('booking_photos').delete().eq('id', photo.id));
}

export async function deleteCustomerFolder(customerId) {
  const { data: rows } = await supabase.from('booking_photos').select('path').eq('customer_id', customerId);
  const paths = (rows || []).map((r) => r.path);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

const cache = new Map(); // path -> { url, exp }

/** Midlertidige links til private billeder (gyldige i en time). */
export function usePhotoUrls(paths) {
  const key = paths.join('|');
  const [urls, setUrls] = useState({});
  useEffect(() => {
    let alive = true;
    const now = Date.now();
    const known = {};
    const missing = [];
    for (const p of paths) {
      const c = cache.get(p);
      if (c && c.exp > now) known[p] = c.url;
      else missing.push(p);
    }
    setUrls(known);
    if (!missing.length) return;
    supabase.storage
      .from(BUCKET)
      .createSignedUrls(missing, 3600)
      .then(({ data }) => {
        if (!alive || !data) return;
        const next = { ...known };
        for (const r of data) {
          if (r.signedUrl) {
            next[r.path] = r.signedUrl;
            cache.set(r.path, { url: r.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
          }
        }
        setUrls(next);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}
