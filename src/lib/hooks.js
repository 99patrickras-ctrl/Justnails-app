import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Henter data og henter igen, når appen kommer i forgrunden igen
 * (fx når mor åbner telefonen og der er kommet nye bookinger).
 */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    try {
      const data = await fnRef.current();
      setState({ data, error: null, loading: false });
    } catch (error) {
      console.error(error);
      setState((s) => ({ ...s, error, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    reload();
  }, [reload]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  return { ...state, reload };
}

export function useLocalState(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s == null ? initial : JSON.parse(s);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
  }, [key, v]);
  return [v, setV];
}
