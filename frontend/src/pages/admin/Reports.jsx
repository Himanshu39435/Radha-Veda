import { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { Button, Card, Empty, PageTitle, Select, Spinner, Table } from '../../components/ui';
import { money } from '../../lib/utils';
const A = api('admin');
export default function Reports() {
  const [period, setP] = useState('daily'); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const qs = new URLSearchParams({ period, ...(from && { from }), ...(to && { to }) }).toString();
  const { data: d, loading } = useFetch(() => A.get(`/admin/reports?${qs}`), [qs]);
  const T = (title, rows, a, b) => <div><h2 className="mb-2 text-2xl font-semibold">{title}</h2>{rows.length ? <Table head={[a, b, 'Revenue']}>{rows.map(r => <tr key={r._id}><td>{r._id}</td><td>{r.orders ?? r.units}</td><td>{money(r.revenue)}</td></tr>)}</Table> : <p className="text-sm text-earth-light">No data</p>}</div>;
  return (<div><PageTitle title="Sales reports"><Button variant="outline" onClick={() => A.download(`/admin/reports?${qs}&format=csv`, 'sales-report.csv').catch(e => alert(e.message))}><Download className="h-4 w-4" />Export CSV</Button></PageTitle>
    <Card className="mb-4 grid gap-3 sm:grid-cols-3"><Select label="Group by" value={period} onChange={e => setP(e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></Select><label className="text-sm font-medium">From<input type="date" className="field mt-1" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-sm font-medium">To<input type="date" className="field mt-1" value={to} onChange={e => setTo(e.target.value)} /></label></Card>
    {loading ? <Spinner /> : <div className="space-y-6"><div className="grid grid-cols-2 gap-3"><Card><p className="text-sm text-earth-light">Total revenue (paid orders)</p><p className="font-display text-4xl font-bold">{money(d.totals.revenue)}</p></Card><Card><p className="text-sm text-earth-light">Total orders</p><p className="font-display text-4xl font-bold">{d.totals.orders}</p></Card></div>
      {T(`${period[0].toUpperCase() + period.slice(1)} sales`, d.series, 'Period', 'Orders')}{T('Product-wise sales', d.byProduct, 'Product', 'Units')}{T('Category-wise sales', d.byCategory, 'Category', 'Units')}{T('Payment method', d.byPayment, 'Method', 'Orders')}</div>}</div>);
}
