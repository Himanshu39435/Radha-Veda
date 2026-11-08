import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Heart, LayoutDashboard, MapPin, Package, ShoppingBag, Store, UserRound, Wallet, CheckCircle2, Truck } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { Addresses, OrderDetail, Orders, Profile, Wishlist } from './Account';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { Badge, Button, Card, Empty, ErrorBox, PageTitle, Spinner, Table } from '../../components/ui';
import { dateTime, money } from '../../lib/utils';

const nav = [
  { to: '/account', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/account/orders', label: 'My Orders', icon: Package },
  { to: '/account/wishlist', label: 'Wishlist', icon: Heart }, { to: '/account/addresses', label: 'Saved Addresses', icon: MapPin },
  { to: '/account/profile', label: 'Profile & Password', icon: UserRound }, { to: '/', label: 'Continue Shopping', icon: Store },
];
function Overview() {
  const { user } = useAuth('customer'); const { data: d, loading, error, reload } = useFetch(() => api().get('/dashboard'), []);
  if (loading) return <Spinner />; if (error) return <ErrorBox msg={error} retry={reload} />;
  const cards = [['Total orders', d.totalOrders, Package], ['Active orders', d.activeOrders, Truck], ['Delivered', d.delivered, CheckCircle2], ['Total spent', money(d.totalSpent), Wallet], ['Wishlist items', d.wishlist, Heart], ['Saved addresses', d.addresses, MapPin]];
  return (<div><PageTitle title={`Welcome, ${user.name.split(' ')[0]}`}><Link to="/shop"><Button size="sm"><ShoppingBag className="h-4 w-4" />Continue shopping</Button></Link><Link to="/account/orders"><Button size="sm" variant="outline">My orders</Button></Link><Link to="/account/wishlist"><Button size="sm" variant="outline">Wishlist</Button></Link></PageTitle>
    {d.awaitingPaymentOrderId && <Card className="mb-4 border-amber-300 bg-amber-50"><p className="font-semibold">You have an order waiting for payment.</p><Link to={`/account/orders/${d.awaitingPaymentOrderId}`}><Button size="sm" className="mt-2">Complete payment</Button></Link></Card>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{cards.map(([l, v, I]) => <Card key={l}><I className="h-5 w-5 text-sage-dark" /><p className="mt-2 text-sm text-earth-light">{l}</p><p className="mt-1 font-display text-3xl font-bold sm:text-4xl">{v}</p></Card>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-3"><div className="min-w-0 xl:col-span-2"><h2 className="mb-3 text-2xl font-semibold">Recent orders</h2>
      {!d.recentOrders.length ? <Card><Empty title="No orders yet" hint="Your orders and their tracking will appear here."><Link to="/shop"><Button>Start shopping</Button></Link></Empty></Card> :
        <Table head={['Order', 'Date', 'Items', 'Total', 'Status', '']}>{d.recentOrders.map(o => <tr key={o._id}><td className="font-semibold">{o.orderId}</td><td className="whitespace-nowrap">{dateTime(o.createdAt)}</td><td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td><td>{money(o.total)}</td><td><Badge>{o.status}</Badge></td><td><Link to={`/account/orders/${o._id}`}><Button size="sm" variant="outline">Track</Button></Link></td></tr>)}</Table>}</div>
      <Card className="min-w-0"><h2 className="mb-3 text-2xl font-semibold">Order status</h2><ul className="space-y-2 text-sm">{Object.entries(d.statusSummary).map(([s, n]) => <li key={s} className="flex justify-between"><Badge>{s}</Badge><b>{n}</b></li>)}{!Object.keys(d.statusSummary).length && <p className="text-earth-light">No orders yet.</p>}</ul></Card></div></div>);
}
export default function CustomerPanel() {
  return <Routes><Route element={<DashboardLayout panel="customer" items={nav} title="My account" />}>
    <Route index element={<Overview />} /><Route path="orders" element={<Orders />} /><Route path="orders/:id" element={<OrderDetail />} />
    <Route path="wishlist" element={<Wishlist />} /><Route path="addresses" element={<Addresses />} /><Route path="profile" element={<Profile />} /><Route path="*" element={<Navigate to="/account" replace />} /></Route></Routes>;
}
