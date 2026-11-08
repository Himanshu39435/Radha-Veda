import { useState } from 'react';
import { Printer, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAction, useFetch } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, Empty, ErrorBox, Input, Modal, PageTitle, Pager, Select, Spinner, Table } from './ui';
import Timeline from './Timeline';
import { dateTime, money, NEXT, STAFF_OK } from '../lib/utils';

export function OrderModal({ id, panel, onClose, onChange }) {
  const { user } = useAuth(panel); const isAdmin = user.role === 'admin'; const a = api(panel); const [act, busy] = useAction();
  const { data: o, reload } = useFetch(() => a.get(`/manage/orders/${id}`), [id]);
  const { data: staff } = useFetch(() => (isAdmin ? a.get('/admin/staff') : Promise.resolve([])), []);
  const [trk, setTrk] = useState({ courier: '', trackingNumber: '', trackingUrl: '' });
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const run = (fn, ok) => act(async () => { await fn(); await reload(); onChange(); }, ok);
  const openInvoice = async () => {
    setInvoiceBusy(true);
    try { await a.openHtml(`/manage/orders/${o._id}/invoice`); } catch (e) { alert(e.message); } finally { setInvoiceBusy(false); }
  };
  const next = o ? NEXT[o.status].filter(s => isAdmin || STAFF_OK.includes(s)) : [];
  return (
    <Modal open onClose={onClose} wide title={o ? `Order ${o.orderId}` : 'Order'}>
      {!o ? <Spinner /> : <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-earth-light">Order</span><Badge>{o.status}</Badge><span className="text-xs text-earth-light">Payment</span><Badge>{o.paymentStatus}</Badge><span className="text-sm text-earth-light">{o.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Razorpay'} · {dateTime(o.createdAt)}</span>
          <Button size="sm" variant="outline" className="ml-auto" loading={invoiceBusy} onClick={openInvoice}><Printer className="h-4 w-4" />Invoice</Button></div>
        <div className="grid gap-3 sm:grid-cols-2"><Card className="text-sm"><b>Customer</b><p>{o.shippingAddress.name}</p><p>{o.shippingAddress.phone}</p><p>{o.shippingAddress.email}</p></Card>
          <Card className="text-sm"><b>Shipping address</b><p>{o.shippingAddress.line1}, {o.shippingAddress.city}, {o.shippingAddress.state} - {o.shippingAddress.pincode}</p></Card></div>
        <Card>{o.items.map((i, k) => <div key={k} className="flex justify-between border-b border-beige py-2 text-sm last:border-0"><span>{i.name} · {i.weight} × {i.quantity}<br /><span className="text-xs text-earth-light">SKU {i.sku}</span></span><b>{money(i.price * i.quantity)}</b></div>)}
          <p className="mt-2 text-right text-sm">Discount -{money(o.discount)} · Shipping {money(o.shipping)}<br /><b className="text-lg">Total {money(o.total)}</b></p></Card>
        <Card className="space-y-3"><b>Actions</b>
          {next.includes('Shipped') && <div className="grid gap-2 sm:grid-cols-3"><Input label="Courier" value={trk.courier} onChange={e => setTrk({ ...trk, courier: e.target.value })} placeholder="Delhivery, India Post…" /><Input label="Tracking number" value={trk.trackingNumber} onChange={e => setTrk({ ...trk, trackingNumber: e.target.value })} /><Input label="Tracking link (optional)" type="url" value={trk.trackingUrl} onChange={e => setTrk({ ...trk, trackingUrl: e.target.value })} /></div>}
          <div className="flex flex-wrap gap-2">{next.map(s => <Button key={s} size="sm" variant={['Cancelled', 'Returned'].includes(s) ? 'danger' : 'primary'} loading={busy} onClick={() => (!['Cancelled', 'Returned'].includes(s) || confirm(`Mark as ${s}?`)) && run(() => a.patch(`/manage/orders/${o._id}/status`, { status: s, ...(s === 'Shipped' && { tracking: Object.fromEntries(Object.entries(trk).filter(([, v]) => v.trim())) }) }), `Marked ${s}`)}>{s === 'Packed' ? 'Mark packed' : s === 'Confirmed' ? 'Confirm order' : `Mark ${s.toLowerCase()}`}</Button>)}
            {o.paymentMethod === 'COD' && o.status === 'Delivered' && o.paymentStatus !== 'Paid' && <Button size="sm" variant="soft" loading={busy} onClick={() => run(() => a.patch(`/manage/orders/${o._id}/payment`, {}), 'Payment recorded')}>COD payment collected</Button>}
            {isAdmin && o.paymentMethod === 'RAZORPAY' && o.paymentStatus === 'Refund Pending' && <Button size="sm" variant="soft" loading={busy} onClick={() => confirm(`Refund ${money(o.total)} to the customer via Razorpay?`) && run(() => a.post(`/manage/orders/${o._id}/refund`, {}), 'Refund initiated. It completes when Razorpay confirms.')}>Refund via Razorpay</Button>}
            {!next.length && <p className="text-sm text-earth-light">No further actions.</p>}</div>
          {isAdmin && <Select label="Assigned staff" value={o.assignedTo?._id || ''} onChange={e => run(() => a.patch(`/manage/orders/${o._id}/assign`, { staffId: e.target.value || null }), 'Assignment updated')}><option value="">Unassigned</option>{(staff || []).filter(s => s.user.isActive).map(s => <option key={s._id} value={s.user._id}>{s.user.name}</option>)}</Select>}
          {!isAdmin && <p className="text-xs text-earth-light">You can see customer contact details only for orders assigned to you.</p>}</Card>
        {o.tracking?.trackingNumber && <Card className="text-sm"><b>Shipment</b><p>{o.tracking.courier} · {o.tracking.trackingNumber}</p></Card>}
        <Card><b className="mb-3 block">Timeline</b><Timeline order={o} /></Card></div>}
    </Modal>
  );
}

export default function OrdersView({ panel, title, status, fixed }) {
  const isAdmin = panel === 'admin'; const [f, setF] = useState({ q: '', status: '', payment: '', from: '', to: '', page: 1 }); const [open, setOpen] = useState(null);
  const sv = fixed ? status : f.status; const qs = new URLSearchParams({ ...(f.q && { q: f.q }), ...(sv && { status: sv }), ...(f.payment && { payment: f.payment }), ...(f.from && { from: f.from }), ...(f.to && { to: f.to }), page: f.page }).toString();
  const { data, loading, error, reload } = useFetch(() => api(panel).get(`/manage/orders?${qs}`), [qs, panel]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, page: 1 });
  return (<div><PageTitle title={title} />
    <Card className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="relative block sm:col-span-2 lg:col-span-1"><Search className="absolute left-3 top-3 h-4 w-4 text-earth-light" /><input className="field pl-9" placeholder="Order ID, name, phone" value={f.q} onChange={set('q')} aria-label="Search orders" /></label>
      {!fixed && <Select aria-label="Status" value={f.status} onChange={set('status')}><option value="">All statuses</option>{Object.keys(NEXT).map(s => <option key={s}>{s}</option>)}</Select>}
      {isAdmin && <Select aria-label="Payment" value={f.payment} onChange={set('payment')}><option value="">All payments</option><option value="COD">COD</option><option value="RAZORPAY">Razorpay</option></Select>}
      <input type="date" className="field" aria-label="From" value={f.from} onChange={set('from')} /><input type="date" className="field" aria-label="To" value={f.to} onChange={set('to')} /></Card>
    {loading ? <Spinner /> : error ? <ErrorBox msg={error} retry={reload} /> : !data.orders.length ? <Empty title="No orders here" hint="Orders matching these filters will appear here." /> :
      <><Table head={['Order', 'Customer', 'Date', 'Total', 'Payment', 'Status', ...(isAdmin ? ['Staff'] : []), '']}>{data.orders.map(o => <tr key={o._id}><td className="font-semibold">{o.orderId}</td><td>{o.shippingAddress.name}</td><td className="whitespace-nowrap">{dateTime(o.createdAt)}</td><td>{money(o.total)}</td><td>{o.paymentMethod}<br /><Badge>{o.paymentStatus}</Badge></td><td><Badge>{o.status}</Badge></td>{isAdmin && <td>{o.assignedTo?.name || '—'}</td>}<td><Button size="sm" variant="outline" onClick={() => setOpen(o._id)}>View</Button></td></tr>)}</Table>
        <Pager page={f.page} pages={data.pages} set={(n) => setF({ ...f, page: n })} /></>}
    {open && <OrderModal id={open} panel={panel} onClose={() => setOpen(null)} onChange={reload} />}</div>);
}
