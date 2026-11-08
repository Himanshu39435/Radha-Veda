const { ProductVariant, Product, Coupon, Setting, Order, Payment, InventoryTransaction } = require('../models');
const { HttpError } = require('../utils/helpers');
const notify = require('./notify');

const TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'], Confirmed: ['Processing', 'Cancelled'], Processing: ['Packed', 'Cancelled'],
  Packed: ['Ready to Dispatch', 'Cancelled'], 'Ready to Dispatch': ['Shipped', 'Cancelled'],
  Shipped: ['Delivered', 'Returned'], Delivered: ['Returned'], Cancelled: ['Refund Pending'],
  Returned: ['Refund Pending'], 'Refund Pending': ['Refunded'], Refunded: [],
};
const STAFF_STATUSES = ['Confirmed', 'Processing', 'Packed', 'Ready to Dispatch', 'Shipped', 'Delivered'];
const getSettings = async () => (await Setting.findOne({ key: 'main' })) || (await Setting.create({ key: 'main' }));

async function evaluateCoupon(code, subtotal) {
  if (!code) return { discount: 0, coupon: null };
  const c = await Coupon.findOne({ code: code.trim().toUpperCase(), isActive: true });
  if (!c) throw new HttpError(400, 'Invalid coupon code');
  if (c.expiresAt && c.expiresAt < new Date()) throw new HttpError(400, 'Coupon has expired');
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) throw new HttpError(400, 'Coupon usage limit reached');
  if (subtotal < c.minOrder) throw new HttpError(400, `Minimum order ₹${c.minOrder} required for this coupon`);
  let d = c.type === 'percent' ? (subtotal * c.value) / 100 : c.value;
  if (c.type === 'percent' && c.maxDiscount) d = Math.min(d, c.maxDiscount);
  return { discount: Math.round(Math.min(d, subtotal)), coupon: c };
}

// Prices always recomputed on the server from DB - never trusted from the client.
async function priceCart(items, couponCode) {
  const lines = []; let subtotal = 0;
  for (const it of items) {
    const v = await ProductVariant.findById(it.variantId).populate('product');
    if (!v || !v.product || !v.product.isAvailable) throw new HttpError(400, 'A product in your cart is unavailable');
    if (v.stock < it.quantity) throw new HttpError(409, `Only ${v.stock} left for ${v.product.name} (${v.weight})`);
    const price = v.effectivePrice;
    subtotal += price * it.quantity;
    lines.push({ product: v.product._id, variant: v._id, name: v.product.name, weight: v.weight, sku: v.sku, image: v.product.images?.[0]?.url, price, quantity: it.quantity });
  }
  const s = await getSettings();
  const { discount, coupon } = await evaluateCoupon(couponCode, subtotal);
  const shipping = subtotal - discount >= s.freeShippingThreshold ? 0 : s.shippingCharge;
  return { lines, subtotal, discount, shipping, total: subtotal - discount + shipping, coupon };
}

async function logStock(variant, type, change, before, after, extra = {}) {
  await InventoryTransaction.create({ variant: variant._id || variant, product: extra.product, type, change, before, after, note: extra.note, order: extra.order, by: extra.by });
}

// Atomic deduction: only succeeds if enough stock remains; rolls back on partial failure.
async function deductStock(lines, order, by) {
  const done = [];
  try {
    for (const l of lines) {
      const before = await ProductVariant.findById(l.variant).select('stock');
      const v = await ProductVariant.findOneAndUpdate({ _id: l.variant, stock: { $gte: l.quantity } }, { $inc: { stock: -l.quantity } }, { new: true });
      if (!v) throw new HttpError(409, `${l.name} (${l.weight}) just went out of stock`);
      done.push(l);
      await logStock(v, 'sale', -l.quantity, v.stock + l.quantity, v.stock, { product: l.product, order, by, note: 'Order placed' });
    }
  } catch (e) {
    for (const l of done) await ProductVariant.updateOne({ _id: l.variant }, { $inc: { stock: l.quantity } });
    throw e;
  }
}

async function restoreStock(order, by, note) {
  if (order.stockRestored) return;
  const claimed = await Order.findOneAndUpdate({ _id: order._id, stockRestored: false }, { stockRestored: true });
  if (!claimed) return;
  for (const l of order.items) {
    const v = await ProductVariant.findByIdAndUpdate(l.variant, { $inc: { stock: l.quantity } }, { new: true });
    if (v) await logStock(v, 'restore', l.quantity, v.stock - l.quantity, v.stock, { product: l.product, order: order._id, by, note });
  }
  order.stockRestored = true;
}

// Cancelled orders give their coupon use back (once). Reinstated orders take it again.
async function releaseCoupon(order) {
  if (!order.couponCode) return;
  if (await Order.findOneAndUpdate({ _id: order._id, couponReleased: { $ne: true } }, { couponReleased: true })) await Coupon.updateOne({ code: order.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
}
async function reapplyCoupon(order) {
  if (!order.couponCode) return;
  if (await Order.findOneAndUpdate({ _id: order._id, couponReleased: true }, { couponReleased: false })) await Coupon.updateOne({ code: order.couponCode }, { $inc: { usedCount: 1 } });
}

async function changeStatus(order, status, actor, note = '') {
  if (!(TRANSITIONS[order.status] || []).includes(status)) throw new HttpError(400, `Cannot move order from "${order.status}" to "${status}"`);
  if (['Cancelled', 'Returned'].includes(status)) {
    await restoreStock(order, actor._id, `Order ${status.toLowerCase()}`);
    if (order.paymentStatus === 'Paid') { order.paymentStatus = 'Refund Pending'; await Payment.updateOne({ order: order._id }, { status: 'Refund Pending', refundStatus: 'Pending' }); }
  }
  if (status === 'Cancelled') await releaseCoupon(order);
  if (status === 'Refunded') { order.paymentStatus = 'Refunded'; await Payment.updateOne({ order: order._id }, { status: 'Refunded', refundStatus: 'Refunded' }); }
  order.status = status;
  order.timeline.push({ status, note, by: actor._id });
  await order.save();
  notify.statusChanged(order, status); // fire and forget
  return order;
}

// Adds variants + price summary so product cards render without extra requests
async function enrichProducts(products) {
  const vs = await ProductVariant.find({ product: { $in: products.map(p => p._id) } }).lean();
  const eff = (v) => (v.discountPrice > 0 && v.discountPrice < v.price ? v.discountPrice : v.price);
  return products.map(p => {
    const variants = vs.filter(v => String(v.product) === String(p._id)).map(v => ({ ...v, effectivePrice: eff(v) }));
    const minP = variants.length ? Math.min(...variants.map(v => v.effectivePrice)) : 0; const base = variants.find(v => v.effectivePrice === minP);
    return { ...p, variants, minPrice: minP, mrp: base?.price || 0, discountPercent: base && base.price > minP ? Math.round(((base.price - minP) / base.price) * 100) : 0, inStock: variants.some(v => v.stock > 0) };
  });
}
module.exports = { releaseCoupon, reapplyCoupon, enrichProducts, TRANSITIONS, STAFF_STATUSES, getSettings, priceCart, deductStock, restoreStock, changeStatus, logStock, evaluateCoupon };
