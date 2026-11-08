import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/ui';
export default function PanelLogin({ panel }) {
  const auth = useAuth(panel); const nav = useNavigate(); const [f, setF] = useState({ email: '', password: '' }); const [busy, setBusy] = useState(false);
  if (auth.user) return <Navigate to={`/${panel}`} replace />;
  const go = async (e) => { e.preventDefault(); setBusy(true); try { await auth.login(f); nav(`/${panel}`, { replace: true }); } catch (er) { toast.error(er.message); setBusy(false); } };
  return (<div className="grid min-h-screen place-items-center bg-earth-dark p-4"><form onSubmit={go} className="w-full max-w-sm space-y-4 rounded-3xl bg-cream p-7">
    <div className="flex items-center gap-2"><Leaf className="h-7 w-7 text-sage-dark" /><div><p className="font-display text-3xl font-bold leading-none">Radha Veda</p><p className="text-sm text-earth-light">{panel === 'admin' ? 'Admin sign in' : 'Staff sign in'}</p></div></div>
    <Input required type="email" label="Email" autoComplete="username" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /><Input required type="password" label="Password" autoComplete="current-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /><Button loading={busy} className="w-full">Sign in</Button></form></div>);
}
