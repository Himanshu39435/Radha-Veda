// shadcn/ui-style primitives (cva + tailwind-merge), themed for Radha Veda
import { cva } from 'class-variance-authority';
import { Loader2, X } from 'lucide-react';
import { useEffect } from 'react';
import { cn, NEXT } from '../lib/utils';

const btn = cva('inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[44px] px-5 text-sm', {
  variants: { variant: { primary: 'bg-sage-dark text-white hover:bg-earth-dark', outline: 'border border-earth/30 text-earth-dark hover:bg-beige-light', soft: 'bg-beige text-earth-dark hover:bg-beige-dark', danger: 'bg-red-700 text-white hover:bg-red-800', ghost: 'hover:bg-beige-light text-earth-dark' }, size: { default: '', sm: 'min-h-[36px] px-3.5 text-xs', icon: 'min-h-[40px] w-10 px-0' } },
  defaultVariants: { variant: 'primary', size: 'default' },
});
export const Button = ({ className, variant, size, loading, children, ...p }) => (
  <button className={cn(btn({ variant, size }), className)} disabled={loading || p.disabled} {...p}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>
);
export const Input = ({ label, error, className, ...p }) => (
  <label className="block text-sm font-medium text-earth">{label && <span className="mb-1 block">{label}</span>}<input className={cn('field', className)} {...p} />{error && <span className="text-xs text-red-700">{error}</span>}</label>
);
export const Textarea = ({ label, className, ...p }) => (<label className="block text-sm font-medium text-earth">{label && <span className="mb-1 block">{label}</span>}<textarea rows={3} className={cn('field', className)} {...p} /></label>);
export const Select = ({ label, children, className, ...p }) => (<label className="block text-sm font-medium text-earth">{label && <span className="mb-1 block">{label}</span>}<select className={cn('field', className)} {...p}>{children}</select></label>);
export const Check = ({ label, ...p }) => (<label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#4E5D42]" {...p} />{label}</label>);
export const Card = ({ className, ...p }) => <div className={cn('min-w-0 rounded-2xl border border-beige-dark/60 bg-white p-4 sm:p-5', className)} {...p} />;
export const Spinner = () => <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-sage" /></div>;
export const ErrorBox = ({ msg, retry }) => <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{msg} {retry && <button className="underline" onClick={retry}>Try again</button>}</div>;
export const Empty = ({ title, hint, children }) => <div className="py-14 text-center"><p className="font-display text-2xl text-earth-dark">{title}</p>{hint && <p className="mt-1 text-sm text-earth-light">{hint}</p>}<div className="mt-4">{children}</div></div>;

const tone = { Pending: 'bg-amber-100 text-amber-900', Confirmed: 'bg-sky-100 text-sky-900', Processing: 'bg-indigo-100 text-indigo-900', Packed: 'bg-violet-100 text-violet-900', 'Ready to Dispatch': 'bg-fuchsia-100 text-fuchsia-900', Shipped: 'bg-cyan-100 text-cyan-900', Delivered: 'bg-sage-light text-sage-dark', Paid: 'bg-sage-light text-sage-dark', Cancelled: 'bg-red-100 text-red-800', Failed: 'bg-red-100 text-red-800', Returned: 'bg-orange-100 text-orange-900', 'Refund Pending': 'bg-orange-100 text-orange-900', Refunded: 'bg-stone-200 text-stone-800' };
export const Badge = ({ children, className }) => <span className={cn('inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', tone[children] || 'bg-beige text-earth', className)}>{children}</span>;

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => { if (!open) return; const k = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', k); document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; }; }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-earth-dark/50 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-cream p-5 sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-semibold">{title}</h2><button aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-beige"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}
// Table that scrolls inside itself (no page-level horizontal overflow)
export const Table = ({ head, children }) => (
  <div className="overflow-x-auto rounded-2xl border border-beige-dark/60 bg-white"><table className="w-full min-w-[640px] text-left text-sm">
    <thead className="bg-beige-light text-earth"><tr>{head.map(h => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-beige/70 [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle">{children}</tbody></table></div>
);
export const Pager = ({ page, pages, set }) => pages > 1 && (
  <div className="mt-4 flex items-center justify-center gap-3 text-sm"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => set(page - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => set(page + 1)}>Next</Button></div>
);
export const PageTitle = ({ title, children }) => <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1><div className="flex flex-wrap gap-2">{children}</div></div>;
