import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Archive, CheckCircle2, ClipboardList, Clock, LayoutDashboard, PackageCheck, Settings2, Truck, Boxes } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import OrdersView from '../../components/OrdersView';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { Badge, Button, Card, ErrorBox, PageTitle, Spinner, Table } from '../../components/ui';
import { dateTime, money } from '../../lib/utils';

export const staffNav = [
  { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/staff/assigned', label: 'Assigned Orders', icon: ClipboardList },
  { to: '/staff/pending', label: 'Pending Orders', icon: Clock }, { to: '/staff/processing', label: 'Processing', icon: Settings2 },
  { to: '/staff/packing', label: 'Packing', icon: Boxes }, { to: '/staff/ready', label: 'Ready to Dispatch', icon: PackageCheck },
  { to: '/staff/shipped', label: 'Shipped', icon: Truck }, { to: '/staff/delivered', label: 'Delivered', icon: CheckCircle2 },
];
function Dash() {
  const { data, loading, error, reload } = useFetch(() => api('staff').get('/admin/staff/dashboard'), []);
  if (loading) return <Spinner />; if (error) return <ErrorBox msg={error} retry={reload} />;
  const cards = [['Total assigned', data.total], ['Pending', data.pending], ['Processing', data.processing], ['Packed', data.packed], ['Ready to dispatch', data.ready], ['Shipped', data.shipped], ['Delivered', data.delivered]];
  return <div><PageTitle title="Dashboard"><Link to="/staff/pending"><Button size="sm">Pending orders</Button></Link><Link to="/staff/processing"><Button size="sm" variant="outline">Processing</Button></Link><Link to="/staff/ready"><Button size="sm" variant="outline">Ready to dispatch</Button></Link></PageTitle>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([l, v]) => <Card key={l}><p className="text-sm text-earth-light">{l}</p><p className="mt-1 font-display text-4xl font-bold">{v}</p></Card>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-3"><div className="min-w-0 xl:col-span-2"><h2 className="mb-3 text-2xl font-semibold">Recent assigned orders</h2>
      {data.recentOrders.length ? <Table head={['Order', 'Customer', 'Total', 'Payment', 'Status']}>{data.recentOrders.map(o => <tr key={o._id}><td>{o.orderId}<br /><span className="text-xs text-earth-light">{dateTime(o.updatedAt)}</span></td><td>{o.shippingAddress?.name}</td><td>{money(o.total)}</td><td>{o.paymentMethod}<br /><Badge>{o.paymentStatus}</Badge></td><td><Badge>{o.status}</Badge></td></tr>)}</Table> : <Card><p className="py-6 text-center text-sm text-earth-light">No orders are assigned to you yet.</p></Card>}</div>
      <Card className="min-w-0"><h2 className="mb-3 text-2xl font-semibold">Order status</h2><ul className="space-y-2 text-sm">{Object.entries(data.statusSummary).map(([s, n]) => <li key={s} className="flex justify-between"><Badge>{s}</Badge><b>{n}</b></li>)}{!Object.keys(data.statusSummary).length && <p className="text-earth-light">Nothing assigned yet.</p>}</ul></Card></div></div>;
}
const P = (t, s) => <OrdersView key={t} panel="staff" title={t} status={s} fixed={!!s} />;
export default function Staff() {
  return <Routes><Route element={<DashboardLayout panel="staff" items={staffNav} title="Staff panel" />}>
    <Route index element={<Dash />} /><Route path="assigned" element={P('Assigned orders')} /><Route path="pending" element={P('Pending orders', 'Pending,Confirmed')} />
    <Route path="processing" element={P('Processing', 'Processing')} /><Route path="packing" element={P('Packing', 'Packed')} /><Route path="ready" element={P('Ready to dispatch', 'Ready to Dispatch')} />
    <Route path="shipped" element={P('Shipped', 'Shipped')} /><Route path="delivered" element={P('Delivered', 'Delivered')} /><Route path="*" element={<Navigate to="/staff" replace />} /></Route></Routes>;
}
