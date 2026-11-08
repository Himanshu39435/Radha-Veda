// All Razorpay payment state changes go through here. Every function is idempotent and
// uses atomic conditional updates, so checkout-verify, webhooks and the expiry sweeper
// can run concurrently (or be retried) without double-processing a payment or stock.
const Razorpay = require('razorpay');
const { Order, Payment } = require('../models');
const S = require('./orderService');
const notify = require('./notify');
const { HttpError } = require('../utils/helpers');

let override = null; // tests inject a fake client
const setClient = (c) => { override = c; };
const hasKeys = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const client = () => {
  if (override) return override;
  if (!hasKeys()) throw new HttpError(503, 'Online payments are not configured');
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};
const expiryMinutes = () => +process.env.PAYMENT_EXPIRY_MINUTES || 30;
const paise = (o) => Math.round(o.total * 100);
const note = (id, status, text) => Order.updateOne({ _id: id }, { $push: { timeline: { status, note: text } } });

async function refundPayment(order, paymentId, amount, reason) {
  try {
    const r = await client().payments.refund(paymentId, { amount, speed: 'normal', notes: { orderId: order.orderId, reason } });
    return { ok: true, refundId: r.id };
  } catch (e) { return { ok: false, error: e?.error?.description || e.message }; }
}

// Payment arrived for an order that was already cancelled (customer closed the page, order expired).
async function reinstate(order, paymentId) {
  const lines = order.items.map(i => ({ variant: i.variant, product: i.product, name: i.name, weight: i.weight, quantity: i.quantity }));
  try { await S.deductStock(lines, order._id, null); } // atomic: fails if stock is gone, never oversells
  catch {
    const r = await refundPayment(order, paymentId, paise(order), 'Out of stock after late payment');
    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'Refund Pending', status: 'Refund Pending' }, $push: { timeline: { status: 'Refund Pending', note: r.ok ? 'Payment arrived after the order expired and stock had run out. Refund initiated automatically.' : `Payment arrived after expiry and stock ran out. Automatic refund failed (${r.error}); refund manually from the admin panel.` } } });
    await Payment.updateOne({ order: order._id }, { $set: { status: 'Refund Pending', refundStatus: 'Pending', refundId: r.refundId, note: r.ok ? undefined : `Auto-refund failed: ${r.error}` } });
    return { result: r.ok ? 'refund_initiated_out_of_stock' : 'refund_needed_out_of_stock' };
  }
  await S.reapplyCoupon(order);
  await Order.updateOne({ _id: order._id, status: 'Cancelled' }, { $set: { status: 'Pending', stockRestored: false }, $push: { timeline: { status: 'Pending', note: 'Payment received after cancellation. Order reinstated and stock re-reserved.' } } });
  return { result: 'reinstated' };
}

async function settlePayment({ razorpayOrderId, paymentId, amount, currency = 'INR', method, source }) {
  const order = await Order.findOne({ razorpayOrderId });
  if (!order) return { result: 'order_not_found' };
  if (amount != null && (amount !== paise(order) || currency !== 'INR')) {
    await note(order._id, order.status, `Payment ${paymentId} NOT applied: amount mismatch (got ${amount} ${currency}, expected ${paise(order)} INR). Review in Razorpay.`);
    await Payment.updateOne({ order: order._id }, { $set: { note: `Amount mismatch on ${paymentId}` } });
    return { result: 'amount_mismatch', order };
  }
  // Atomic claim: only one caller can move Pending/Failed -> Paid.
  const claimed = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: { $in: ['Pending', 'Failed'] } }, { $set: { paymentStatus: 'Paid' } }, { new: true });
  if (!claimed) return { result: 'already_processed', order };
  await Payment.updateOne({ order: order._id }, { $set: { status: 'Paid', transactionId: paymentId, channel: method, verifiedAt: new Date(), failureReason: undefined } });
  if (claimed.status === 'Cancelled') { const r = await reinstate(claimed, paymentId); if (r.result === 'reinstated') notify.paymentReceived(claimed); return { ...r, source }; }
  await note(order._id, claimed.status, `Online payment received${method ? ` via ${method}` : ''}`);
  notify.paymentReceived(claimed); // only the caller that wins the atomic claim reaches this line
  return { result: 'paid', source };
}

async function markFailed({ razorpayOrderId, paymentId, reason }) {
  const order = await Order.findOne({ razorpayOrderId });
  if (!order) return { result: 'order_not_found' };
  // Only Pending -> Failed. A later successful attempt on the same Razorpay order can still settle it.
  const r = await Order.updateOne({ _id: order._id, paymentStatus: 'Pending' }, { $set: { paymentStatus: 'Failed' }, $push: { timeline: { status: order.status, note: `Payment attempt failed${reason ? `: ${reason}` : ''}` } } });
  if (r.modifiedCount) await Payment.updateOne({ order: order._id, status: 'Pending' }, { $set: { status: 'Failed', failureReason: reason } });
  return { result: r.modifiedCount ? 'failure_recorded' : 'ignored' };
}

async function refundProcessed({ paymentId, refundId, amount }) {
  const pay = await Payment.findOne({ transactionId: paymentId });
  if (!pay) return { result: 'payment_not_found' };
  const order = await Order.findById(pay.order);
  if (amount != null && amount < paise(order)) { await note(order._id, order.status, `Partial refund of ₹${amount / 100} processed`); return { result: 'partial_refund_noted' }; }
  const done = await Payment.findOneAndUpdate({ _id: pay._id, refundStatus: { $ne: 'Refunded' } }, { $set: { refundStatus: 'Refunded', status: 'Refunded', refundId } });
  if (!done) return { result: 'already_processed' };
  const upd = { paymentStatus: 'Refunded' };
  if (['Cancelled', 'Returned', 'Refund Pending'].includes(order.status)) upd.status = 'Refunded';
  await Order.updateOne({ _id: order._id }, { $set: upd, $push: { timeline: { status: upd.status || order.status, note: 'Refund processed by Razorpay' } } });
  notify.statusChanged({ ...order.toObject(), paymentStatus: 'Refunded' }, 'Refunded');
  return { result: 'refunded' };
}

async function refundFailed({ paymentId }) {
  const pay = await Payment.findOne({ transactionId: paymentId });
  if (pay) { await Payment.updateOne({ _id: pay._id }, { $set: { note: 'Razorpay reported the refund as failed. Retry from admin.' } }); await note(pay.order, 'Refund Pending', 'Refund failed at Razorpay. Retry from the admin panel.'); }
  return { result: 'refund_failure_noted' };
}

// Cancel unpaid online orders after the window, releasing stock. Checks Razorpay first in case a webhook was missed.
async function expireUnpaid() {
  const cutoff = new Date(Date.now() - expiryMinutes() * 60000);
  const stale = await Order.find({ paymentMethod: 'RAZORPAY', status: 'Pending', paymentStatus: { $in: ['Pending', 'Failed'] }, createdAt: { $lt: cutoff } }).limit(50);
  const out = { settled: 0, cancelled: 0, skipped: 0 };
  for (const o of stale) {
    let captured;
    try { captured = (await client().orders.fetchPayments(o.razorpayOrderId)).items?.find(p => p.status === 'captured'); }
    catch { out.skipped++; continue; } // can't confirm with Razorpay -> don't cancel, try next run
    if (captured) { await settlePayment({ razorpayOrderId: o.razorpayOrderId, paymentId: captured.id, amount: captured.amount, currency: captured.currency, method: captured.method, source: 'sweeper' }); out.settled++; continue; }
    const c = await Order.findOneAndUpdate({ _id: o._id, status: 'Pending', paymentStatus: { $in: ['Pending', 'Failed'] } }, { $set: { status: 'Cancelled' }, $push: { timeline: { status: 'Cancelled', note: 'Online payment not completed in time' } } }, { new: true });
    if (c) { await S.restoreStock(c, null, 'Unpaid online order expired'); await S.releaseCoupon(c); out.cancelled++; }
  }
  return out;
}
function startSweeper() {
  const run = () => expireUnpaid().then(r => (r.settled || r.cancelled) && console.log('[sweeper]', r)).catch(e => console.error('[sweeper]', e.message));
  setTimeout(run, 15000); return setInterval(run, 5 * 60 * 1000).unref();
}
module.exports = { setClient, client, hasKeys, expiryMinutes, refundPayment, settlePayment, markFailed, refundProcessed, refundFailed, expireUnpaid, startSweeper };
