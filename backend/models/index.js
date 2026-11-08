const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;
const ref = (m, extra = {}) => ({ type: Schema.Types.ObjectId, ref: m, ...extra });

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['customer', 'admin', 'staff'], default: 'customer' },
  isActive: { type: Boolean, default: true },
  wishlist: [ref('Product')],
  resetTokenHash: String, resetTokenExpires: Date,
}, { timestamps: true });
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.matchPassword = function (p) { return bcrypt.compare(p, this.password); };

const staffSchema = new Schema({
  user: ref('User', { required: true, unique: true }),
  permissions: [{ type: String, enum: ['orders.view', 'orders.update', 'orders.invoice', 'orders.payment'] }],
  activity: [{ action: String, order: ref('Order'), at: { type: Date, default: Date.now } }],
}, { timestamps: true });

const categorySchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, unique: true }, description: String, image: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const productSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  description: String, ingredients: String, directions: String,
  category: ref('Category', { required: true }),
  images: [{ url: String, publicId: String }],
  isFeatured: Boolean, isBestSeller: Boolean, isNewArrival: Boolean,
  isAvailable: { type: Boolean, default: true },
  ratingAvg: { type: Number, default: 0 }, ratingCount: { type: Number, default: 0 },
}, { timestamps: true });
productSchema.index({ name: 'text', description: 'text' });

const variantSchema = new Schema({
  product: ref('Product', { required: true, index: true }),
  weight: { type: String, enum: ['100g', '250g', '500g', '1kg'], required: true },
  sku: { type: String, required: true, unique: true },
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0, default: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  lowStockThreshold: { type: Number, default: 10 },
}, { timestamps: true });
variantSchema.index({ product: 1, weight: 1 }, { unique: true });
variantSchema.virtual('effectivePrice').get(function () { return this.discountPrice > 0 && this.discountPrice < this.price ? this.discountPrice : this.price; });
variantSchema.set('toJSON', { virtuals: true });

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Ready to Dispatch', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refund Pending', 'Refunded'];
const orderSchema = new Schema({
  orderId: { type: String, unique: true, required: true },
  user: ref('User', { required: true, index: true }),
  items: [{ product: ref('Product'), variant: ref('ProductVariant'), name: String, weight: String, sku: String, image: String, price: Number, quantity: Number }],
  shippingAddress: { name: String, phone: String, email: String, line1: String, state: String, city: String, pincode: String },
  subtotal: Number, discount: { type: Number, default: 0 }, shipping: { type: Number, default: 0 }, total: Number,
  couponCode: String,
  paymentMethod: { type: String, enum: ['COD', 'RAZORPAY'], required: true },
  paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Failed', 'Refund Pending', 'Refunded'], default: 'Pending' },
  status: { type: String, enum: ORDER_STATUSES, default: 'Pending', index: true },
  timeline: [{ status: String, note: String, by: ref('User'), at: { type: Date, default: Date.now } }],
  assignedTo: ref('User', { index: true }),
  stockRestored: { type: Boolean, default: false },
  razorpayOrderId: String, couponReleased: Boolean,
  tracking: { courier: String, trackingNumber: String, trackingUrl: String },
}, { timestamps: true });

const paymentSchema = new Schema({
  order: ref('Order', { required: true, index: true }),
  method: String, amount: Number,
  status: { type: String, enum: ['Pending', 'Paid', 'Failed', 'Refund Pending', 'Refunded'], default: 'Pending' },
  razorpayOrderId: String, transactionId: { type: String, unique: true, sparse: true }, signature: String,
  refundStatus: { type: String, enum: ['None', 'Pending', 'Refunded'], default: 'None' },
  verifiedAt: Date, channel: String, failureReason: String, refundId: String, note: String,
}, { timestamps: true });

const couponSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['percent', 'flat'], required: true },
  value: { type: Number, required: true, min: 0 },
  minOrder: { type: Number, default: 0 }, maxDiscount: Number,
  expiresAt: Date, usageLimit: Number, usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const reviewSchema = new Schema({
  product: ref('Product', { required: true, index: true }), user: ref('User', { required: true }),
  rating: { type: Number, min: 1, max: 5, required: true }, comment: { type: String, maxlength: 1000 },
}, { timestamps: true });
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

const addressSchema = new Schema({
  user: ref('User', { required: true, index: true }),
  name: { type: String, required: true }, phone: { type: String, required: true },
  line1: { type: String, required: true }, state: { type: String, required: true },
  city: { type: String, required: true }, pincode: { type: String, required: true, match: /^\d{6}$/ },
  isDefault: Boolean,
}, { timestamps: true });

const inventorySchema = new Schema({
  variant: ref('ProductVariant', { required: true, index: true }), product: ref('Product'),
  type: { type: String, enum: ['sale', 'restore', 'adjustment', 'restock', 'initial'], required: true },
  change: Number, before: Number, after: Number, note: String, order: ref('Order'), by: ref('User'),
}, { timestamps: true });

const settingSchema = new Schema({
  key: { type: String, default: 'main', unique: true },
  brandName: { type: String, default: 'Radha Veda' }, logo: String,
  contact: { email: String, phone: String, address: String }, whatsapp: String,
  social: { instagram: String, facebook: String, youtube: String },
  shippingCharge: { type: Number, default: 60 }, freeShippingThreshold: { type: Number, default: 499 },
  legalName: String, gstin: String, sellerState: String, gstRate: { type: Number, default: 18, min: 0, max: 28 }, hsnCode: { type: String, default: '3304' },
  returnPolicy: String, privacyPolicy: String, terms: String,
  banners: [{ image: String, title: String, link: String, active: { type: Boolean, default: true } }],
}, { timestamps: true });

const subscriberSchema = new Schema({ email: { type: String, required: true, unique: true, lowercase: true, trim: true } }, { timestamps: true });

// One row per Razorpay webhook delivery: the unique eventId is the idempotency key.
const webhookSchema = new Schema({
  eventId: { type: String, required: true, unique: true }, event: String,
  status: { type: String, enum: ['processing', 'done', 'failed'], default: 'processing' },
  startedAt: Date, result: String, error: String, attempts: { type: Number, default: 1 },
}, { timestamps: true });
webhookSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 3600 });

const m = (n, s) => mongoose.models[n] || mongoose.model(n, s);
module.exports = {
  ORDER_STATUSES,
  User: m('User', userSchema), Staff: m('Staff', staffSchema), Category: m('Category', categorySchema),
  Product: m('Product', productSchema), ProductVariant: m('ProductVariant', variantSchema),
  Order: m('Order', orderSchema), Payment: m('Payment', paymentSchema), Coupon: m('Coupon', couponSchema),
  Review: m('Review', reviewSchema), Address: m('Address', addressSchema),
  InventoryTransaction: m('InventoryTransaction', inventorySchema), Subscriber: m('Subscriber', subscriberSchema), WebhookEvent: m('WebhookEvent', webhookSchema), Setting: m('Setting', settingSchema),
};
