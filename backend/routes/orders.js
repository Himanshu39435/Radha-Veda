// Shared by admin + staff, with role-aware scoping
const router = require('express').Router();
const { z } = require('zod');
const { Order, Staff, User, Payment } = require('../models');
const P = require('../services/paymentService');
const { ah, HttpError } = require('../utils/helpers');
const { protect, authorize, staffCan } = require('../middleware/auth');
const S = require('../services/orderService');
router.use(protect, authorize('admin', 'staff'));
const scope = (req) => (req.user.role === 'staff' ? { assignedTo: req.user._id } : {});
const log = (req, action, order) => req.user.role === 'staff' && Staff.updateOne({ user: req.user._id }, { $push: { activity: { action, order: order._id } } }).exec();

router.get('/', staffCan('orders.view'), ah(async (req, res) => {
  const { q, status, payment, from, to, assigned, page = 1, limit = 20 } = req.query;
  const f = { ...scope(req) };
  if (status) f.status = { $in: String(status).split(',') };
  if (payment) f.paymentMethod = payment;
  if (assigned && req.user.role === 'admin') f.assignedTo = assigned === 'none' ? null : assigned;
  if (from || to) f.createdAt = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(new Date(to).setHours(23, 59, 59, 999)) }) };
  if (q) { const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); f.$or = [{ orderId: rx }, { 'shippingAddress.name': rx }, { 'shippingAddress.phone': rx }]; }
  const [orders, total] = await Promise.all([Order.find(f).populate('assignedTo', 'name').sort('-createdAt').skip((+page - 1) * +limit).limit(+limit), Order.countDocuments(f)]);
  res.json({ orders, total, pages: Math.ceil(total / +limit) });
}));
router.get('/:id', staffCan('orders.view'), ah(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, ...scope(req) }).populate('assignedTo', 'name email').populate('user', 'name email phone');
  if (!o) throw new HttpError(404, 'Order not found'); res.json(o);
}));
router.patch('/:id/status', staffCan('orders.update'), ah(async (req, res) => {
  const { status, note, tracking } = z.object({ status: z.enum(['Confirmed', 'Processing', 'Packed', 'Ready to Dispatch', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refund Pending', 'Refunded']), note: z.string().optional(), tracking: z.object({ courier: z.string().max(60).optional(), trackingNumber: z.string().max(60).optional(), trackingUrl: z.string().url().optional().or(z.literal('')) }).optional() }).parse(req.body);
  if (req.user.role === 'staff' && !S.STAFF_STATUSES.includes(status)) throw new HttpError(403, 'Staff cannot set this status');
  const o = await Order.findOne({ _id: req.params.id, ...scope(req) });
  if (!o) throw new HttpError(404, 'Order not found');
  if (status === 'Shipped' && tracking) o.tracking = tracking;
  await S.changeStatus(o, status, req.user, note); await log(req, `Status → ${status}`, o); res.json(o);
}));
router.patch('/:id/payment', staffCan('orders.payment'), ah(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, ...scope(req) });
  if (!o) throw new HttpError(404, 'Order not found');
  if (o.paymentMethod !== 'COD') throw new HttpError(400, 'Online payments are verified automatically');
  if (o.status !== 'Delivered') throw new HttpError(400, 'Collect COD payment only after delivery');
  o.paymentStatus = 'Paid'; o.timeline.push({ status: o.status, note: 'COD payment collected', by: req.user._id }); await o.save();
  const { Payment } = require('../models'); await Payment.updateOne({ order: o._id }, { status: 'Paid', verifiedAt: new Date() });
  await log(req, 'COD payment collected', o); res.json(o);
}));
router.patch('/:id/assign', authorize('admin'), ah(async (req, res) => {
  const { staffId } = z.object({ staffId: z.string().nullable() }).parse(req.body);
  if (staffId) { const u = await User.findOne({ _id: staffId, role: 'staff', isActive: true }); if (!u) throw new HttpError(400, 'Invalid or inactive staff'); }
  const o = await Order.findById(req.params.id); if (!o) throw new HttpError(404, 'Order not found');
  o.assignedTo = staffId; o.timeline.push({ status: o.status, note: staffId ? 'Assigned to staff' : 'Unassigned', by: req.user._id }); await o.save();
  if (staffId) await Staff.updateOne({ user: staffId }, { $push: { activity: { action: 'Order assigned', order: o._id } } });
  res.json(o);
}));
router.post('/:id/refund', authorize('admin'), ah(async (req, res) => {
  const o = await Order.findById(req.params.id); if (!o) throw new HttpError(404, 'Order not found');
  const pay = await Payment.findOne({ order: o._id });
  if (o.paymentMethod !== 'RAZORPAY' || o.paymentStatus !== 'Refund Pending' || !pay?.transactionId) throw new HttpError(400, 'No online refund is pending for this order');
  const r = await P.refundPayment(o, pay.transactionId, Math.round(o.total * 100), 'Admin refund');
  if (!r.ok) throw new HttpError(502, `Razorpay could not start the refund: ${r.error}`);
  await Payment.updateOne({ _id: pay._id }, { $set: { refundId: r.refundId, note: undefined } });
  o.timeline.push({ status: o.status, note: 'Refund initiated from admin panel', by: req.user._id }); await o.save();
  res.json({ message: 'Refund initiated. Status updates automatically when Razorpay confirms.', order: o }); // refund.processed webhook finalises it
}));
router.get('/:id/invoice', staffCan('orders.invoice'), ah(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, ...scope(req) });
  if (!o) throw new HttpError(404, 'Order not found');
  res.type('html').send(require('../services/invoice').invoiceHtml(o, (await S.getSettings()).toObject()));
}));
module.exports = router;
