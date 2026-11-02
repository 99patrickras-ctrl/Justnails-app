// Alt vises i dansk tid, uanset hvor telefonen står indstillet.
export const TZ = 'Europe/Copenhagen';

const krFmt = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 });
export const kr = (n) => krFmt.format(Math.round(Number(n) || 0));

export const num = (v) => {
  let t = String(v ?? '').replace(/\s|kr\.?/gi, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (opts) => new Intl.DateTimeFormat('da-DK', { timeZone: TZ, ...opts });
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const fmtTime = (ts) => fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
export const fmtDateLong = (ts) => cap(fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ts)));
export const fmtDateShort = (ts) => fmt({ day: 'numeric', month: 'short' }).format(new Date(ts));
export const fmtDateYear = (ts) => fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ts));

/** 'YYYY-MM-DD' for et tidspunkt, i dansk tid */
export const dayKey = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ts));
export const todayKey = () => dayKey(Date.now());

/** Visning af en ren dato-streng 'YYYY-MM-DD' (uden tidszone-forskydning) */
const keyToNoon = (key) => new Date(key + 'T12:00:00Z');
export const keyLong = (key) => fmtDateLong(keyToNoon(key));
export const keyShort = (key) => fmtDateShort(keyToNoon(key));
export const keyWeekdayShort = (key) => fmt({ weekday: 'short' }).format(keyToNoon(key)).replace('.', '');
export const keyMonthTitle = (key) => cap(fmt({ month: 'long', year: 'numeric' }).format(keyToNoon(key)));

export function addDays(key, n) {
  const d = new Date(key + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function addMonths(monthKey, n) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
/** 0 = mandag ... 6 = søndag */
export const weekdayIndex = (key) => (new Date(key + 'T12:00:00Z').getUTCDay() + 6) % 7;

function tzOffsetMin(utcMs) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]),
  );
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs) / 60000;
}

/** Dansk dato + klokkeslæt → ISO-tidspunkt (UTC) til databasen */
export function localToISO(key, time = '00:00') {
  const [y, m, d] = key.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - tzOffsetMin(guess) * 60000;
  const off2 = tzOffsetMin(utc);
  utc = guess - off2 * 60000;
  return new Date(utc).toISOString();
}

/** Start og slut (ISO) for en måned 'YYYY-MM' i dansk tid */
export const monthBounds = (monthKey) => [localToISO(monthKey + '-01'), localToISO(addMonths(monthKey, 1) + '-01')];

export const hhmm = (t) => String(t || '').slice(0, 5);

export const STATUS = {
  pending: { label: 'Afventer', cls: 'pending' },
  confirmed: { label: 'Bekræftet', cls: 'confirmed' },
  completed: { label: 'Gennemført', cls: 'completed' },
  declined: { label: 'Afvist', cls: 'muted' },
  cancelled: { label: 'Aflyst', cls: 'muted' },
};

export const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
export const initials = (n) =>
  String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
