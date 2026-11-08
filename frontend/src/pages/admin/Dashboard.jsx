import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { Badge, Button, Card, ErrorBox, PageTitle, Spinner, Table } from '../../components/ui';
import { money, dateTime } from '../../lib/utils';
export default function Dashboard() {
  const { data: d, loading, error, reload } = useFetch(() => api('admin').get('/admin/dashboard'), []);
  if (loading) return <Spinner />; if (error) return <ErrorBox msg={error} retry={reload} />;
  const cards = [['Total revenue', money(d.revenue)], ['Total orders', d.orders], ['Customers', d.customers], ['Products', d.products], ['Pending orders', d.pending], ['Processing', d.processing], ['Delivered', d.delivered], ['Low stock variants', d.lowStock]];
  return (<div><PageTitle title="Dashboard"><Link to="/admin/products"><Button size="sm">Add product</Button></Link><Link to="/admin/orders"><Button size="sm" variant="outline">View orders</Button></Link><Link to="/admin/inventory"><Button size="sm" variant="outline">Check stock</Button></Link></PageTitle>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([l, v]) => <Card key={l}><p className="text-sm text-earth-light">{l}</p><p className="mt-1 font-display text-4xl font-bold">{v}</p></Card>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-3"><Card className="min-w-0 xl:col-span-2"><h2 className="mb-3 text-2xl font-semibold">Revenue, last 30 days</h2>
      {d.revenueByDate.length ? <div className="h-72"><ResponsiveContainer><AreaChart data={d.revenueByDate}><CartesianGrid strokeDasharray="3 3" stroke="#EBDFC9" /><XAxis dataKey="_id" tickFormatter={x => x.slice(5)} fontSize={12} /><YAxis fontSize={12} width={50} /><Tooltip formatter={v => money(v)} /><Area dataKey="revenue" stroke="#4E5D42" fill="#DDE4D2" /></AreaChart></ResponsiveContainer></div> : <p className="py-10 text-center text-sm text-earth-light">Revenue appears here once orders are paid.</p>}</Card>
      <Card className="min-w-0"><h2 className="mb-3 text-2xl font-semibold">Order status</h2><ul className="space-y-2 text-sm">{Object.entries(d.statusSummary).map(([s, n]) => <li key={s} className="flex justify-between"><Badge>{s}</Badge><b>{n}</b></li>)}{!Object.keys(d.statusSummary).length && <p className="text-earth-light">No orders yet.</p>}</ul></Card></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-3"><div className="min-w-0 xl:col-span-2"><h2 className="mb-3 text-2xl font-semibold">Recent orders</h2><Table head={['Order', 'Customer', 'Total', 'Status']}>{d.recentOrders.map(o => <tr key={o._id}><td>{o.orderId}<br /><span className="text-xs text-earth-light">{dateTime(o.createdAt)}</span></td><td>{o.shippingAddress?.name}</td><td>{money(o.total)}</td><td><Badge>{o.status}</Badge></td></tr>)}</Table></div>
      <Card className="min-w-0"><h2 className="mb-3 text-2xl font-semibold">Best sellers</h2><ol className="space-y-2 text-sm">{d.bestSellers.map(b => <li key={b._id} className="flex justify-between gap-2"><span>{b.name}</span><b>{b.units} sold</b></li>)}{!d.bestSellers.length && <p className="text-earth-light">No sales yet.</p>}</ol></Card></div></div>);
}
