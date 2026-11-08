import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth, useAuthRoot } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Button, Card, Input } from '../../components/ui';

const Shell = ({ title, children }) => <div className="container-x grid place-items-center py-12"><Card className="w-full max-w-md p-6 sm:p-8"><h1 className="mb-5 text-4xl font-semibold">{title}</h1>{children}</Card></div>;
export function Login() {
  const root = useAuthRoot(); const nav = useNavigate(); const loc = useLocation(); const [f, setF] = useState({ email: '', password: '' }); const [busy, setBusy] = useState(false);
  if (root.customer.user) return <Navigate to={loc.state?.from || '/account'} replace />;
  const home = (role) => (role === 'admin' ? '/admin' : role === 'staff' ? '/staff' : loc.state?.from || '/account');
  const go = async (e) => { e.preventDefault(); setBusy(true); try { const r = await root.any.login(f); nav(home(r.user.role), { replace: true }); } catch (er) { toast.error(er.message); setBusy(false); } };
  return <Shell title="Welcome back"><form onSubmit={go} className="space-y-4"><p className="-mt-3 text-sm text-earth-light">Customers, staff and admins all sign in here.</p><Input required type="email" label="Email" autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /><Input required type="password" label="Password" autoComplete="current-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /><Button loading={busy} className="w-full">Log in</Button>
    <p className="text-center text-sm"><Link className="underline" to="/forgot-password">Forgot password?</Link> · <Link className="underline" to="/register">Create account</Link></p></form></Shell>;
}
export function Register() {
  const auth = useAuth(); const nav = useNavigate(); const [f, setF] = useState({ name: '', email: '', phone: '', password: '' }); const [busy, setBusy] = useState(false);
  const go = async (e) => { e.preventDefault(); setBusy(true); try { await auth.login({ ...f, phone: f.phone || undefined }, '/auth/register'); toast.success('Welcome to Radha Veda'); nav('/account'); } catch (er) { toast.error(er.message); setBusy(false); } };
  const on = k => e => setF({ ...f, [k]: e.target.value });
  return <Shell title="Create account"><form onSubmit={go} className="space-y-4"><Input required label="Full name" value={f.name} onChange={on('name')} /><Input required type="email" label="Email" value={f.email} onChange={on('email')} /><Input label="Mobile (optional)" inputMode="numeric" pattern="[6-9][0-9]{9}" value={f.phone} onChange={on('phone')} /><Input required minLength={8} type="password" label="Password (8+ characters)" value={f.password} onChange={on('password')} /><Button loading={busy} className="w-full">Create account</Button><p className="text-center text-sm">Already registered? <Link className="underline" to="/login">Log in</Link></p></form></Shell>;
}
export function Forgot() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  const go = async (e) => { e.preventDefault(); setBusy(true); try { await api().post('/auth/forgot-password', { email }); setDone(true); } catch (er) { toast.error(er.message); } finally { setBusy(false); } };
  return <Shell title="Reset password">{done ? <p>If that email is registered, a reset link is on its way. It works for 30 minutes.</p> : <form onSubmit={go} className="space-y-4"><Input required type="email" label="Email" value={email} onChange={e => setEmail(e.target.value)} /><Button loading={busy} className="w-full">Send reset link</Button></form>}</Shell>;
}
export function Reset() {
  const { token } = useParams(); const nav = useNavigate(); const [password, setP] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e) => { e.preventDefault(); setBusy(true); try { await api().post(`/auth/reset-password/${token}`, { password }); toast.success('Password updated. Log in now.'); nav('/login'); } catch (er) { toast.error(er.message); setBusy(false); } };
  return <Shell title="Choose a new password"><form onSubmit={go} className="space-y-4"><Input required minLength={8} type="password" label="New password" value={password} onChange={e => setP(e.target.value)} /><Button loading={busy} className="w-full">Update password</Button></form></Shell>;
}
