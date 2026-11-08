import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
const Ctx = createContext(null); export const useCart = () => useContext(Ctx);
const load = () => { try { return JSON.parse(localStorage.getItem('rv_cart')) || []; } catch { return []; } };
// Only IDs/quantities are trusted as intent; the server re-prices everything at checkout.
export function CartProvider({ children }) {
  const [items, setItems] = useState(load);
  const [coupon, setCoupon] = useState('');
  useEffect(() => localStorage.setItem('rv_cart', JSON.stringify(items)), [items]);
  const add = (item, qty = 1) => {
    setItems(p => { const i = p.find(x => x.variantId === item.variantId); const q = Math.min((i?.quantity || 0) + qty, item.stock, 20);
      return i ? p.map(x => x.variantId === item.variantId ? { ...x, ...item, quantity: q } : x) : [...p, { ...item, quantity: Math.min(qty, item.stock, 20) }]; });
    toast.success('Added to cart');
  };
  const setQty = (id, q) => setItems(p => p.map(x => x.variantId === id ? { ...x, quantity: Math.max(1, Math.min(q, x.stock, 20)) } : x));
  const remove = (id) => setItems(p => p.filter(x => x.variantId !== id));
  const clear = () => { setItems([]); setCoupon(''); };
  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const payload = useMemo(() => items.map(i => ({ variantId: i.variantId, quantity: i.quantity })), [items]);
  return <Ctx.Provider value={{ items, add, setQty, remove, clear, count, coupon, setCoupon, payload }}>{children}</Ctx.Provider>;
}
