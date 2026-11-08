import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Droplets, Leaf, ShieldCheck, Sparkles, Star, Truck, Banknote, RotateCcw, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { Button, Spinner } from '../../components/ui';
import ProductCard from '../../components/ProductCard';
import Img from '../../components/Img';
import { money } from '../../lib/utils';
import { useSettings } from '../../components/ShopLayout';

const Row = ({ title, filter, to }) => {
  const { data, loading } = useFetch(() => api().get(`/products?filter=${filter}&limit=4`), [filter]);
  if (!loading && !data?.products?.length) return null;
  return (<section className="container-x mt-16"><div className="mb-6 flex items-end justify-between"><h2 className="text-4xl font-semibold">{title}</h2><Link to={to} className="text-sm font-semibold text-sage-dark underline">View all</Link></div>
    {loading ? <Spinner /> : <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{data.products.map(p => <ProductCard key={p._id} p={p} />)}</div>}</section>);
};
const faqs = [['Is Multani Mitti safe for sensitive skin?', 'Pure Multani Mitti is gentle for most skin types. Do a patch test on your jawline first and rinse before it fully dries.'], ['How often should I use a face pack?', 'Two to three times a week is enough for oily skin; once a week for dry or sensitive skin.'], ['How long does delivery take?', 'Most orders reach you in 4–7 working days across India. You can track every step from your account.'], ['Can I return a product?', 'Unopened products can be returned within 7 days of delivery. See our return policy for details.']];
const offlineHero = [
  { name: 'Natural Skincare Detox Mask', slug: 'natural-skincare-detox-mask', minPrice: 199, images: [{ url: '/products/natural-skincare-detox-mask-1.jpg' }, { url: '/products/natural-skincare-detox-mask-2.jpg' }] },
  { name: 'Herbal Glow Face Pack', slug: 'herbal-glow-face-pack', minPrice: 131, images: [{ url: '/products/herbal-glow-face-pack-1.jpg' }, { url: '/products/herbal-glow-face-pack-2.jpg' }] },
  { name: 'Aloe & Cucumber Cooling Pack', slug: 'aloe-and-cucumber-cooling-pack', minPrice: 125, images: [{ url: '/products/aloe-and-cucumber-cooling-pack-1.jpg' }] },
];

export default function Home() {
  const { data: cats } = useFetch(() => api().get('/categories'), []);
  const { data: feat } = useFetch(() => api().get('/products?filter=featured&limit=4'), []);
  const hero = ((feat?.products || []).filter(p => p.images?.[0]?.url).slice(0, 3).length >= 2
    ? (feat?.products || []).filter(p => p.images?.[0]?.url).slice(0, 3)
    : offlineHero);
  const { data: reviews } = useFetch(() => api().get('/reviews/latest'), []);
  const { data: settings } = useSettings(); const banners = (settings?.banners || []).filter(b => b.active !== false && b.image);
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false);
  const sub = async (e) => { e.preventDefault(); setBusy(true); try { await api().post('/newsletter', { email }); toast.success('You are subscribed'); setEmail(''); } catch (er) { toast.error(er.message); } finally { setBusy(false); } };
  return (<>
    <section className="relative overflow-hidden bg-beige-light">
      <div className="container-x grid items-center gap-8 py-12 md:grid-cols-2 md:py-20">
        <div>
          <h1 className="text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">Nature's touch, pure beauty.</h1>
          <p className="mt-5 max-w-md text-lg text-earth">Sun-dried Multani Mitti and herbal face packs, ground in small batches and sent to your door anywhere in India.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link to="/shop"><Button className="px-8">Shop now</Button></Link><Link to="/shop?filter=bestseller"><Button variant="outline">See best sellers</Button></Link></div>
        </div>
        {hero.length >= 2 ? (
          <div className="relative mx-auto aspect-square w-full max-w-md sm:max-w-xl">
            <div className="absolute inset-[6%] rounded-[45%_55%_50%_50%/55%_45%_55%_45%] bg-beige-dark/60" aria-hidden />
            <div className="absolute right-[4%] top-0 h-[88%] w-[62%] overflow-hidden rounded-t-[999px] rounded-b-3xl border-[6px] border-white shadow-xl"><Img src={hero[0].images[0].url} alt={hero[0].name} className="h-full w-full object-cover" /></div>
            <div className="absolute bottom-[2%] left-[2%] h-[44%] w-[40%] overflow-hidden rounded-full border-[6px] border-white shadow-xl"><Img src={(hero[1].images[1] || hero[1].images[0]).url} alt={hero[1].name} className="h-full w-full object-cover" /></div>
            {hero[2] && <div className="absolute left-0 top-[6%] hidden h-[26%] w-[26%] overflow-hidden rounded-full border-[5px] border-white shadow-lg sm:block"><Img src={hero[2].images[0].url} alt={hero[2].name} className="h-full w-full object-cover" /></div>}
            <Link to={`/product/${hero[0].slug}`} className="absolute bottom-[4%] right-0 hidden items-center gap-3 rounded-2xl sm:flex bg-white/95 p-3 pr-4 shadow-lg backdrop-blur transition-transform hover:-translate-y-0.5">
              <Leaf className="h-8 w-8 rounded-full bg-sage-light p-1.5 text-sage-dark" /><span className="text-sm"><b className="block max-w-[11rem] leading-tight text-earth-dark">{hero[0].name}</b><span className="text-earth-light">From {money(hero[0].minPrice)}</span></span><ArrowRight className="h-4 w-4 text-sage-dark" />
            </Link>
          </div>
        ) : (
          <div className="relative mx-auto aspect-square w-full max-w-md" aria-hidden>
            <div className="absolute inset-0 rounded-[48%_52%_55%_45%/50%_45%_55%_50%] bg-beige-dark" />
            <div className="absolute inset-[12%] rounded-[55%_45%_48%_52%/45%_55%_45%_55%] bg-sage" />
            <div className="absolute inset-[26%] grid place-items-center rounded-full bg-cream text-center"><div><p className="font-display text-5xl font-bold text-sage-dark">100%</p><p className="text-sm">natural clay</p></div></div>
          </div>
        )}
      </div>
    </section>

    {banners.length > 0 && <section className="container-x mt-10 grid gap-4 md:grid-cols-2">{banners.map((b, i) => { const img = <img src={b.image} alt={b.title || 'Offer'} loading="lazy" className="h-full w-full rounded-2xl object-cover" />; return b.link ? <a key={i} href={b.link} className="block aspect-[16/7] overflow-hidden rounded-2xl">{img}</a> : <div key={i} className="aspect-[16/7] overflow-hidden rounded-2xl">{img}</div>; })}</section>}

    <section className="border-b border-beige-dark/50 bg-white"><div className="container-x grid grid-cols-2 gap-4 py-5 md:grid-cols-4">{[[Leaf, '100% natural', 'No fillers or synthetic colour'], [Truck, 'Free shipping', 'On orders above ₹499'], [Banknote, 'Cash on Delivery', 'Pay when it arrives'], [RotateCcw, 'Easy returns', '7 days on unopened packs']].map(([I, t, d]) => <div key={t} className="flex items-center gap-3"><I className="h-8 w-8 shrink-0 rounded-full bg-sage-light p-1.5 text-sage-dark" /><p className="text-sm leading-tight"><b className="block text-earth-dark">{t}</b><span className="text-earth-light">{d}</span></p></div>)}</div></section>

    <section className="container-x mt-16"><h2 className="mb-6 text-4xl font-semibold">Shop by category</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{(cats || []).map(c => <Link key={c._id} to={`/shop?category=${c.slug}`} className="group overflow-hidden rounded-2xl border border-beige-dark/60 bg-white transition-shadow hover:shadow-lg"><div className="aspect-square overflow-hidden bg-beige-light"><Img src={c.image} alt={c.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /></div><p className="p-3 text-center font-display text-lg font-semibold leading-tight text-earth-dark sm:text-xl">{c.name}</p></Link>)}</div>
    </section>

    <Row title="Featured products" filter="featured" to="/shop?filter=featured" />
    <Row title="Best sellers" filter="bestseller" to="/shop?filter=bestseller" />
    <Row title="New arrivals" filter="new" to="/shop?filter=new" />

    <section className="container-x mt-20"><h2 className="mb-8 text-4xl font-semibold">Why Multani Mitti?</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[Droplets, 'Absorbs excess oil', 'Draws out oil and impurities for a clean, matte finish.'], [Sparkles, 'Brightens dull skin', 'Gently exfoliates and helps even out skin tone.'], [ShieldCheck, 'Calms the skin', 'A cooling clay that leaves oily skin feeling fresh and calm.'], [Leaf, 'Only natural', 'No fillers or synthetic colour in our packs.']].map(([I, t, d]) => <div key={t} className="rounded-2xl bg-white p-5"><I className="h-7 w-7 text-sage-dark" /><h3 className="mt-3 text-2xl font-semibold">{t}</h3><p className="mt-1 text-sm text-earth">{d}</p></div>)}</div></section>

    <section id="about" className="mt-20 bg-sage-light py-14"><div className="container-x grid items-center gap-8 md:grid-cols-2">
      <div><h2 className="text-4xl font-semibold">About Radha Veda</h2><p className="mt-4 text-lg leading-relaxed">Radha Veda started with a simple idea: skincare that your grandmother would recognise. We source mineral-rich clay and herbs, dry and grind them in small batches, and pack them without anything you can't pronounce.</p><Link to="/shop" className="mt-6 inline-block"><Button>Explore the range</Button></Link></div>
      {hero[1] && <div className="aspect-[4/3] overflow-hidden rounded-3xl border-[6px] border-white shadow-xl"><Img src={(hero[1].images[1] || hero[1].images[0]).url} alt="Our ingredients" className="h-full w-full object-cover" /></div>}
    </div></section>

    {reviews?.length > 0 && <section className="container-x mt-20"><h2 className="mb-6 text-4xl font-semibold">What customers say</h2>
      <div className="grid gap-4 md:grid-cols-3">{reviews.slice(0, 3).map(r => <figure key={r._id} className="rounded-2xl bg-white p-5"><div className="flex">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}</div><blockquote className="mt-2 text-sm">{r.comment}</blockquote><figcaption className="mt-3 text-sm font-semibold">{r.user?.name} on {r.product?.name}</figcaption></figure>)}</div></section>}

    <section className="container-x mt-20 max-w-3xl"><h2 className="mb-6 text-4xl font-semibold">Frequently asked questions</h2>
      {faqs.map(([q, a]) => <details key={q} className="group border-b border-beige-dark py-4"><summary className="cursor-pointer list-none font-semibold">{q}</summary><p className="mt-2 text-sm text-earth">{a}</p></details>)}</section>

    <section className="container-x mt-20"><div className="rounded-3xl bg-earth-dark p-8 text-center text-white sm:p-12"><h2 className="text-4xl text-white">Get 10% off your first order</h2><p className="mt-2 text-beige-light">Join our list for skincare tips and new launches.</p>
      <form onSubmit={sub} className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row"><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email" className="field rounded-full" aria-label="Email" /><Button loading={busy} variant="soft">Subscribe</Button></form></div></section>
  </>);
}
