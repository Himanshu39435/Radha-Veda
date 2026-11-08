const router = require('express').Router();
const slugify = require('slugify');
const multer = require('multer');
const { z } = require('zod');
const { Subscriber, Category, Product, ProductVariant, Review, Order, Setting, InventoryTransaction } = require('../models');
const { ah, HttpError } = require('../utils/helpers');
const { protect, authorize } = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');
const { getSettings, enrichProducts } = require('../services/orderService');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (r, f, cb) => cb(/^image\/(jpe?g|png|webp)$/.test(f.mimetype) ? null : new HttpError(400, 'Only JPG/PNG/WEBP images'), true) });
const admin = [protect, authorize('admin')];

router.get('/settings', ah(async (req, res) => res.json(await getSettings())));
router.get('/categories', ah(async (req, res) => res.json(await Category.find({ isActive: true }).sort('name'))));

router.post('/newsletter', ah(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  await Subscriber.updateOne({ email: email.toLowerCase() }, { email }, { upsert: true });
  res.json({ message: 'Subscribed' });
}));
router.get('/reviews/latest', ah(async (req, res) => res.json(await Review.find({ rating: { $gte: 4 }, comment: { $exists: true, $ne: '' } }).populate('user', 'name').populate('product', 'name slug').sort('-createdAt').limit(6))));

// ---------- Public products ----------
router.get('/products', ah(async (req, res) => {
  const { q, category, minPrice, maxPrice, sort, filter, inStock, page = 1, limit = 12, all } = req.query;
  const match = {};
  let isAdmin = false;
  if (all && req.headers.authorization?.startsWith('Bearer ')) { try { const d = jwt.verify(req.headers.authorization.slice(7), process.env.JWT_SECRET); isAdmin = d.role === 'admin' && !!(await User.exists({ _id: d.id, role: 'admin', isActive: true })); } catch {} }
  if (!isAdmin) match.isAvailable = true;
  if (q) match.$text = { $search: String(q) };
  if (category) { const c = await Category.findOne({ $or: [{ slug: category }, ...(/^[a-f\d]{24}$/i.test(category) ? [{ _id: category }] : [])] }); match.category = c?._id || null; }
  if (filter === 'bestseller') match.isBestSeller = true;
  if (filter === 'new') match.isNewArrival = true;
  if (filter === 'featured') match.isFeatured = true;
  let products = await Product.find(match).populate('category', 'name slug').lean();
  const vs = await ProductVariant.find({ product: { $in: products.map(p => p._id) } }).lean();
  const eff = (v) => (v.discountPrice > 0 && v.discountPrice < v.price ? v.discountPrice : v.price);
  products = products.map(p => {
    const variants = vs.filter(v => String(v.product) === String(p._id)).map(v => ({ ...v, effectivePrice: eff(v) }));
    const minP = variants.length ? Math.min(...variants.map(v => v.effectivePrice)) : 0;
    const base = variants.find(v => v.effectivePrice === minP);
    return { ...p, variants, minPrice: minP, mrp: base?.price || 0, discountPercent: base && base.price > minP ? Math.round(((base.price - minP) / base.price) * 100) : 0, inStock: variants.some(v => v.stock > 0) };
  });
  if (minPrice) products = products.filter(p => p.minPrice >= +minPrice);
  if (maxPrice) products = products.filter(p => p.minPrice <= +maxPrice);
  if (inStock === 'true') products = products.filter(p => p.inStock);
  const sorters = { price_asc: (a, b) => a.minPrice - b.minPrice, price_desc: (a, b) => b.minPrice - a.minPrice, popularity: (a, b) => b.ratingCount - a.ratingCount || b.ratingAvg - a.ratingAvg, newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) };
  products.sort(sorters[sort] || sorters.newest);
  const total = products.length, start = (+page - 1) * +limit;
  res.json({ products: products.slice(start, start + +limit), total, page: +page, pages: Math.ceil(total / +limit) });
}));

router.get('/products/:slug', ah(async (req, res) => {
  const p = await Product.findOne({ slug: req.params.slug }).populate('category', 'name slug').lean();
  if (!p) throw new HttpError(404, 'Product not found');
  const variants = await ProductVariant.find({ product: p._id }).sort('price');
  const reviews = await Review.find({ product: p._id }).populate('user', 'name').sort('-createdAt').limit(50);
  const related = await enrichProducts(await Product.find({ category: p.category._id, _id: { $ne: p._id }, isAvailable: true }).limit(4).lean());
  res.json({ ...p, variants, reviews, related });
}));

router.post('/products/:id/reviews', protect, ah(async (req, res) => {
  const b = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).parse(req.body);
  const bought = await Order.exists({ user: req.user._id, status: 'Delivered', 'items.product': req.params.id });
  if (!bought) throw new HttpError(403, 'Only customers with a delivered order can review this product');
  await Review.findOneAndUpdate({ product: req.params.id, user: req.user._id }, b, { upsert: true, new: true, runValidators: true });
  const agg = await Review.aggregate([{ $match: { product: new (require('mongoose').Types.ObjectId)(req.params.id) } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  await Product.findByIdAndUpdate(req.params.id, { ratingAvg: +(agg[0]?.avg || 0).toFixed(1), ratingCount: agg[0]?.n || 0 });
  res.status(201).json({ message: 'Review saved' });
}));

// ---------- Admin: categories ----------
router.post('/categories', admin, ah(async (req, res) => {
  const b = z.object({ name: z.string().min(2), description: z.string().optional(), image: z.string().optional() }).parse(req.body);
  res.status(201).json(await Category.create({ ...b, slug: slugify(b.name, { lower: true, strict: true }) }));
}));
router.put('/categories/:id', admin, ah(async (req, res) => {
  const b = z.object({ name: z.string().min(2).optional(), description: z.string().optional(), image: z.string().optional(), isActive: z.boolean().optional() }).parse(req.body);
  if (b.name) b.slug = slugify(b.name, { lower: true, strict: true });
  res.json(await Category.findByIdAndUpdate(req.params.id, b, { new: true, runValidators: true }));
}));
router.delete('/categories/:id', admin, ah(async (req, res) => {
  if (await Product.exists({ category: req.params.id })) throw new HttpError(400, 'Category has products; move or delete them first');
  await Category.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' });
}));

// ---------- Admin: image upload ----------
router.post('/upload', admin, upload.array('images', 8), ah(async (req, res) => {
  if (!req.files?.length) throw new HttpError(400, 'No images');
  const out = await Promise.all(req.files.map(f => new Promise((resolve, reject) =>
    cloudinary.uploader.upload_stream({ folder: 'radhaveda' }, (e, r) => (e ? reject(e) : resolve({ url: r.secure_url, publicId: r.public_id }))).end(f.buffer))));
  res.json(out);
}));

// ---------- Admin: products ----------
const variantZ = z.object({ weight: z.enum(['100g', '250g', '500g', '1kg']), sku: z.string().min(2), price: z.number().min(0), discountPrice: z.number().min(0).optional(), stock: z.number().int().min(0), lowStockThreshold: z.number().int().min(0).optional() });
const productZ = z.object({
  name: z.string().min(2), description: z.string().optional(), ingredients: z.string().optional(), directions: z.string().optional(),
  category: z.string(), images: z.array(z.object({ url: z.string().url(), publicId: z.string().optional() })).optional(),
  isFeatured: z.boolean().optional(), isBestSeller: z.boolean().optional(), isNewArrival: z.boolean().optional(), isAvailable: z.boolean().optional(),
  variants: z.array(variantZ).min(1),
}).refine(d => d.variants.every(v => !v.discountPrice || v.discountPrice < v.price), { message: 'Discount price must be less than price' });

async function uniqueSlug(name, ignoreId) {
  const base = slugify(name, { lower: true, strict: true }); let s = base, i = 1;
  while (await Product.exists({ slug: s, _id: { $ne: ignoreId } })) s = `${base}-${++i}`;
  return s;
}
async function syncVariants(product, variants, by) {
  const keep = [];
  for (const v of variants) {
    let doc = await ProductVariant.findOne({ product: product._id, weight: v.weight });
    if (doc) { const before = doc.stock; Object.assign(doc, v); await doc.save(); if (before !== v.stock) await InventoryTransaction.create({ variant: doc._id, product: product._id, type: 'adjustment', change: v.stock - before, before, after: v.stock, by, note: 'Edited via product form' }); }
    else { doc = await ProductVariant.create({ ...v, product: product._id }); await InventoryTransaction.create({ variant: doc._id, product: product._id, type: 'initial', change: v.stock, before: 0, after: v.stock, by, note: 'Initial stock' }); }
    keep.push(doc._id);
  }
  await ProductVariant.deleteMany({ product: product._id, _id: { $nin: keep } });
}
router.post('/products', admin, ah(async (req, res) => {
  const { variants, ...b } = productZ.parse(req.body);
  const p = await Product.create({ ...b, slug: await uniqueSlug(b.name) });
  await syncVariants(p, variants, req.user._id);
  res.status(201).json(p);
}));
router.put('/products/:id', admin, ah(async (req, res) => {
  const { variants, ...b } = productZ.parse(req.body);
  const p = await Product.findByIdAndUpdate(req.params.id, { ...b, slug: await uniqueSlug(b.name, req.params.id) }, { new: true, runValidators: true });
  if (!p) throw new HttpError(404, 'Not found');
  await syncVariants(p, variants, req.user._id);
  res.json(p);
}));
router.delete('/products/:id', admin, ah(async (req, res) => {
  const p = await Product.findById(req.params.id); if (!p) throw new HttpError(404, 'Not found');
  for (const i of p.images) if (i.publicId) cloudinary.uploader.destroy(i.publicId).catch(() => {});
  await ProductVariant.deleteMany({ product: p._id }); await Review.deleteMany({ product: p._id }); await p.deleteOne();
  res.json({ message: 'Deleted' });
}));
module.exports = router;
