import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { IconBack, IconClose } from './icons';
import { STATUS } from '../lib/format';

/* ---------- Toast ---------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const t = useRef();
  const show = useCallback((m) => {
    setMsg(m);
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- App-skal: header + bundmenu ---------- */
export function AppShell({ tabs, right, children }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-in">
          <Logo size="sm" />
          <div className="topbar-right">{right}</div>
        </div>
      </header>
      <main className="page">{children}</main>
      <nav className="tabbar" aria-label="Menu">
        <div className="tabbar-in" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className="tab">
              <t.icon />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageTitle({ eyebrow, title, back, right }) {
  const nav = useNavigate();
  return (
    <div className="page-title">
      {back && (
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Tilbage">
          <IconBack />
        </button>
      )}
      <div className="grow">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {right}
    </div>
  );
}

/* ---------- Bundark (modal) ---------- */
export function Sheet({ title, sub, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <div className="sheet-head">
          <div className="grow">
            {sub && <p className="eyebrow">{sub}</p>}
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Luk">
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Små byggeklodser ---------- */
export const Spinner = ({ label = 'Henter…' }) => (
  <div className="loading"><span className="dot-pulse" /> {label}</div>
);

export function LoadError({ error, onRetry }) {
  return (
    <div className="empty">
      <p>Kunne ikke hente data. {error?.message ? `(${error.message})` : ''}</p>
      {onRetry && <button className="btn small" onClick={onRetry}>Prøv igen</button>}
    </div>
  );
}

export function Empty({ children, action }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

export const StatusPill = ({ status }) => {
  const s = STATUS[status] || { label: status, cls: 'muted' };
  return <span className={`pill ${s.cls}`}>{s.label}</span>;
};

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Knap der skal trykkes to gange (bruges til sletning og aflysning). */
export function ConfirmButton({ children, confirmText = 'Tryk igen for at bekræfte', onConfirm, className = 'btn danger', disabled }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className} ${armed ? 'armed' : ''}`}
      disabled={disabled || busy}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
      }}
    >
      {armed ? confirmText : children}
    </button>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function SubNav({ items }) {
  return (
    <div className="seg">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end className="seg-item">{i.label}</NavLink>
      ))}
    </div>
  );
}
