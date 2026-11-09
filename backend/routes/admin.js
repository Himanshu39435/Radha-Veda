const router = require('express').Router();
const { z } = require('zod');
const { User, Staff, Order, Product, ProductVariant, Coupon, Payment, InventoryTransaction, Setting, Category } = require('../models');
const { ah, HttpError } = require('../utils/helpers');
const { protect, authorize } = require('../middleware/auth');
const { getSettings } = require('../services/orderService');

const REV = { status: { $nin: ['Cancelled', 'Returned', 'Refund Pending', 'Refunded'] }, paymentStatus: 'Paid' };

// ---------- Staff panel dashboard ----------
router.get('/staff/dashboard', protect, authorize('staff'), ah(async (req, res) => {
  const base = { assignedTo: req.user._id };
  const [agg, recent] = await Promise.all([Order.aggregate([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]), Order.find(base).sort('-updatedAt').limit(8).select('orderId shippingAddress.name total status paymentMethod paymentStatus updatedAt')]);
  const c = Object.fromEntries(agg.map(x => [x._id, x.n])); const total = agg.reduce((n, x) => n + x.n, 0);
  res.json({ total, pending: (c.Pending || 0) + (c.Confirmed || 0), processing: c.Processing || 0, packed: c.Packed || 0, ready: c['Ready to Dispatch'] || 0, shipped: c.Shipped || 0, delivered: c.Delivered || 0, statusSummary: c, recentOrders: recent });
}));

router.use(protect, authorize('admin'));

// ---------- Dashboard ----------
router.get('/dashboard', ah(async (req, res) => {
  const [rev, orders, customers, products, statusAgg, lowStock] = await Promise.all([
    Order.aggregate([{ $match: REV }, { $group: { _id: null, t: { $sum: '$total' } } }]),
    Order.countDocuments(), User.countDocuments({ role: 'customer' }), Product.countDocuments(),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ProductVariant.countDocuments({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
  ]);
  const byStatus = Object.fromEntries(statusAgg.map(s => [s._id, s.n]));
  const since = new Date(Date.now() - 29 * 864e5); since.setHours(0, 0, 0, 0);
  const [daily, best, recent] = await Promise.all([
    Order.aggregate([{ $match: { ...REV, createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Order.aggregate([{ $match: { status: { $nin: ['Cancelled', 'Returned', 'Refunded'] } } }, { $unwind: '$items' }, { $group: { _id: '$items.product', name: { $first: '$items.name' }, units: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } }, { $sort: { units: -1 } }, { $limit: 5 }]),
    Order.find().sort('-createdAt').limit(8).select('orderId shippingAddress.name total status paymentMethod paymentStatus createdAt'),
  ]);
  res.json({ revenue: rev[0]?.t || 0, orders, customers, products, pending: byStatus.Pending || 0, processing: byStatus.Processing || 0, delivered: byStatus.Delivered || 0, lowStock, statusSummary: byStatus, revenueByDate: daily, bestSellers: best, recentOrders: recent });
}));

// ---------- Customers ----------
router.get('/customers', ah(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query; const f = { role: 'customer' };
  if (q) { const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); f.$or = [{ name: rx }, { email: rx }, { phone: rx }]; }
  const [customers, total] = await Promise.all([User.find(f).sort('-createdAt').skip((+page - 1) * +limit).limit(+limit), User.countDocuments(f)]);
  res.json({ customers, total, pages: Math.ceil(total / +limit) });
}));
router.get('/customers/:id', ah(async (req, res) => {
  const c = await User.findOne({ _id: req.params.id, role: 'customer' }); if (!c) throw new HttpError(404, 'Not found');
  const { Address } = require('../models');
  res.json({ customer: c, addresses: await Address.find({ user: c._id }), orders: await Order.find({ user: c._id }).sort('-createdAt') });
}));

// ---------- Staff management ----------
const PERMS = ['orders.view', 'orders.update', 'orders.invoice', 'orders.payment'];
router.get('/staff', ah(async (req, res) => {
  const list = (await Staff.find().populate('user', 'name email phone isActive')).filter(s => s.user);
  const counts = await Order.aggregate([{ $match: { assignedTo: { $ne: null } } }, { $group: { _id: '$assignedTo', n: { $sum: 1 } } }]);
  res.json(list.map(s => ({ ...s.toObject(), assignedOrders: counts.find(c => String(c._id) === String(s.user._id))?.n || 0, activity: s.activity.slice(-20).reverse() })));
}));
router.post('/staff', ah(async (req, res) => {
  const b = z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().optional(), password: z.string().min(8), permissions: z.array(z.enum(PERMS)).default(PERMS) }).parse(req.body);
  const u = await User.create({ name: b.name, email: b.email, phone: b.phone, password: b.password, role: 'staff' });
  const s = await Staff.create({ user: u._id, permissions: b.permissions });
  res.status(201).json(s);
}));
router.put('/staff/:id', ah(async (req, res) => {
  const b = z.object({ name: z.string().min(2).optional(), phone: z.string().optional(), password: z.string().min(8).optional(), isActive: z.boolean().optional(), permissions: z.array(z.enum(PERMS)).optional() }).parse(req.body);
  const s = await Staff.findById(req.params.id); if (!s) throw new HttpError(404, 'Not found');
  const u = await User.findById(s.user);
  for (const k of ['name', 'phone', 'password', 'isActive']) if (b[k] !== undefined) u[k] = b[k];
  await u.save(); if (b.permissions) { s.permissions = b.permissions; await s.save(); }
  res.json(s);
}));

// ---------- Inventory ----------
router.get('/inventory', ah(async (req, res) => {
  const { filter } = req.query; const f = {};
  if (filter === 'low') f.$expr = { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] };
  if (filter === 'out') f.stock = 0;
  res.json(await ProductVariant.find(f).populate('product', 'name images').sort('stock'));
}));
router.post('/inventory/:variantId/adjust', ah(async (req, res) => {
  const b = z.object({ change: z.number().int().refine(n => n !== 0), note: z.string().optional() }).parse(req.body);
  const v = await ProductVariant.findOneAndUpdate({ _id: req.params.variantId, stock: { $gte: b.change < 0 ? -b.change : 0 } }, { $inc: { stock: b.change } }, { new: true });
  if (!v) throw new HttpError(400, 'Adjustment would make stock negative');
  await InventoryTransaction.create({ variant: v._id, product: v.product, type: b.change > 0 ? 'restock' : 'adjustment', change: b.change, before: v.stock - b.change, after: v.stock, by: req.user._id, note: b.note });
  res.json(v);
}));
router.get('/inventory/history', ah(async (req, res) => {
  const f = req.query.variant ? { variant: req.query.variant } : {};
  res.json(await InventoryTransaction.find(f).populate('variant', 'sku weight').populate('product', 'name').populate('by', 'name').sort('-createdAt').limit(200));
}));

// ---------- Payments ----------
router.get('/payments', ah(async (req, res) => {
  const f = {}; if (req.query.method) f.method = req.query.method; if (req.query.status) f.status = req.query.status;
  res.json(await Payment.find(f).populate('order', 'orderId status total shippingAddress.name').sort('-createdAt').limit(200));
}));

// ---------- Coupons ----------
const couponZ = z.object({ code: z.string().min(3), type: z.enum(['percent', 'flat']), value: z.number().positive(), minOrder: z.number().min(0).optional(), maxDiscount: z.number().positive().optional(), expiresAt: z.string().datetime().optional().nullable(), usageLimit: z.number().int().positive().optional(), isActive: z.boolean().optional() }).refine(c => c.type !== 'percent' || c.value <= 100, { message: 'Percent must be ≤ 100' });
router.get('/coupons', ah(async (req, res) => res.json(await Coupon.find().sort('-createdAt'))));
router.post('/coupons', ah(async (req, res) => res.status(201).json(await Coupon.create(couponZ.parse(req.body)))));
router.put('/coupons/:id', ah(async (req, res) => res.json(await Coupon.findByIdAndUpdate(req.params.id, couponZ.parse(req.body), { new: true, runValidators: true }))));
router.delete('/coupons/:id', ah(async (req, res) => { await Coupon.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }));

// ---------- Reports ----------
router.get('/reports', ah(async (req, res) => {
  const { period = 'daily', from, to, format } = req.query;
  const m = { ...REV }; if (from || to) m.createdAt = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(new Date(to).setHours(23, 59, 59, 999)) }) };
  const fmt = { daily: '%Y-%m-%d', weekly: '%G-W%V', monthly: '%Y-%m' }[period] || '%Y-%m-%d';
  const [series, byProduct, byCategory, byPayment, totals] = await Promise.all([
    Order.aggregate([{ $match: m }, { $group: { _id: { $dateToString: { format: fmt, date: '$createdAt', timezone: 'Asia/Kolkata' } }, orders: { $sum: 1 }, revenue: { $sum: '$total' } } }, { $sort: { _id: 1 } }]),
    Order.aggregate([{ $match: m }, { $unwind: '$items' }, { $group: { _id: '$items.name', units: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } }, { $sort: { revenue: -1 } }]),
    Order.aggregate([{ $match: m }, { $unwind: '$items' }, { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' } }, { $unwind: '$p' }, { $lookup: { from: 'categories', localField: 'p.category', foreignField: '_id', as: 'c' } }, { $unwind: '$c' }, { $group: { _id: '$c.name', units: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } }, { $sort: { revenue: -1 } }]),
    Order.aggregate([{ $match: m }, { $group: { _id: '$paymentMethod', orders: { $sum: 1 }, revenue: { $sum: '$total' } } }]),
    Order.aggregate([{ $match: m }, { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } }]),
  ]);
  if (format === 'csv') {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = ['Section,Label,Orders/Units,Revenue',
      ...series.map(r => `${period},${q(r._id)},${r.orders},${r.revenue}`),
      ...byProduct.map(r => `product,${q(r._id)},${r.units},${r.revenue}`),
      ...byCategory.map(r => `category,${q(r._id)},${r.units},${r.revenue}`),
      ...byPayment.map(r => `payment,${q(r._id)},${r.orders},${r.revenue}`)].join('\n');
    return res.type('text/csv').attachment('sales-report.csv').send(csv);
  }
  res.json({ totals: totals[0] || { orders: 0, revenue: 0 }, series, byProduct, byCategory, byPayment });
}));

// ---------- Website settings ----------
router.put('/settings', ah(async (req, res) => {
  const b = z.object({
    brandName: z.string().min(1).optional(), logo: z.string().optional(),
    whatsapp: z.string().optional().transform(v => { if (v == null) return v; if (!v.trim()) return ''; const d = v.replace(/\D/g, ''); if (!d) return v; /* no digits at all: leave as-is so validation rejects it instead of silently clearing the number */ if (d.length === 10) return '91' + d; if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1); return d; }).refine(v => v == null || v === '' || /^\d{11,15}$/.test(v), 'Enter a valid WhatsApp number with country code, e.g. 919876543210'),
    contact: z.object({ email: z.string().optional(), phone: z.string().optional(), address: z.string().optional() }).optional(),
    social: z.object({ instagram: z.string().optional(), facebook: z.string().optional(), youtube: z.string().optional() }).optional(),
    shippingCharge: z.number().min(0).optional(), freeShippingThreshold: z.number().min(0).optional(),
    legalName: z.string().optional(), gstin: z.string().regex(/^$|^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, 'Invalid GSTIN').optional(), sellerState: z.string().optional(), gstRate: z.number().min(0).max(28).optional(), hsnCode: z.string().optional(),
    returnPolicy: z.string().optional(), privacyPolicy: z.string().optional(), terms: z.string().optional(),
    banners: z.array(z.object({ image: z.string(), title: z.string().optional(), link: z.string().optional(), active: z.boolean().optional() })).optional(),
  }).parse(req.body);
  await getSettings(); res.json(await Setting.findOneAndUpdate({ key: 'main' }, b, { new: true }));
}));
module.exports = router;
