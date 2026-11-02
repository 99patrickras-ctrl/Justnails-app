import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);

  const loadUser = useCallback(async (sess) => {
    if (!sess) {
      setRole(null);
      setCustomer(null);
      setLoading(false);
      return;
    }
    const uid = sess.user.id;
    const [{ data: prof }, { data: cust }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', uid).maybeSingle(),
      supabase.from('customers').select('*').eq('user_id', uid).maybeSingle(),
    ]);
    setRole(prof?.role || 'customer');
    setCustomer(cust || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadUser(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'TOKEN_REFRESHED') { setSession(sess); return; }
      setSession(sess);
      // Supabase anbefaler ikke at kalde databasen direkte inde i denne callback
      setTimeout(() => loadUser(sess), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadUser]);

  const value = {
    session,
    user: session?.user || null,
    role,
    isAdmin: role === 'admin',
    customer,
    loading,
    recovery,
    endRecovery: () => setRecovery(false),
    refreshCustomer: () => loadUser(session),
    signOut: async () => {
      await supabase.auth.signOut();
      setSession(null);
      setRole(null);
      setCustomer(null);
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
