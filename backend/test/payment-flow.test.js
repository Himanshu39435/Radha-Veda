// Integration tests: real Express app + real MongoDB, signed webhooks, fake Razorpay client.
// Run: TEST_MONGO_URI=mongodb://127.0.0.1:27017/radhaveda_test npm test   (the database is WIPED)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key'; process.env.RAZORPAY_KEY_SECRET = 'key_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test'; process.env.PAYMENT_EXPIRY_MINUTES = '30';
const uri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/radhaveda_test';
if (!/test/i.test(uri)) throw new Error('Refusing to run: TEST_MONGO_URI must contain "test" (database gets wiped)');

const test = require('node:test'); const assert = require('node:assert/strict'); const crypto = require('crypto');
const mongoose = require('mongoose'); const M = require('../models'); const P = require('../services/paymentService'); const app = require('../app');

let base, server, token, adminToken, fail = false, seq = 0; const refunds = []; const rzPayments = {};
const fake = {
  orders: { create: async (o) => ({ id: 'order_T' + (++seq), amount: o.amount, currency: 'INR' }), fetchPayments: async (id) => ({ items: rzPayments[id] || [] }) },
  payments: { refund: async (pid, body) => { if (fail) throw { error: { description: 'refund refused' } }; refunds.push({ pid, body }); return { id: 'rfnd_' + pid }; } },
};
const call = async (path, { method = 'GET', body, tok } = {}) => { const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body && JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const send = async (evt, { eventId = 'evt_' + crypto.randomUUID(), badSig = false, noSig = false } = {}) => {
  const raw = JSON.stringify(evt); const sig = crypto.createHmac('sha256', badSig ? 'wrong' : process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  const r = await fetch(base + '/api/webhooks/razorpay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-event-id': eventId, ...(noSig ? {} : { 'x-razorpay-signature': sig }) }, body: raw });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const captured = (o, pid, amount = Math.round(o.total * 100), ev = 'payment.captured') => ({ event: ev, payload: { payment: { entity: { id: pid, order_id: o.razorpayOrderId, amount, currency: 'INR', method: 'upi', status: 'captured' } } } });
const failedEvt = (o, pid) => ({ event: 'payment.failed', payload: { payment: { entity: { id: pid, order_id: o.razorpayOrderId, error_description: 'Card declined' } } } });
const addr = { name: 'Asha Rao', phone: '9876543210', email: 'asha@example.com', line1: '12 MG Road', state: 'Rajasthan', city: 'Jaipur', pincode: '302001' };
const place = async (v, quantity, paymentMethod = 'RAZORPAY') => { const r = await call('/api/orders', { method: 'POST', tok: token, body: { items: [{ variantId: String(v._id), quantity }], paymentMethod, address: addr } }); return r; };
const mkVariant = async (stock, tag) => { const p = await M.Product.create({ name: 'P' + tag, slug: 'p-' + tag, category: cat._id, isAvailable: true }); return M.ProductVariant.create({ product: p._id, weight: '100g', sku: 'SKU-' + tag, price: 100, stock }); };
const stock = async (v) => (await M.ProductVariant.findById(v._id)).stock;
const fresh = (o) => M.Order.findById(o._id);
const age = (o) => M.Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(String(o._id)) }, { $set: { createdAt: new Date(Date.now() - 3600e3) } });
let cat, V;

test.before(async () => {
  await mongoose.connect(uri); await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(M).filter(m => typeof m.init === 'function').map(m => m.init()));
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; P.setClient(fake);
  cat = await M.Category.create({ name: 'Cat', slug: 'cat' });
  await M.User.create({ name: 'Admin', email: 'admin@t.com', password: 'Admin@12345', role: 'admin' });
  token = (await call('/api/auth/register', { method: 'POST', body: { name: 'Asha', email: 'asha@t.com', password: 'Password@1' } })).body.token;
  adminToken = (await call('/api/auth/admin-login', { method: 'POST', body: { email: 'admin@t.com', password: 'Admin@12345' } })).body.token;
  V = await mkVariant(100, 'main');
});
test.after(async () => { server.close(); await mongoose.disconnect(); });

test('webhook rejects missing or invalid signatures and changes nothing', async () => {
  const { body } = await place(V, 1); const o = body.order;
  assert.equal((await send(captured(o, 'pay_bad1'), { badSig: true })).status, 400);
  assert.equal((await send(captured(o, 'pay_bad1'), { noSig: true })).status, 400);
  assert.equal((await fresh(o)).paymentStatus, 'Pending');
  await call(`/api/manage/orders/${o._id}/status`, { method: 'PATCH', tok: adminToken, body: { status: 'Cancelled' } }); // tidy: releases stock
});

test('payment.captured marks paid once; replays and order.paid duplicates are no-ops', async () => {
  const before = await stock(V); const { body } = await place(V, 2); const o = body.order;
  assert.equal(await stock(V), before - 2, 'stock reserved at order time');
  const e1 = 'evt_cap_1'; let r = await send(captured(o, 'pay_A'), { eventId: e1 });
  assert.equal(r.body.result, 'paid'); assert.equal((await fresh(o)).paymentStatus, 'Paid');
  assert.equal((await M.Payment.findOne({ order: o._id })).transactionId, 'pay_A');
  r = await send(captured(o, 'pay_A'), { eventId: e1 }); assert.equal(r.body.duplicate, true);
  r = await send(captured(o, 'pay_A', undefined, 'order.paid'), { eventId: 'evt_other' }); assert.equal(r.body.result, 'already_processed');
  const f = await fresh(o); assert.equal(f.timeline.filter(t => /Online payment received/.test(t.note)).length, 1);
  assert.equal(await stock(V), before - 2, 'no duplicate stock deduction');
});

test('checkout verify + webhook racing together process the payment exactly once', async () => {
  const { body } = await place(V, 1); const o = body.order;
  const sig = crypto.createHmac('sha256', 'key_secret').update(`${o.razorpayOrderId}|pay_B`).digest('hex');
  const bad = await call('/api/payments/verify', { method: 'POST', tok: token, body: { razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: 'pay_B', razorpay_signature: 'deadbeef' } });
  assert.equal(bad.status, 400); assert.equal((await fresh(o)).paymentStatus, 'Pending');
  const [v, w] = await Promise.all([call('/api/payments/verify', { method: 'POST', tok: token, body: { razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: 'pay_B', razorpay_signature: sig } }), send(captured(o, 'pay_B'))]);
  assert.equal(v.status, 200); assert.equal(w.status, 200);
  const f = await fresh(o); assert.equal(f.paymentStatus, 'Paid'); assert.equal(f.timeline.filter(t => /Online payment received/.test(t.note)).length, 1);
});

test('payment.failed keeps the order retryable; a later success still settles it', async () => {
  const { body } = await place(V, 1); const o = body.order;
  assert.equal((await send(failedEvt(o, 'pay_F1'))).body.result, 'failure_recorded');
  let f = await fresh(o); assert.equal(f.paymentStatus, 'Failed'); assert.equal(f.status, 'Pending');
  const retry = await call(`/api/payments/retry/${o._id}`, { method: 'POST', tok: token }); assert.equal(retry.status, 200); assert.equal(retry.body.razorpay.orderId, o.razorpayOrderId);
  assert.equal((await send(captured(o, 'pay_F2'))).body.result, 'paid'); assert.equal((await fresh(o)).paymentStatus, 'Paid');
});

test('amount mismatch is never applied as a payment', async () => {
  const { body } = await place(V, 1); const o = body.order;
  assert.equal((await send(captured(o, 'pay_M', 100))).body.result, 'amount_mismatch');
  assert.equal((await fresh(o)).paymentStatus, 'Pending');
});

test('customer closes the page: expiry cancels and releases stock; a late payment reinstates the order', async () => {
  const s0 = await stock(V); const { body } = await place(V, 3); const o = body.order; assert.equal(await stock(V), s0 - 3);
  await age(o); const out = await P.expireUnpaid(); assert.ok(out.cancelled >= 1);
  assert.equal((await fresh(o)).status, 'Cancelled'); assert.equal(await stock(V), s0, 'stock released');
  assert.equal((await call(`/api/payments/retry/${o._id}`, { method: 'POST', tok: token })).status, 404);
  assert.equal((await send(captured(o, 'pay_L'))).body.result, 'reinstated');
  const f = await fresh(o); assert.equal(f.status, 'Pending'); assert.equal(f.paymentStatus, 'Paid'); assert.equal(await stock(V), s0 - 3, 'stock re-reserved');
  assert.equal((await send(captured(o, 'pay_L'), { eventId: 'evt_new_id' })).body.result, 'already_processed');
  assert.equal(await stock(V), s0 - 3);
});

test('late payment after stock is gone is refunded automatically and never oversells', async () => {
  const v = await mkVariant(2, 'low'); const { body } = await place(v, 2); const o = body.order; assert.equal(await stock(v), 0);
  await age(o); await P.expireUnpaid(); assert.equal(await stock(v), 2);
  assert.equal((await place(v, 2, 'COD')).status, 201); assert.equal(await stock(v), 0); // someone else buys it
  refunds.length = 0; const r = await send(captured(o, 'pay_R'));
  assert.equal(r.body.result, 'refund_initiated_out_of_stock'); assert.equal(refunds.length, 1); assert.equal(refunds[0].body.amount, Math.round(o.total * 100));
  const f = await fresh(o); assert.equal(f.status, 'Refund Pending'); assert.equal(await stock(v), 0, 'never negative');
  const rp = { event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_pay_R', payment_id: 'pay_R', amount: Math.round(o.total * 100) } } } };
  assert.equal((await send(rp)).body.result, 'refunded'); assert.equal((await fresh(o)).status, 'Refunded');
  assert.equal((await send(rp, { eventId: 'evt_rp_again' })).body.result, 'already_processed');
});

test('if the refund API fails the order is flagged for manual refund', async () => {
  const v = await mkVariant(1, 'low2'); const { body } = await place(v, 1); const o = body.order; await age(o); await P.expireUnpaid(); await place(v, 1, 'COD');
  fail = true; const r = await send(captured(o, 'pay_RF')); fail = false;
  assert.equal(r.body.result, 'refund_needed_out_of_stock'); const p = await M.Payment.findOne({ order: o._id }); assert.match(p.note, /Auto-refund failed/); assert.equal((await fresh(o)).paymentStatus, 'Refund Pending');
});

test('sweeper settles a paid order whose webhook was missed instead of cancelling it', async () => {
  const { body } = await place(V, 1); const o = body.order; await age(o);
  rzPayments[o.razorpayOrderId] = [{ id: 'pay_S', status: 'captured', amount: Math.round(o.total * 100), currency: 'INR', method: 'card' }];
  const out = await P.expireUnpaid(); assert.ok(out.settled >= 1); const f = await fresh(o); assert.equal(f.paymentStatus, 'Paid'); assert.equal(f.status, 'Pending');
});

test('sweeper does not cancel when Razorpay cannot be reached', async () => {
  const { body } = await place(V, 1); const o = body.order; await age(o); const orig = fake.orders.fetchPayments;
  fake.orders.fetchPayments = async () => { throw new Error('network'); }; const out = await P.expireUnpaid(); fake.orders.fetchPayments = orig;
  assert.ok(out.skipped >= 1); assert.equal((await fresh(o)).status, 'Pending');
});

test('concurrent orders for the last unit: exactly one succeeds, stock never negative', async () => {
  const v = await mkVariant(1, 'last'); const rs = await Promise.all([place(v, 1, 'COD'), place(v, 1, 'COD'), place(v, 1, 'COD')]);
  assert.equal(rs.filter(r => r.status === 201).length, 1); assert.equal(rs.filter(r => r.status === 409).length, 2); assert.equal(await stock(v), 0);
});

test('cancelling a paid online order then refunding from admin completes via webhook', async () => {
  const { body } = await place(V, 1); const o = body.order; await send(captured(o, 'pay_C'));
  const s = await stock(V); const c = await call(`/api/orders/${o._id}/cancel`, { method: 'POST', tok: token, body: {} }); assert.equal(c.status, 200);
  assert.equal(await stock(V), s + 1); let f = await fresh(o); assert.equal(f.paymentStatus, 'Refund Pending');
  refunds.length = 0; const r = await call(`/api/manage/orders/${o._id}/refund`, { method: 'POST', tok: adminToken }); assert.equal(r.status, 200); assert.equal(refunds.length, 1);
  await send({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_pay_C', payment_id: 'pay_C', amount: Math.round(o.total * 100) } } } });
  f = await fresh(o); assert.equal(f.paymentStatus, 'Refunded'); assert.equal(f.status, 'Refunded');
});

test('unknown events are acknowledged; COD orders are unaffected', async () => {
  assert.equal((await send({ event: 'payment.authorized', payload: {} })).body.result, 'ignored');
  const { status, body } = await place(V, 1, 'COD'); assert.equal(status, 201); assert.equal(body.order.paymentStatus, 'Pending'); assert.equal(body.razorpay, null);
});

// ---------------- coupons, emails, tracking, GST ----------------
const mail = require('../utils/mailer'); const { gstBreakdown } = require('../services/invoice');
const until = async (fn, ms = 2000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, 25)); } return fn(); };
const placeWith = (v, quantity, paymentMethod, couponCode) => call('/api/orders', { method: 'POST', tok: token, body: { items: [{ variantId: String(v._id), quantity }], paymentMethod, couponCode, address: addr } });

test('cancelling an order gives the coupon use back; sweeper-cancelled and reinstated orders too', async () => {
  await M.Coupon.create({ code: 'ONCE', type: 'flat', value: 10, usageLimit: 1 });
  let r = await placeWith(V, 1, 'COD', 'ONCE'); assert.equal(r.status, 201); assert.equal((await M.Coupon.findOne({ code: 'ONCE' })).usedCount, 1);
  assert.equal((await placeWith(V, 1, 'COD', 'ONCE')).status, 400, 'limit reached');
  await call(`/api/orders/${r.body.order._id}/cancel`, { method: 'POST', tok: token, body: {} });
  assert.equal((await M.Coupon.findOne({ code: 'ONCE' })).usedCount, 0);
  r = await placeWith(V, 1, 'RAZORPAY', 'ONCE'); assert.equal(r.status, 201); const o = r.body.order; assert.equal((await M.Coupon.findOne({ code: 'ONCE' })).usedCount, 1);
  await age(o); await P.expireUnpaid(); assert.equal((await M.Coupon.findOne({ code: 'ONCE' })).usedCount, 0, 'released on expiry');
  await send(captured(o, 'pay_CP')); assert.equal((await M.Coupon.findOne({ code: 'ONCE' })).usedCount, 1, 're-applied on reinstatement');
  await call(`/api/orders/${o._id}/cancel`, { method: 'POST', tok: token, body: {} }); await call(`/api/orders/${o._id}/cancel`, { method: 'POST', tok: token, body: {} });
  assert.equal((await M.Coupon.findOne({ code: 'ONCE' })).usedCount, 0, 'released only once');
});

test('emails: COD confirmation, one payment email despite replays, shipped email carries tracking', async () => {
  mail.outbox.length = 0;
  const c = await place(V, 1, 'COD'); await until(() => mail.outbox.some(m => /received your order/i.test(m.subject)));
  assert.ok(mail.outbox.find(m => m.to === 'asha@example.com' && m.subject.includes(c.body.order.orderId)));
  const o = (await place(V, 1)).body.order; assert.equal(mail.outbox.filter(m => m.subject.includes(o.orderId)).length, 0, 'no email before an online order is paid');
  await Promise.all([send(captured(o, 'pay_E1')), send(captured(o, 'pay_E1'), { eventId: 'evt_dup_x' }), send(captured(o, 'pay_E1', undefined, 'order.paid'))]);
  await until(() => mail.outbox.filter(m => /Payment received/.test(m.subject) && m.subject.includes(o.orderId)).length >= 1); await new Promise(r => setTimeout(r, 150));
  assert.equal(mail.outbox.filter(m => /Payment received/.test(m.subject) && m.subject.includes(o.orderId)).length, 1);
  for (const s of ['Confirmed', 'Processing', 'Packed', 'Ready to Dispatch']) assert.equal((await call(`/api/manage/orders/${o._id}/status`, { method: 'PATCH', tok: adminToken, body: { status: s } })).status, 200);
  const sh = await call(`/api/manage/orders/${o._id}/status`, { method: 'PATCH', tok: adminToken, body: { status: 'Shipped', tracking: { courier: 'Delhivery', trackingNumber: 'DL123456', trackingUrl: 'https://track.example.com/DL123456' } } });
  assert.equal(sh.status, 200); assert.equal(sh.body.tracking.trackingNumber, 'DL123456');
  const m = await until(() => mail.outbox.find(x => /shipped/i.test(x.subject) && x.subject.includes(o.orderId))); assert.match(m.text, /DL123456/); assert.match(m.text, /Delhivery/);
  const mine = await call(`/api/orders/${o._id}`, { tok: token }); assert.equal(mine.body.tracking.courier, 'Delhivery');
});

test('GST: breakdown math, CGST/SGST vs IGST, and the invoice only shows tax once a GSTIN is configured', async () => {
  const intra = gstBreakdown({ total: 1180, shippingAddress: { state: 'Rajasthan' } }, { gstRate: 18, sellerState: 'rajasthan' });
  assert.deepEqual([intra.taxable, intra.tax, intra.cgst, intra.sgst, intra.igst], [1000, 180, 90, 90, 0]);
  const inter = gstBreakdown({ total: 1180, shippingAddress: { state: 'Gujarat' } }, { gstRate: 18, sellerState: 'Rajasthan' }); assert.deepEqual([inter.igst, inter.cgst, inter.sgst], [180, 0, 0]);
  const o = (await place(V, 1, 'COD')).body.order; const inv = () => fetch(`${base}/api/manage/orders/${o._id}/invoice`, { headers: { Authorization: `Bearer ${adminToken}` } }).then(r => r.text());
  let html = await inv(); assert.match(html, /Invoice/); assert.doesNotMatch(html, /GSTIN/);
  assert.equal((await call('/api/admin/settings', { method: 'PUT', tok: adminToken, body: { gstin: 'bad' } })).status, 400);
  assert.equal((await call('/api/admin/settings', { method: 'PUT', tok: adminToken, body: { legalName: 'Radha Veda Pvt Ltd', gstin: '08ABCDE1234F1Z5', sellerState: 'Rajasthan', gstRate: 18, hsnCode: '3304' } })).status, 200);
  html = await inv(); assert.match(html, /Tax Invoice/); assert.match(html, /08ABCDE1234F1Z5/); assert.match(html, /CGST @ 9%/); assert.match(html, /HSN/);
});

test('security: Mongo operator injection in query/body is rejected; oversized carts are refused', async () => {
  assert.equal((await call('/api/products?category[$ne]=x')).status, 400);
  assert.equal((await call('/api/products?q[$regex]=.*')).status, 400);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: { $ne: '' }, password: { $ne: '' } } })).status, 400);
  assert.equal((await call('/api/products?q=neem')).status, 200, 'normal queries still work');
  const items = Array.from({ length: 31 }, () => ({ variantId: String(V._id), quantity: 1 }));
  assert.equal((await call('/api/cart/quote', { method: 'POST', body: { items } })).status, 400);
});

test('role-based dashboards: one login returns the role; customer and staff dashboards return their own data only', async () => {
  const st = await M.User.create({ name: 'Staff One', email: 'staff1@t.com', password: 'Staff@12345', role: 'staff' }); await M.Staff.create({ user: st._id, permissions: ['orders.view', 'orders.update'] });
  for (const [email, password, role] of [['admin@t.com', 'Admin@12345', 'admin'], ['staff1@t.com', 'Staff@12345', 'staff'], ['asha@t.com', 'Password@1', 'customer']]) {
    const r = await call('/api/auth/login', { method: 'POST', body: { email, password } }); assert.equal(r.status, 200); assert.equal(r.body.user.role, role);
  }
  const sTok = (await call('/api/auth/login', { method: 'POST', body: { email: 'staff1@t.com', password: 'Staff@12345' } })).body.token;
  const o = (await place(V, 1, 'COD')).body.order; await call(`/api/manage/orders/${o._id}/assign`, { method: 'PATCH', tok: adminToken, body: { staffId: String(st._id) } });
  const sd = await call('/api/admin/staff/dashboard', { tok: sTok }); assert.equal(sd.status, 200); assert.equal(sd.body.total, 1); assert.equal(sd.body.recentOrders.length, 1);
  const cd = await call('/api/dashboard', { tok: token }); assert.equal(cd.status, 200); assert.ok(cd.body.totalOrders >= 1 && cd.body.recentOrders.length >= 1); assert.equal(typeof cd.body.totalSpent, 'number');
  assert.equal((await call('/api/dashboard')).status, 401, 'dashboard needs login');
  assert.equal((await call('/api/admin/dashboard', { tok: token })).status, 403, 'customer cannot read the admin dashboard');
  assert.equal((await call('/api/admin/dashboard', { tok: sTok })).status, 403, 'staff cannot read the admin dashboard');
  assert.equal((await call('/api/admin/staff/dashboard', { tok: token })).status, 403, 'customer cannot read the staff dashboard');
  assert.equal((await call('/api/dashboard', { tok: adminToken })).body.totalOrders, 0, 'each user only sees their own orders');
});

test('WhatsApp number: normalised on save, invalid numbers rejected, public settings expose it, emails include the link', async () => {
  const put = (whatsapp) => call('/api/admin/settings', { method: 'PUT', tok: adminToken, body: { whatsapp } });
  for (const [input, stored] of [['98765 43210', '919876543210'], ['+91 98765-43210', '919876543210'], ['09876543210', '919876543210'], ['919876543210', '919876543210']]) {
    const r = await put(input); assert.equal(r.status, 200, input); assert.equal(r.body.whatsapp, stored, input);
  }
  assert.equal((await put('abc')).status, 400); assert.equal((await put('12345')).status, 400);
  assert.equal((await call('/api/settings')).body.whatsapp, '919876543210', 'storefront can read it without logging in');
  mail.outbox.length = 0; const c = await place(V, 1, 'COD');
  const m = await until(() => mail.outbox.find(x => x.subject.includes(c.body.order.orderId))); assert.match(m.text, /wa\.me\/919876543210/);
  assert.equal((await put('')).body.whatsapp, '', 'can be cleared to hide the chat button');
});
