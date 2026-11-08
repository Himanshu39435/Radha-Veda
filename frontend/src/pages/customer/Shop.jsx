import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { Button, Check, Empty, ErrorBox, Input, Pager, Select, Spinner } from '../../components/ui';
import ProductCard from '../../components/ProductCard';

export default function Shop() {
  const [sp, setSp] = useSearchParams(); const [show, setShow] = useState(false);
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n); };
  const { data: cats } = useFetch(() => api().get('/categories'), []);
  const qs = sp.toString();
  const { data, loading, error, reload } = useFetch(() => api().get(`/products?${qs}&limit=12`), [qs]);
  const filters = (<div className="space-y-4">
    <Input label="Search" defaultValue={sp.get('q') || ''} onKeyDown={e => e.key === 'Enter' && set('q', e.target.value)} placeholder="Press Enter to search" />
    <Select label="Category" value={sp.get('category') || ''} onChange={e => set('category', e.target.value)}><option value="">All categories</option>{(cats || []).map(c => <option key={c._id} value={c.slug}>{c.name}</option>)}</Select>
    <div className="grid grid-cols-2 gap-2"><Input label="Min ₹" type="number" min="0" defaultValue={sp.get('minPrice') || ''} onBlur={e => set('minPrice', e.target.value)} /><Input label="Max ₹" type="number" min="0" defaultValue={sp.get('maxPrice') || ''} onBlur={e => set('maxPrice', e.target.value)} /></div>
    <Select label="Collection" value={sp.get('filter') || ''} onChange={e => set('filter', e.target.value)}><option value="">Everything</option><option value="bestseller">Best sellers</option><option value="new">New arrivals</option><option value="featured">Featured</option></Select>
    <Check label="In stock only" checked={sp.get('inStock') === 'true'} onChange={e => set('inStock', e.target.checked ? 'true' : '')} />
    <Button variant="outline" className="w-full" onClick={() => setSp({})}>Clear filters</Button></div>);
  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-4xl font-semibold sm:text-5xl">Shop</h1>
        <div className="flex gap-2"><Button variant="outline" className="lg:hidden" onClick={() => setShow(!show)}><SlidersHorizontal className="h-4 w-4" />Filters</Button>
          <Select aria-label="Sort" value={sp.get('sort') || ''} onChange={e => set('sort', e.target.value)}><option value="">Newest</option><option value="popularity">Popularity</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></Select></div></div>
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className={`${show ? 'block' : 'hidden'} h-fit rounded-2xl border border-beige-dark/60 bg-white p-4 lg:block`}>{filters}</aside>
        <div>{loading ? <Spinner /> : error ? <ErrorBox msg={error} retry={reload} /> : !data.products.length ? <Empty title="No products found" hint="Try clearing a filter." /> :
          <><p className="mb-3 text-sm text-earth-light">{data.total} products</p><div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">{data.products.map(p => <ProductCard key={p._id} p={p} />)}</div><Pager page={data.page} pages={data.pages} set={(n) => set('page', n)} /></>}</div>
      </div>
    </div>
  );
}
