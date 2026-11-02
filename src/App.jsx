import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { configured } from './lib/supabase';
import { useAuth } from './lib/auth';
import Logo from './components/Logo';
import { AppShell, Spinner } from './components/ui';
import { IconBook, IconBottle, IconCalendar, IconChart, IconHome, IconList, IconSettings, IconUser, IconUsers } from './components/icons';
import Login from './pages/auth/Login';
import ResetPassword from './pages/auth/ResetPassword';
import Privacy from './pages/Privacy';
import MyBookings from './pages/customer/MyBookings';
import Book from './pages/customer/Book';
import Profile from './pages/customer/Profile';
import Dashboard from './pages/admin/Dashboard';
import Calendar from './pages/admin/Calendar';
import { CustomerList, CustomerDetail } from './pages/admin/Customers';
import Inventory from './pages/admin/Inventory';
import Economy from './pages/admin/Economy';
import Settings from './pages/admin/Settings';

const ADMIN_TABS = [
  { to: '/admin', end: true, label: 'Overblik', icon: IconHome },
  { to: '/admin/kalender', label: 'Kalender', icon: IconCalendar },
  { to: '/admin/kunder', label: 'Kunder', icon: IconUsers },
  { to: '/admin/lager', label: 'Lager', icon: IconBottle },
  { to: '/admin/okonomi', label: 'Økonomi', icon: IconChart },
];
const CUSTOMER_TABS = [
  { to: '/', end: true, label: 'Mine tider', icon: IconList },
  { to: '/book', label: 'Book tid', icon: IconBook },
  { to: '/profil', label: 'Profil', icon: IconUser },
];

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  if (!configured) return <NotConfigured />;
  return (
    <>
      <ScrollTop />
      <Gate />
    </>
  );
}

function Gate() {
  const { session, loading, isAdmin, customer, recovery, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (recovery && loc.pathname !== '/nulstil-adgangskode') nav('/nulstil-adgangskode', { replace: true });
  }, [recovery, loc.pathname, nav]);

  if (loading) {
    return (
      <div className="splash">
        <Logo size="lg" />
        <Spinner label="" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/privatliv" element={<Privacy />} />
      <Route path="/nulstil-adgangskode" element={<ResetPassword />} />
      {!session ? (
        <Route path="*" element={<Login />} />
      ) : isAdmin ? (
        <>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </>
      ) : !customer ? (
        <Route path="*" element={
          <div className="auth stack">
            <div className="auth-logo"><Logo size="lg" /></div>
            <p className="muted">Din konto er ikke klar endnu. Log ud og ind igen om et øjeblik. Virker det stadig ikke, så kontakt salonen.</p>
            <button className="btn ghost" onClick={signOut}>Log ud</button>
          </div>
        } />
      ) : (
        <Route path="*" element={<CustomerApp />} />
      )}
    </Routes>
  );
}

function AdminApp() {
  const nav = useNavigate();
  return (
    <AppShell
      tabs={ADMIN_TABS}
      right={<button className="icon-btn" onClick={() => nav('/admin/indstillinger')} aria-label="Indstillinger: salon og ydelser"><IconSettings /></button>}
    >
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="kalender" element={<Calendar />} />
        <Route path="kunder" element={<CustomerList />} />
        <Route path="kunder/:id" element={<CustomerDetail />} />
        <Route path="lager" element={<Inventory />} />
        <Route path="okonomi" element={<Economy />} />
        <Route path="indstillinger" element={<Settings />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AppShell>
  );
}

function CustomerApp() {
  return (
    <AppShell tabs={CUSTOMER_TABS}>
      <Routes>
        <Route index element={<MyBookings />} />
        <Route path="book" element={<Book />} />
        <Route path="profil" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function NotConfigured() {
  return (
    <div className="auth stack">
      <div className="auth-logo"><Logo size="lg" /></div>
      <h2>Appen mangler sin database</h2>
      <p className="muted">Sæt VITE_SUPABASE_URL og VITE_SUPABASE_KEY (se docs/OPSAETNING.md, trin 5) og byg appen igen.</p>
    </div>
  );
}
