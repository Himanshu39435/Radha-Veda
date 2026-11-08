import { useEffect, useState } from 'react';
import Img from '../../components/Img';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useAction, useFetch } from '../../lib/hooks';
import { Badge, Button, Card, Empty, Input, Modal, Spinner } from '../../components/ui';
import ProductCard from '../../components/ProductCard';
import Timeline from '../../components/Timeline';
import { cn, date, dateTime, money } from '../../lib/utils';
import { payOnline } from '../../lib/razorpay';
import { useSettings } from '../../components/ShopLayout';
import { WhatsAppIcon } from '../../components/WhatsAppButton';
import { waLink } from '../../lib/whatsapp';

export function Profile() {
  const auth = useAuth(); const [f, setF] = useState({ name: auth.user.name, phone: auth.user.phone || '' }); const [pw, setPw] = useState({ currentPassword: '', newPassword: '' }); const [act, busy] = useAction();
  return (<div className="grid gap-5 md:grid-cols-2">
    <Card><form className="space-y-4" onSubmit={e => { e.preventDefault(); act(async () => auth.update((await api().put('/auth/me', { name: f.name, phone: f.phone || undefined })).user), 'Profile saved'); }}><h2 className="text-2xl font-semibold">Profile</h2><Input label="Email" value={auth.user.email} disabled /><Input required label="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /><Input label="Mobile" pattern="[6-9][0-9]{9}" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /><Button loading={busy}>Save changes</Button></form></Card>
    <Card><form className="space-y-4" onSubmit={e => { e.preventDefault(); act(async () => { await api().put('/auth/change-password', pw); setPw({ currentPassword: '', newPassword: '' }); }, 'Password changed'); }}><h2 className="text-2xl font-semibold">Change password</h2><Input required type="password" label="Current password" value={pw.currentPassword} onChange={e => setPw({ ...pw, currentPassword: e.target.value })} /><Input required minLength={8} type="password" label="New password" value={pw.newPassword} onChange={e => setPw({ ...pw, newPassword: e.target.value })} /><Button loading={busy}>Update password</Button></form></Card></div>);
}
const blank = { name: '', phone: '', line1: '', state: '', city: '', pincode: '', isDefault: false };
export function Addresses() {
  const { data, loading, reload } = useFetch(() => api().get('/addresses'), []); const [m, setM] = useState(null); const [act, busy] = useAction();
  const on = k => e => setM({ ...m, [k]: e.target.value });
  const save = e => { e.preventDefault(); const { _id, user, createdAt, updatedAt, __v, ...b } = m; act(async () => { _id ? await api().put(`/addresses/${_id}`, b) : await api().post('/addresses', b); setM(null); reload(); }, 'Address saved'); };
  return (<div><div className="mb-4 flex justify-between"><h2 className="text-2xl font-semibold">Saved addresses</h2><Button size="sm" onClick={() => setM(blank)}>Add address</Button></div>
    {loading ? <Spinner /> : !data.length ? <Empty title="No saved addresses" /> : <div className="grid gap-3 sm:grid-cols-2">{data.map(a => <Card key={a._id}><p className="font-semibold">{a.name} {a.isDefault && <Badge className="bg-sage-light text-sage-dark">Default</Badge>}</p><p className="text-sm">{a.line1}, {a.city}, {a.state} - {a.pincode}</p><p className="text-sm text-earth-light">{a.phone}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => setM(a)}>Edit</Button><Button size="sm" variant="ghost" aria-label="Delete" onClick={() => act(async () => { await api().del(`/addresses/${a._id}`); reload(); }, 'Address removed')}><Trash2 className="h-4 w-4" /></Button></div></Card>)}</div>}
    <Modal open={!!m} onClose={() => setM(null)} title={m?._id ? 'Edit address' : 'New address'}>{m && <form onSubmit={save} className="space-y-3"><Input required label="Name" value={m.name} onChange={on('name')} /><Input required label="Phone" pattern="[6-9][0-9]{9}" value={m.phone} onChange={on('phone')} /><Input required label="Address" minLength={5} value={m.line1} onChange={on('line1')} /><div className="grid grid-cols-3 gap-2"><Input required label="State" value={m.state} onChange={on('state')} /><Input required label="City" value={m.city} onChange={on('city')} /><Input required label="Pincode" pattern="[0-9]{6}" value={m.pincode} onChange={on('pincode')} /></div><label className="flex gap-2 text-sm"><input type="checkbox" checked={!!m.isDefault} onChange={e => setM({ ...m, isDefault: e.target.checked })} />Make default</label><Button loading={busy} className="w-full">Save address</Button></form>}</Modal></div>);
}
export function Orders() {
  const { data, loading } = useFetch(() => api().get('/orders'), []);
  if (loading) return <Spinner />; if (!data.length) return <Empty title="No orders yet"><Link to="/shop"><Button>Start shopping</Button></Link></Empty>;
  return <div className="space-y-3"><h2 className="text-2xl font-semibold">Order history</h2>{data.map(o => <Link key={o._id} to={`/account/orders/${o._id}`} className="block"><Card className="flex flex-wrap items-center justify-between gap-2 hover:shadow-md"><div><p className="font-semibold">{o.orderId}</p><p className="text-sm text-earth-light">{date(o.createdAt)} · {o.items.length} item(s)</p></div><div className="flex items-center gap-3"><Badge>{o.status}</Badge><b>{money(o.total)}</b></div></Card></Link>)}</div>;
}
export function OrderDetail() {
  const { id } = useParams(); const { data: o, loading, reload } = useFetch(() => api().get(`/orders/${id}`), [id]); const [act, busy] = useAction();
  const { data: settings } = useSettings(); const waiting = !!o?.awaitingPayment;
  // While an online payment is pending, re-check for a few minutes so the webhook confirmation shows up without a manual refresh
  useEffect(() => { if (!waiting) return; let n = 0; const t = setInterval(() => { if (++n > 36) return clearInterval(t); reload(); }, 5000); return () => clearInterval(t); }, [waiting]); // eslint-disable-line
  const retry = () => act(async () => { const r = await api().post(`/payments/retry/${o._id}`); await payOnline({ razorpay: r.razorpay, prefill: { name: o.shippingAddress.name, email: o.shippingAddress.email, contact: o.shippingAddress.phone }, onVerified: () => { toast.success('Payment successful'); reload(); }, onPending: () => { toast('Confirming your payment…'); reload(); }, onDismiss: () => toast('Payment not completed'), onFailed: (m) => toast.error(m) }); });
  if (loading && !o) return <Spinner />; if (!o) return null; const a = o.shippingAddress; const cancellable = ['Pending', 'Confirmed'].includes(o.status);
  return (<div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-2xl font-semibold">Order {o.orderId}</h2><p className="text-sm text-earth-light">Placed {date(o.createdAt)}</p></div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-earth-light">Order</span><Badge>{o.status}</Badge><span className="text-xs text-earth-light">Payment</span><Badge>{o.paymentStatus}</Badge></div></div>
    {o.awaitingPayment && <Card className="border-amber-300 bg-amber-50"><p className="font-semibold">{o.paymentStatus === 'Failed' ? 'Your last payment attempt failed.' : 'Payment is not confirmed yet.'}</p><p className="mt-1 text-sm">If you have already paid, this page updates automatically within a minute. Otherwise complete payment before {dateTime(o.paymentExpiresAt)}, after which the order is released.</p><Button className="mt-3" loading={busy} onClick={retry}>Complete payment</Button></Card>}
    {o.tracking?.trackingNumber && <Card className="text-sm"><b>Shipment</b><p>{o.tracking.courier} · Tracking no. {o.tracking.trackingNumber}</p>{o.tracking.trackingUrl && <a className="mt-1 inline-block font-semibold text-sage-dark underline" href={o.tracking.trackingUrl} target="_blank" rel="noopener noreferrer">Track shipment</a>}</Card>}
    <Card><h3 className="mb-3 text-xl font-semibold">Tracking</h3><Timeline order={o} /></Card>
    <Card><h3 className="mb-3 text-xl font-semibold">Items</h3>{o.items.map((i, k) => <div key={k} className="flex items-center gap-3 border-b border-beige py-2 last:border-0"><Img src={i.image} alt="" className="h-14 w-14 rounded-lg object-cover" /><p className="flex-1 text-sm">{i.name}<br /><span className="text-earth-light">{i.weight} × {i.quantity}</span></p><b>{money(i.price * i.quantity)}</b></div>)}
      <div className="mt-3 space-y-1 text-sm text-right"><p>Subtotal {money(o.subtotal)}</p>{o.discount > 0 && <p>Discount -{money(o.discount)}</p>}<p>Shipping {o.shipping ? money(o.shipping) : 'Free'}</p><p className="text-lg font-bold">Total {money(o.total)}</p></div></Card>
    <Card className="text-sm"><b>Delivering to</b><p>{a.name}, {a.line1}, {a.city}, {a.state} - {a.pincode} · {a.phone}</p><p className="mt-1">Payment: {o.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online (Razorpay)'}</p></Card>
    {settings?.whatsapp && <a href={waLink(settings.whatsapp, `Hi! I need help with my order ${o.orderId} (status: ${o.status}).`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-white hover:brightness-95"><WhatsAppIcon className="h-5 w-5" />Need help with this order? Chat on WhatsApp</a>}
    <div className="flex flex-wrap gap-2">{cancellable && <Button variant="danger" loading={busy} onClick={() => confirm('Cancel this order?') && act(async () => { await api().post(`/orders/${o._id}/cancel`, { reason: 'Cancelled by customer' }); reload(); }, 'Order cancelled')}>Cancel order</Button>}
      {o.status === 'Delivered' && o.items.map((i, k) => <Link key={k} to={`/shop`}><Button variant="outline" size="sm">Review {i.name}</Button></Link>)}</div></div>);
}
export function Wishlist() {
  const { data, loading, reload } = useFetch(() => api().get('/wishlist'), []);
  if (loading) return <Spinner />; if (!data.length) return <Empty title="Your wishlist is empty" />;
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{data.map(p => <div key={p._id}><ProductCard p={p} />
    <button className="mt-1 w-full text-center text-xs underline" onClick={async () => { await api().del(`/wishlist/${p._id}`); reload(); }}>Remove</button></div>)}</div>;
}
