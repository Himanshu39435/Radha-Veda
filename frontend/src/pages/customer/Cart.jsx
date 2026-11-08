import { useEffect, useState } from 'react';
import Img from '../../components/Img';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../../context/CartContext';
import { api } from '../../lib/api';
import { Button, Card, Empty, Input } from '../../components/ui';
import { money } from '../../lib/utils';

// Server quote = source of truth for totals, shipping and coupon
export function useQuote() {
  const { payload, coupon, setCoupon } = useCart(); const [q, setQ] = useState(null); const [err, setErr] = useState(''); const [couponErr, setCouponErr] = useState('');
  const key = JSON.stringify(payload) + coupon;
  useEffect(() => { if (coupon) setCouponErr(''); }, [coupon]);
  useEffect(() => { if (!payload.length) return setQ(null); let live = true;
    api().post('/cart/quote', { items: payload, couponCode: coupon || undefined }).then(r => { if (live) { setQ(r); setErr(''); } }).catch(e => {
      if (!live) return;
      if (coupon) { setCouponErr(e.message); setCoupon(''); } // keep the reason visible after dropping the bad coupon
      else setErr(e.message); });
    return () => { live = false; }; }, [key]); // eslint-disable-line
  return { q, err: err || couponErr };
}
export const Summary = ({ q, children }) => q && (
  <div className="space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(q.subtotal)}</span></div>
    {q.discount > 0 && <div className="flex justify-between text-sage-dark"><span>Discount {q.couponCode && `(${q.couponCode})`}</span><span>-{money(q.discount)}</span></div>}
    <div className="flex justify-between"><span>Shipping</span><span>{q.shipping ? money(q.shipping) : 'Free'}</span></div>
    <div className="flex justify-between border-t border-beige-dark pt-3 text-lg font-bold"><span>Total</span><span>{money(q.total)}</span></div>{children}</div>
);

export default function Cart() {
  const { items, setQty, remove, coupon, setCoupon } = useCart(); const { q, err } = useQuote(); const [code, setCode] = useState('');
  if (!items.length) return <div className="container-x py-10"><Empty title="Your cart is empty" hint="Add something your skin will love."><Link to="/shop"><Button>Continue shopping</Button></Link></Empty></div>;
  return (
    <div className="container-x py-8"><h1 className="mb-6 text-4xl font-semibold sm:text-5xl">Your cart</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">{items.map(i => (
          <Card key={i.variantId} className="flex gap-4"><Img src={i.image} alt="" className="h-24 w-24 rounded-xl object-cover" />
            <div className="flex-1"><Link to={`/product/${i.slug}`} className="font-medium">{i.name}</Link><p className="text-sm text-earth-light">{i.weight}</p><p className="mt-1 font-bold">{money(q?.items.find(x => x.variant === i.variantId)?.price ?? i.price)}</p>
              <div className="mt-2 flex items-center gap-3"><div className="flex items-center rounded-full border border-earth/30"><button aria-label="Decrease" className="grid h-10 w-10 place-items-center" onClick={() => setQty(i.variantId, i.quantity - 1)}><Minus className="h-4 w-4" /></button><span className="w-7 text-center text-sm font-semibold">{i.quantity}</span><button aria-label="Increase" className="grid h-10 w-10 place-items-center" onClick={() => setQty(i.variantId, i.quantity + 1)}><Plus className="h-4 w-4" /></button></div>
                <button aria-label="Remove" className="rounded-full p-2 text-red-700 hover:bg-red-50" onClick={() => remove(i.variantId)}><Trash2 className="h-5 w-5" /></button></div></div></Card>))}
          <Link to="/shop" className="inline-block text-sm font-semibold underline">Continue shopping</Link></div>
        <Card className="h-fit space-y-4"><h2 className="text-2xl font-semibold">Order summary</h2>
          {coupon ? <div className="flex items-center justify-between rounded-xl bg-sage-light px-3 py-2 text-sm"><span>Coupon <b>{coupon}</b> applied</span><button className="underline" onClick={() => setCoupon('')}>Remove</button></div> :
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (code) { setCoupon(code.toUpperCase()); setCode(''); } }}><input className="field" value={code} onChange={e => setCode(e.target.value)} placeholder="Coupon code" aria-label="Coupon code" /><Button variant="soft">Apply</Button></form>}
          {err && <p className="text-sm text-red-700">{err}</p>}
          <Summary q={q} />
          <Link to="/checkout"><Button className="w-full" disabled={!q}>Proceed to checkout</Button></Link></Card>
      </div></div>
  );
}
