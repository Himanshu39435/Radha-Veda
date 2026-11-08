import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
export function useFetch(fn, deps = []) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const run = useCallback(async () => { setLoading(true); setError(''); try { setData(await fn()); } catch (e) { setError(e.message); } finally { setLoading(false); } }, deps); // eslint-disable-line
  useEffect(() => { run(); }, [run]);
  return { data, loading, error, reload: run, setData };
}
export const useAction = () => {
  const [busy, setBusy] = useState(false);
  const act = async (fn, ok) => { setBusy(true); try { const r = await fn(); if (ok) toast.success(ok); return r; } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  return [act, busy];
};
