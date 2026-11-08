import { createContext, useContext, useEffect, useState } from 'react';
import { api, getSession, setSession } from '../lib/api';
const Ctx = createContext(null);
export const useAuth = (panel = 'customer') => useContext(Ctx)[panel];
export const useAuthRoot = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [s, setS] = useState({ customer: getSession('customer'), admin: getSession('admin'), staff: getSession('staff') });
  useEffect(() => { const f = () => setS({ customer: getSession('customer'), admin: getSession('admin'), staff: getSession('staff') }); window.addEventListener('rv-logout', f); return () => window.removeEventListener('rv-logout', f); }, []);
  const make = (panel, loginPath) => ({
    user: s[panel]?.user || null,
    login: async (body, path = loginPath) => { const r = await api(panel).post(path, body); setSession(panel, r); setS(p => ({ ...p, [panel]: r })); return r; },
    logout: () => { setSession(panel, null); setS(p => ({ ...p, [panel]: null })); },
    update: (user) => { const n = { ...s[panel], user }; setSession(panel, n); setS(p => ({ ...p, [panel]: n })); },
  });
  // One login for everyone: the server says which role signed in, and the session is stored for that panel
  const any = { login: async (body) => { const r = await api('customer').post('/auth/login', body); const panel = r.user.role; setSession(panel, r); setS(p => ({ ...p, [panel]: r })); return r; } };
  const value = { any, customer: make('customer', '/auth/login'), admin: make('admin', '/auth/admin-login'), staff: make('staff', '/auth/staff-login') };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
