import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Heart, Instagram, Facebook, Leaf, Menu, Phone, Mail, MapPin, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth, useAuthRoot } from '../context/AuthContext';
import { useFetch } from '../lib/hooks';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import WhatsAppButton, { WhatsAppIcon } from './WhatsAppButton';
import { waLink } from '../lib/whatsapp';

export const useSettings = () => useFetch(() => api().get('/settings'), []);
const links = [['/', 'Home'], ['/shop', 'Shop'], ['/shop?filter=bestseller', 'Best sellers'], ['/shop?filter=new', 'New arrivals'], ['/#about', 'About']];

export default function ShopLayout() {
  const { count } = useCart(); const { user } = useAuth(); const root = useAuthRoot(); const dash = root.admin.user ? '/admin' : root.staff.user ? '/staff' : user ? '/account' : '/login'; const [open, setOpen] = useState(false);
  const { data: s } = useSettings(); const nav = useNavigate(); const [q, setQ] = useState('');
  return (
    <div className="flex min-h-screen flex-col">
      <div className="fixed inset-x-0 top-0 z-30">
        <div className="bg-sage-dark py-2 text-center text-xs text-white">Free shipping above ₹{s?.freeShippingThreshold ?? 499} · Cash on Delivery available across India</div>
        <header className="border-b border-beige-dark/60 bg-cream/95 backdrop-blur">
          <div className="container-x flex h-16 items-center gap-1 sm:gap-3">
            <button className="rounded-full p-2 hover:bg-beige lg:hidden" aria-label="Menu" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
            <Link to="/" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap sm:gap-2">{s?.logo ? <img src={s.logo} alt="" className="h-8 w-auto" /> : <Leaf className="h-6 w-6 text-sage-dark" />}<span className="font-display text-xl font-bold text-earth-dark sm:text-2xl">{s?.brandName || 'Radha Veda'}</span></Link>
            <nav className="ml-8 hidden gap-6 text-sm font-medium lg:flex">{links.map(([to, l]) => <NavLink key={l} to={to} className="hover:text-sage-dark">{l}</NavLink>)}</nav>
            <form className="ml-auto hidden md:block" onSubmit={(e) => { e.preventDefault(); nav(`/shop?q=${encodeURIComponent(q)}`); }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products" className="field w-56 rounded-full" aria-label="Search" /></form>
            <div className="ml-auto flex items-center gap-1 md:ml-2">
              <Link to={user ? '/account/wishlist' : '/login'} aria-label="Wishlist" className="rounded-full p-2.5 hover:bg-beige"><Heart className="h-5 w-5" /></Link>
              <Link to={dash} aria-label="My dashboard" className="rounded-full p-2.5 hover:bg-beige"><User className="h-5 w-5" /></Link>
              <Link to="/cart" aria-label="Cart" className="relative rounded-full p-2.5 hover:bg-beige"><ShoppingBag className="h-5 w-5" />{count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-sage-dark px-1 text-[11px] font-bold text-white">{count}</span>}</Link>
            </div>
          </div>
        </header>
      </div>
      <div className="h-24 shrink-0" aria-hidden="true" />
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-earth-dark/50" onClick={() => setOpen(false)} />
        <div className="drawer-in absolute inset-y-0 left-0 w-72 bg-cream p-5"><button className="mb-4 rounded-full p-2 hover:bg-beige" aria-label="Close" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
          <nav className="flex flex-col">{links.map(([to, l]) => <Link key={l} to={to} onClick={() => setOpen(false)} className="border-b border-beige py-3 font-medium">{l}</Link>)}</nav></div></div>}
      <main className="flex-1"><Outlet /></main>
      <footer className="mt-16 bg-earth-dark text-beige-light">
        <div className="container-x grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="font-display text-3xl text-white">{s?.brandName || 'Radha Veda'}</p><p className="mt-2 text-sm">Nature's Touch, Pure Beauty</p>
            <div className="mt-4 flex gap-3">{s?.social?.instagram && <a href={s.social.instagram} aria-label="Instagram"><Instagram /></a>}{s?.social?.facebook && <a href={s.social.facebook} aria-label="Facebook"><Facebook /></a>}</div></div>
          <div><p className="mb-3 font-semibold text-white">Shop</p><ul className="space-y-2 text-sm"><li><Link to="/shop">All products</Link></li><li><Link to="/shop?filter=bestseller">Best sellers</Link></li><li><Link to="/shop?filter=new">New arrivals</Link></li></ul></div>
          <div><p className="mb-3 font-semibold text-white">Help</p><ul className="space-y-2 text-sm"><li><Link to="/account">Track order</Link></li><li><Link to="/policy/returnPolicy">Return policy</Link></li><li><Link to="/policy/privacyPolicy">Privacy policy</Link></li><li><Link to="/policy/terms">Terms & conditions</Link></li></ul></div>
          <div className="space-y-2 text-sm"><p className="mb-3 font-semibold text-white">Contact</p>
            {s?.contact?.phone && <p className="flex gap-2"><Phone className="h-4 w-4 shrink-0" />{s.contact.phone}</p>}{s?.contact?.email && <p className="flex gap-2"><Mail className="h-4 w-4 shrink-0" />{s.contact.email}</p>}{s?.contact?.address && <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0" />{s.contact.address}</p>}
            {s?.whatsapp && <a className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 font-semibold text-white" href={waLink(s.whatsapp, `Hi ${s.brandName || 'Radha Veda'}! I have a question.`)} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="h-5 w-5" />Chat on WhatsApp</a>}</div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs">© {new Date().getFullYear()} {s?.brandName || 'Radha Veda'}. All rights reserved.</p>
      </footer>
      {s?.whatsapp && <WhatsAppButton number={s.whatsapp} brand={s.brandName} />}
    </div>
  );
}
