import { Link } from 'react-router-dom';
import Img from './Img';
import { Heart, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { money } from '../lib/utils';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function ProductCard({ p }) {
  const { user } = useAuth();
  const wish = async (e) => { e.preventDefault(); if (!user) return toast('Log in to save to wishlist'); try { await api().post(`/wishlist/${p._id}`); toast.success('Saved to wishlist'); } catch (er) { toast.error(er.message); } };
  const from = p.minPrice ?? Math.min(...(p.variants || []).map(v => v.effectivePrice ?? v.price));
  return (
    <Link to={`/product/${p.slug}`} className="group block overflow-hidden rounded-2xl border border-beige-dark/60 bg-white transition-shadow hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-beige-light">
        <Img src={p.images?.[0]?.url} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {p.discountPercent > 0 && <span className="absolute left-2 top-2 rounded-full bg-sage-dark px-2.5 py-1 text-xs font-bold text-white">{p.discountPercent}% off</span>}
        {p.isBestSeller && <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold">Best seller</span>}
        {p.inStock === false && <span className="absolute inset-0 grid place-items-center bg-white/70 font-semibold">Out of stock</span>}
        <button onClick={wish} aria-label="Add to wishlist" className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/90 hover:bg-white"><Heart className="h-4 w-4" /></button>
      </div>
      <div className="p-3 sm:p-4">
        <p className="line-clamp-2 min-h-[2.5rem] font-medium text-earth-dark">{p.name}</p>
        <div className="mt-1 flex items-center gap-1 text-xs text-earth-light"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{p.ratingCount ? `${p.ratingAvg} (${p.ratingCount})` : 'New'}</div>
        <p className="mt-2 flex items-baseline gap-2"><span className="text-lg font-bold">From {money(from)}</span>{p.mrp > from && <span className="text-sm text-earth-light line-through">{money(p.mrp)}</span>}</p>
      </div>
    </Link>
  );
}
