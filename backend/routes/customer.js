const router = require('express').Router();
const crypto = require('crypto');
const { z } = require('zod');
const { Address, User, Order, Payment, Coupon } = require('../models');
const { ah, HttpError, genOrderId } = require('../utils/helpers');
const { protect } = require('../middleware/auth');
const S = require('../services/orderService');

const P = require('../services/paymentService');
const notify = require('../services/notify');
const itemsZ = z.array(z.object({ variantId: z.string(), quantity: z.number().int().min(1).max(20) })).min(1).max(30);

// Cart quote (public so guests can see totals/coupons before login)
router.post('/cart/quote', ah(async (req, res) => {
  const b = z.object({ items: itemsZ, couponCode: z.string().optional() }).parse(req.body);
  const r = await S.priceCart(b.items, b.couponCode);
  res.json({ items: r.lines, subtotal: r.subtotal, discount: r.discount, shipping: r.shipping, total: r.total, couponCode: r.coupon?.code });
}));

router.use(protect);

// ---------- Customer dashboard ----------
router.get('/dashboard', ah(async (req, res) => {
  const uid = req.user._id; const dead = ['Cancelled', 'Returned', 'Refund Pending', 'Refunded'];
  const [orders, me, addresses] = await Promise.all([
    Order.find({ user: uid }).sort('-createdAt').select('orderId total status paymentStatus paymentMethod createdAt items.name items.quantity').lean(),
    User.findById(uid).select('wishlist').lean(), Address.countDocuments({ user: uid }),
  ]);
  const summary = {}; orders.forEach(o => { summary[o.status] = (summary[o.status] || 0) + 1; });
  const waiting = orders.find(o => o.paymentMethod === 'RAZORPAY' && o.status === 'Pending' && ['Pending', 'Failed'].includes(o.paymentStatus));
  res.json({
    totalOrders: orders.length, activeOrders: orders.filter(o => o.status !== 'Delivered' && !dead.includes(o.status)).length,
    delivered: summary.Delivered || 0, wishlist: me?.wishlist?.length || 0, addresses,
    totalSpent: orders.filter(o => !dead.includes(o.status) && (o.status === 'Delivered' || o.paymentStatus === 'Paid')).reduce((n, o) => n + o.total, 0),
    awaitingPaymentOrderId: waiting?._id || null, statusSummary: summary, recentOrders: orders.slice(0, 6),
  });
}));

// ---------- Addresses ----------
const addrZ = z.object({ name: z.string().min(2), phone: z.string().regex(/^[6-9]\d{9}$/), line1: z.string().min(5), state: z.string().min(2), city: z.string().min(2), pincode: z.string().regex(/^\d{6}$/), isDefault: z.boolean().optional() });
router.get('/addresses', ah(async (req, res) => res.json(await Address.find({ user: req.user._id }).sort('-isDefault -createdAt'))));
router.post('/addresses', ah(async (req, res) => {
  const b = addrZ.parse(req.body);
  if (b.isDefault) await Address.updateMany({ user: req.user._id }, { isDefault: false });
  res.status(201).json(await Address.create({ ...b, user: req.user._id }));
}));
router.put('/addresses/:id', ah(async (req, res) => {
  const b = addrZ.parse(req.body);
  if (b.isDefault) await Address.updateMany({ user: req.user._id }, { isDefault: false });
  const a = await Address.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, b, { new: true });
  if (!a) throw new HttpError(404, 'Not found'); res.json(a);
}));
router.delete('/addresses/:id', ah(async (req, res) => { await Address.deleteOne({ _id: req.params.id, user: req.user._id }); res.json({ message: 'Deleted' }); }));

// ---------- Wishlist ----------
router.get('/wishlist', ah(async (req, res) => res.json(await S.enrichProducts((await User.findById(req.user._id).populate('wishlist')).wishlist.map(w => w.toObject())))));
router.post('/wishlist/:productId', ah(async (req, res) => { await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: req.params.productId } }); res.json({ message: 'Added' }); }));
router.delete('/wishlist/:productId', ah(async (req, res) => { await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.params.productId } }); res.json({ message: 'Removed' }); }));

// ---------- Orders ----------
router.post('/orders', ah(async (req, res) => {
  const b = z.object({
    items: itemsZ, couponCode: z.string().optional(), paymentMethod: z.enum(['COD', 'RAZORPAY']),
    address: z.object({ name: z.string().min(2), phone: z.string().regex(/^[6-9]\d{9}$/), email: z.string().email(), line1: z.string().min(5), state: z.string().min(2), city: z.string().min(2), pincode: z.string().regex(/^\d{6}$/) }),
  }).parse(req.body);
  const r = await S.priceCart(b.items, b.couponCode);
  const orderId = genOrderId(); let rzOrder;
  if (b.paymentMethod === 'RAZORPAY') rzOrder = await P.client().orders.create({ amount: Math.round(r.total * 100), currency: 'INR', receipt: orderId });
  const order = new Order({
    orderId, user: req.user._id, items: r.lines, shippingAddress: b.address,
    subtotal: r.subtotal, discount: r.discount, shipping: r.shipping, total: r.total, couponCode: r.coupon?.code,
    paymentMethod: b.paymentMethod, razorpayOrderId: rzOrder?.id, timeline: [{ status: 'Pending', note: 'Order placed', by: req.user._id }],
  });
  await S.deductStock(r.lines, order._id, req.user._id);
  try { await order.save(); } catch (e) { await S.restoreStock(order, req.user._id, 'Order creation failed'); throw e; }
  if (r.coupon) await Coupon.updateOne({ _id: r.coupon._id }, { $inc: { usedCount: 1 } });
  await Payment.create({ order: order._id, method: b.paymentMethod, amount: r.total, razorpayOrderId: rzOrder?.id });
  if (b.paymentMethod === 'COD') notify.orderPlaced(order);
  res.status(201).json({ order, razorpay: rzOrder ? { keyId: process.env.RAZORPAY_KEY_ID, orderId: rzOrder.id, amount: rzOrder.amount, currency: 'INR' } : null });
}));

router.get('/orders', ah(async (req, res) => res.json(await Order.find({ user: req.user._id }).sort('-createdAt'))));
router.get('/orders/:id', ah(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user._id }).populate('assignedTo', 'name');
  if (!o) throw new HttpError(404, 'Order not found');
  const awaiting = o.paymentMethod === 'RAZORPAY' && o.status === 'Pending' && ['Pending', 'Failed'].includes(o.paymentStatus);
  res.json({ ...o.toObject(), awaitingPayment: awaiting, paymentExpiresAt: awaiting ? new Date(o.createdAt.getTime() + P.expiryMinutes() * 60000) : null });
}));
router.post('/orders/:id/cancel', ah(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!o) throw new HttpError(404, 'Order not found');
  if (!['Pending', 'Confirmed'].includes(o.status)) throw new HttpError(400, 'Order can no longer be cancelled');
  await S.changeStatus(o, 'Cancelled', req.user, req.body?.reason || 'Cancelled by customer');
  res.json(o);
}));

// ---------- Razorpay ----------
// Browser-side confirmation. The webhook is the source of truth; both paths share settlePayment() so they can never double-process.
router.post('/payments/verify', ah(async (req, res) => {
  const b = z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }).parse(req.body);
  const order = await Order.findOne({ razorpayOrderId: b.razorpay_order_id, user: req.user._id });
  if (!order) throw new HttpError(404, 'Order not found');
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${b.razorpay_order_id}|${b.razorpay_payment_id}`).digest('hex');
  const ok = expected.length === b.razorpay_signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(b.razorpay_signature));
  if (!ok) throw new HttpError(400, 'Payment verification failed'); // never downgrade a real payment because of a bad client call
  const r = await P.settlePayment({ razorpayOrderId: b.razorpay_order_id, paymentId: b.razorpay_payment_id, source: 'checkout' });
  res.json({ message: 'Payment verified', result: r.result, order: await Order.findById(order._id) });
}));
// Customer closed the Razorpay window or the payment failed: re-open payment on the SAME order (stock stays reserved until it expires).
router.post('/payments/retry/:id', ah(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user._id, paymentMethod: 'RAZORPAY', status: 'Pending', paymentStatus: { $in: ['Pending', 'Failed'] } });
  if (!o) throw new HttpError(404, 'No payment is pending for this order');
  if (Date.now() - o.createdAt.getTime() > P.expiryMinutes() * 60000) throw new HttpError(400, 'The payment window has closed. Please place a new order.');
  res.json({ razorpay: { keyId: process.env.RAZORPAY_KEY_ID, orderId: o.razorpayOrderId, amount: Math.round(o.total * 100), currency: 'INR' } });
}));
module.exports = router;
