import { Check } from 'lucide-react';
import { cn, dateTime, STATUSES } from '../lib/utils';
// Progress steps + full event log
export default function Timeline({ order }) {
  const idx = STATUSES.indexOf(order.status); const dead = idx < 0;
  return (<div>
    {!dead && <ol className="mb-5 flex gap-1 overflow-x-auto pb-2">{STATUSES.map((s, i) => <li key={s} className="min-w-[84px] flex-1 text-center"><span className={cn('mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold', i <= idx ? 'bg-sage-dark text-white' : 'bg-beige text-earth-light')}>{i <= idx ? <Check className="h-4 w-4" /> : i + 1}</span><span className="mt-1 block text-[11px] leading-tight">{s}</span></li>)}</ol>}
    <ul className="space-y-3 border-l-2 border-beige-dark pl-4">{[...order.timeline].reverse().map((t, i) => <li key={i} className="relative"><span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-sage-dark" /><p className="text-sm font-semibold">{t.status}</p><p className="text-xs text-earth-light">{dateTime(t.at)}{t.note ? ` · ${t.note}` : ''}</p></li>)}</ul></div>);
}
