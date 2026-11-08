import { useEffect, useRef, useState } from 'react';
import Img from '../../components/Img';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Banknote, CreditCard } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { Button, Card, Input, Select } from '../../components/ui';
import { Summary, useQuote } from './Cart';
import { payOnline } from '../../lib/razorpay';
import { cn } from '../../lib/utils';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry'];

export default function Checkout() {
  const { user } = useAuth(); const cart = useCart(); const nav = useNavigate(); const { q, err } = useQuote();
  const { data: saved } = useFetch(() => (user ? api().get('/addresses') : Promise.resolve([])), [user?.id]);
  const [f, setF] = useState({ name: user?.name || '', phone: user?.phone || '', email: user?.email || '', line1: '', state: '', city: '', pincode: '' });
  const orderRef = useRef(null); const placed = useRef(false); // once an order exists, an emptied cart must not bounce us back to /cart
  const [pay, setPay] = useState('COD'); const [busy, setBusy] = useState(false); const [save, setSave] = useState(false);
  useEffect(() => { const d = saved?.find(a => a.isDefault) || saved?.[0]; if (d) setF(p => ({ ...p, name: d.name, phone: d.phone, line1: d.line1, state: d.state, city: d.city, pincode: d.pincode })); }, [saved]);
  if (!user) return <Navigate to="/login" state={{ from: '/checkout' }} replace />;
  if (!cart.items.length && !placed.current) return <Navigate to="/cart" replace />;
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api().post('/orders', { items: cart.payload, couponCode: cart.coupon || undefined, paymentMethod: pay, address: f });
      if (save) api().post('/addresses', { name: f.name, phone: f.phone, line1: f.line1, state: f.state, city: f.city, pincode: f.pincode, isDefault: !saved?.length }).catch(() => {});
      placed.current = true; orderRef.current = r.order._id;
      if (pay === 'COD') { cart.clear(); toast.success('Order placed'); return nav(`/account/orders/${r.order._id}`, { replace: true }); }
      // The order now exists and its stock is reserved, so the cart is cleared. If payment is not completed the
      // customer can retry from the order page; unpaid orders are released automatically after the payment window.
      cart.clear(); const go = () => nav(`/account/orders/${r.order._id}`, { replace: true });
      await payOnline({ razorpay: r.razorpay, prefill: { name: f.name, email: f.email, contact: f.phone },
        onVerified: () => { toast.success('Payment successful'); go(); }, onPending: () => { toast('Confirming your payment…'); go(); },
        onDismiss: () => { toast('Payment not completed. You can finish it from your order page.'); go(); }, onFailed: (m) => toast.error(m) });
    } catch (er) {
      if (orderRef.current) { toast.error(`${er.message} Your order is saved; finish payment from your order page.`); nav(`/account/orders/${orderRef.current}`, { replace: true }); }
      else { toast.error(er.message); setBusy(false); }
    }
  };
  return (
    <form onSubmit={submit} className="container-x grid gap-6 py-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-5"><h1 className="text-4xl font-semibold sm:text-5xl">Checkout</h1>
        <Card className="space-y-4"><h2 className="text-2xl font-semibold">Delivery details</h2>
          {saved?.length > 1 && <Select label="Use a saved address" onChange={e => { const a = saved.find(x => x._id === e.target.value); a && setF({ ...f, name: a.name, phone: a.phone, line1: a.line1, state: a.state, city: a.city, pincode: a.pincode }); }}><option value="">Choose…</option>{saved.map(a => <option key={a._id} value={a._id}>{a.name}, {a.city} {a.pincode}</option>)}</Select>}
          <div className="grid gap-4 sm:grid-cols-2"><Input required label="Full name" value={f.name} onChange={on('name')} /><Input required label="Phone" inputMode="numeric" pattern="[6-9][0-9]{9}" title="10-digit mobile number" value={f.phone} onChange={on('phone')} /></div>
          <Input required type="email" label="Email" value={f.email} onChange={on('email')} />
          <Input required label="Address" minLength={5} value={f.line1} onChange={on('line1')} placeholder="House no., street, area" />
          <div className="grid gap-4 sm:grid-cols-3"><Select required label="State" value={f.state} onChange={on('state')}><option value="">Select</option>{STATES.map(s => <option key={s}>{s}</option>)}</Select><Input required label="City" value={f.city} onChange={on('city')} /><Input required label="Pincode" inputMode="numeric" pattern="[0-9]{6}" title="6-digit pincode" value={f.pincode} onChange={on('pincode')} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#4E5D42]" checked={save} onChange={e => setSave(e.target.checked)} />Save this address</label></Card>
        <Card className="space-y-3"><h2 className="text-2xl font-semibold">Payment</h2>
          {[['COD', Banknote, 'Cash on Delivery', 'Pay when your order arrives'], ['RAZORPAY', CreditCard, 'Pay online', 'UPI, cards, netbanking and wallets via Razorpay']].map(([v, I, t, d]) => (
            <label key={v} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-4', pay === v ? 'border-sage-dark bg-sage-light/50' : 'border-beige-dark')}><input type="radio" className="accent-[#4E5D42]" checked={pay === v} onChange={() => setPay(v)} /><I className="h-6 w-6 text-sage-dark" /><span><b className="block text-sm">{t}</b><span className="text-xs text-earth-light">{d}</span></span></label>))}</Card></div>
      <Card className="h-fit space-y-4 lg:mt-14"><h2 className="text-2xl font-semibold">Order summary</h2>
        <ul className="space-y-3">{cart.items.map(i => <li key={i.variantId} className="flex gap-3 text-sm"><Img src={i.image} alt="" className="h-14 w-14 rounded-lg object-cover" /><span className="flex-1">{i.name}<br /><span className="text-earth-light">{i.weight} × {i.quantity}</span></span></li>)}</ul>
        {err && <p className="text-sm text-red-700">{err}</p>}
        <Summary q={q} /><Button loading={busy} disabled={!q} className="w-full">{pay === 'COD' ? 'Place order' : 'Pay now'}</Button></Card>
    </form>
  );
}
