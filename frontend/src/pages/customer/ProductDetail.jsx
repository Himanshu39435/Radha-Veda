import { useEffect, useState } from 'react';
import Img from '../../components/Img';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Minus, Plus, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useFetch, useAction } from '../../lib/hooks';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, ErrorBox, Spinner, Textarea, Badge } from '../../components/ui';
import ProductCard from '../../components/ProductCard';
import { cn, money, date } from '../../lib/utils';
import { useSettings } from '../../components/ShopLayout';
import { WhatsAppIcon } from '../../components/WhatsAppButton';
import { waLink } from '../../lib/whatsapp';

export default function ProductDetail() {
  const { slug } = useParams(); const nav = useNavigate(); const cart = useCart(); const { user } = useAuth();
  const { data: p, loading, error, reload } = useFetch(() => api().get(`/products/${slug}`), [slug]); const { data: settings } = useSettings();
  const [vi, setVi] = useState(0); const [img, setImg] = useState(0); const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(5); const [comment, setComment] = useState(''); const [act, busy] = useAction();
  useEffect(() => { setVi(0); setImg(0); setQty(1); window.scrollTo(0, 0); }, [slug]);
  if (loading) return <Spinner />; if (error) return <div className="container-x py-10"><ErrorBox msg={error} retry={reload} /></div>;
  const v = p.variants[vi]; const out = !v || v.stock < 1 || !p.isAvailable; const pct = v && v.price > v.effectivePrice ? Math.round((1 - v.effectivePrice / v.price) * 100) : 0;
  const item = () => ({ variantId: v._id, productId: p._id, slug: p.slug, name: p.name, weight: v.weight, image: p.images?.[0]?.url, price: v.effectivePrice, stock: v.stock });
  const buyNow = () => { cart.add(item(), qty); nav('/checkout'); };
  const review = (e) => { e.preventDefault(); act(async () => { await api().post(`/products/${p._id}/reviews`, { rating, comment }); setComment(''); reload(); }, 'Thanks for your review'); };
  return (
    <div className="container-x py-8">
      <p className="mb-4 text-sm text-earth-light"><Link to="/shop" className="underline">Shop</Link> / {p.category?.name}</p>
      <div className="grid gap-8 md:grid-cols-2">
        <div><div className="aspect-square overflow-hidden rounded-3xl bg-beige-light"><Img src={p.images?.[img]?.url} alt={p.name} className="h-full w-full object-cover" /></div>
          <div className="mt-3 flex gap-2 overflow-x-auto">{p.images?.map((im, i) => <button key={i} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`} className={cn('h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2', i === img ? 'border-sage-dark' : 'border-transparent')}><Img src={im.url} alt="" className="h-full w-full object-cover" /></button>)}</div></div>
        <div>
          <h1 className="text-4xl font-bold sm:text-5xl">{p.name}</h1>
          <p className="mt-2 flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{p.ratingCount ? `${p.ratingAvg} (${p.ratingCount} reviews)` : 'No reviews yet'}</p>
          {v && <p className="mt-4 flex flex-wrap items-baseline gap-3"><span className="text-3xl font-bold">{money(v.effectivePrice)}</span>{pct > 0 && <><span className="text-earth-light line-through">{money(v.price)}</span><Badge className="bg-sage-light text-sage-dark">{pct}% off</Badge></>}</p>}
          <p className="mt-4 leading-relaxed">{p.description}</p>
          <p className="mt-5 text-sm font-semibold">Weight</p>
          <div className="mt-2 flex flex-wrap gap-2">{p.variants.map((x, i) => <button key={x._id} onClick={() => { setVi(i); setQty(1); }} disabled={x.stock < 1} className={cn('min-h-[44px] rounded-full border px-5 text-sm font-semibold disabled:opacity-40 disabled:line-through', i === vi ? 'border-sage-dark bg-sage-dark text-white' : 'border-earth/30 hover:bg-beige-light')}>{x.weight}</button>)}</div>
          <p className={cn('mt-3 text-sm font-semibold', out ? 'text-red-700' : v.stock <= v.lowStockThreshold ? 'text-amber-700' : 'text-sage-dark')}>{out ? 'Out of stock' : v.stock <= v.lowStockThreshold ? `Only ${v.stock} left` : 'In stock'}{v && <span className="ml-3 font-normal text-earth-light">SKU {v.sku}</span>}</p>
          <div className="mt-5 flex items-center gap-3"><div className="flex items-center rounded-full border border-earth/30"><button aria-label="Decrease" className="grid h-11 w-11 place-items-center" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="h-4 w-4" /></button><span className="w-8 text-center font-semibold">{qty}</span><button aria-label="Increase" className="grid h-11 w-11 place-items-center" onClick={() => setQty(Math.min(v?.stock || 1, 20, qty + 1))}><Plus className="h-4 w-4" /></button></div></div>
          <div className="mt-5 flex flex-wrap gap-3"><Button disabled={out} variant="outline" className="flex-1" onClick={() => cart.add(item(), qty)}>Add to cart</Button><Button disabled={out} className="flex-1" onClick={buyNow}>Buy now</Button></div>
          {settings?.whatsapp && <a href={waLink(settings.whatsapp, `Hi! I'd like to know more about ${p.name}${v ? ` (${v.weight})` : ''}. ${window.location.href}`)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#25D366] px-5 text-sm font-semibold text-[#128C7E] hover:bg-[#25D366]/10"><WhatsAppIcon className="h-5 w-5" />Ask about this product on WhatsApp</a>}
          {p.ingredients && <div className="mt-8"><h3 className="text-2xl font-semibold">Ingredients</h3><p className="mt-1 text-sm">{p.ingredients}</p></div>}
          {p.directions && <div className="mt-5"><h3 className="text-2xl font-semibold">Directions for use</h3><p className="mt-1 text-sm">{p.directions}</p></div>}
        </div>
      </div>
      <section className="mt-14"><h2 className="mb-4 text-3xl font-semibold">Reviews</h2>
        <div className="grid gap-6 md:grid-cols-[1fr_360px]">
          <div className="space-y-3">{p.reviews.length ? p.reviews.map(r => <Card key={r._id}><div className="flex items-center justify-between"><p className="font-semibold">{r.user?.name}</p><p className="text-xs text-earth-light">{date(r.createdAt)}</p></div><div className="flex">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}</div>{r.comment && <p className="mt-1 text-sm">{r.comment}</p>}</Card>) : <p className="text-sm text-earth-light">Be the first to review this product after your order is delivered.</p>}</div>
          {user ? <Card><form onSubmit={review} className="space-y-3"><p className="font-semibold">Write a review</p><div className="flex gap-1">{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} aria-label={`${n} stars`} onClick={() => setRating(n)}><Star className={cn('h-7 w-7', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-earth/30')} /></button>)}</div><Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="How was it for your skin?" /><Button loading={busy}>Submit review</Button><p className="text-xs text-earth-light">Only customers with a delivered order can review.</p></form></Card> : <Card><p className="text-sm"><Link className="font-semibold underline" to="/login">Log in</Link> to write a review.</p></Card>}
        </div></section>
      {p.related?.length > 0 && <section className="mt-14"><h2 className="mb-4 text-3xl font-semibold">You may also like</h2><div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{p.related.map(r => <ProductCard key={r._id} p={r} />)}</div></section>}
    </div>
  );
}
