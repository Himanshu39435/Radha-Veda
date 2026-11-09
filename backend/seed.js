require('dotenv').config();
const slugify = require('slugify');
const connectDB = require('./config/db');
const M = require('./models');
(async () => {
  await connectDB();
  if (process.argv.includes('--reset')) await Promise.all(Object.values(M).filter(m => m.deleteMany).map(m => m.deleteMany({})));
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@radhaveda.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
  let admin = await M.User.findOne({ email: adminEmail.toLowerCase() }).select('+password');
  if (!admin) {
    admin = new M.User({ name: 'Radha Veda Admin', email: adminEmail.toLowerCase(), password: adminPassword });
  } else {
    admin.role = 'admin';
    admin.isActive = true;
    admin.password = adminPassword;
    admin.markModified('password');
  }
  await admin.save();
  if (!(await M.User.findOne({ email: 'staff@radhaveda.com' }))) { const u = await M.User.create({ name: 'Demo Staff', email: 'staff@radhaveda.com', password: 'Staff@12345', role: 'staff' }); await M.Staff.create({ user: u._id, permissions: ['orders.view', 'orders.update', 'orders.invoice', 'orders.payment'] }); }
  await M.Setting.findOneAndUpdate({ key: 'main' }, { brandName: 'Radha Veda', contact: { email: 'hello@radhaveda.com', phone: '+91 9525206883', address: 'Jaipur, Rajasthan, India' }, whatsapp: '919525206883', shippingCharge: 60, freeShippingThreshold: 499, returnPolicy: 'Returns accepted within 7 days of delivery for unopened products.', privacyPolicy: 'We respect your privacy.', terms: 'By ordering you agree to our terms.' }, { upsert: true });
  const cats = {};
  for (const n of ['Pure Multani Mitti', 'Rose Multani Mitti', 'Neem Multani Mitti', 'Herbal Face Pack', 'Natural Skincare'])
    cats[n] = await M.Category.findOneAndUpdate({ name: n }, { name: n, slug: slugify(n, { lower: true, strict: true }) }, { upsert: true, new: true });
  // 12 sample products. Images live in frontend/public/products (served by the frontend). Replace them with real photos from Admin > Products.
  const MULT = { '100g': 1, '250g': 2.2, '500g': 3.9, '1kg': 7 }; const STOCK = { '100g': 80, '250g': 60, '500g': 40, '1kg': 25 };
  const P = (name, cat, base, off, flags, description, ingredients, directions) => ({ name, cat, base, off, flags, description, ingredients, directions });
  const items = [
    P('Pure Multani Mitti Powder', 'Pure Multani Mitti', 99, 15, { isBestSeller: true, isFeatured: true }, "Finely milled, sun-dried fuller's earth that lifts excess oil and leaves skin feeling clean and fresh. One simple ingredient, nothing added.", "Pure Multani Mitti (Fuller's Earth)", 'Mix 2 tsp with rose water or plain water into a smooth paste. Apply on clean face and neck, leave 10-15 minutes, rinse with cool water. Use 1-2 times a week.'),
    P('Multani Mitti Oil-Control Mask', 'Pure Multani Mitti', 149, 10, { isNewArrival: true }, 'A balanced clay blend for shine-prone skin. Gives a soft, matte finish without feeling tight.', 'Multani Mitti, Kaolin clay, Lemon peel powder', 'Mix 1-2 tsp with water or rose water. Apply a thin layer, leave 10 minutes and rinse before it fully dries. Avoid the eye area.'),
    P('Rose Multani Mitti Face Pack', 'Rose Multani Mitti', 129, 15, { isBestSeller: true, isFeatured: true }, 'Multani Mitti blended with finely ground rose petals for a soft, fresh glow and a gentle floral scent.', 'Multani Mitti, Rose petal powder', 'Mix 2 tsp with milk or rose water. Apply evenly, leave 15 minutes, then rinse and pat dry.'),
    P('Rose & Sandalwood Glow Pack', 'Rose Multani Mitti', 169, 20, { isNewArrival: true }, 'Rose petals and sandalwood in a creamy clay base. A calming, traditional pack for a soft and even-looking complexion.', 'Multani Mitti, Rose petal powder, Sandalwood powder', 'Mix 2 tsp with rose water or raw milk. Apply on face and neck for 15 minutes. Rinse with lukewarm water.'),
    P('Neem Multani Mitti Face Pack', 'Neem Multani Mitti', 119, 15, { isBestSeller: true, isFeatured: true }, 'Neem leaf powder with Multani Mitti, made for oily and blemish-prone skin that needs a deep, clean feeling.', 'Multani Mitti, Neem leaf powder', 'Mix with water or rose water. Apply on a clean face for 10-15 minutes, rinse well. Use 2-3 times a week.'),
    P('Neem & Tulsi Clarifying Pack', 'Neem Multani Mitti', 159, 10, { isNewArrival: true, isFeatured: true }, 'A purifying herbal blend of neem and tulsi in a mineral-rich clay base for skin that needs a fresh start.', 'Multani Mitti, Neem leaf powder, Tulsi leaf powder', 'Mix 2 tsp with water or aloe gel. Apply a thin layer for 10 minutes and rinse. Do a patch test first.'),
    P('Herbal Glow Face Pack', 'Herbal Face Pack', 149, 12, { isFeatured: true }, 'A traditional herbal blend of sandalwood, turmeric and orange peel for a bright, even-looking glow.', 'Sandalwood, Turmeric, Orange peel, Multani Mitti', 'Mix with curd or honey into a paste. Apply for 15 minutes, then rinse gently.'),
    P('Ubtan Turmeric Face Pack', 'Herbal Face Pack', 139, 15, { isBestSeller: true }, 'An old-fashioned ubtan made the traditional way: turmeric, gram flour and sandalwood for a warm, glowing finish.', 'Turmeric, Besan (gram flour), Sandalwood powder, Rose petal powder', 'Mix with milk, curd or rose water. Apply for 15 minutes, then rub off gently while rinsing.'),
    P('Aloe & Cucumber Cooling Pack', 'Herbal Face Pack', 139, 10, { isNewArrival: true, isFeatured: true }, 'A light, cooling pack with aloe and cucumber that leaves skin feeling soft, calm and refreshed.', 'Aloe vera powder, Cucumber powder, Multani Mitti', 'Mix 2 tsp with chilled water or rose water. Apply for 10-15 minutes and rinse with cool water.'),
    P('Natural Skincare Detox Mask', 'Natural Skincare', 249, 20, { isFeatured: true }, 'Activated charcoal and bentonite clay for a deep-cleansing mask that helps skin feel thoroughly refreshed.', 'Bentonite clay, Activated charcoal, Multani Mitti', 'Apply a thin layer on clean skin. Rinse after 10 minutes. Use once a week. Avoid eyes and lips.'),
    P('Orange Peel Brightening Powder', 'Natural Skincare', 129, 15, { isNewArrival: true }, 'Sun-dried orange peel, finely ground. A bright, citrusy powder you can mix into your own face packs.', 'Sun-dried orange peel powder', 'Mix 1 tsp with honey or curd. Apply for 10 minutes and rinse. Avoid direct sun right after use.'),
    P('Multani Mitti & Amla Hair Mask', 'Natural Skincare', 179, 12, { isNewArrival: true }, 'A traditional herbal hair mask of Multani Mitti, amla and hibiscus to cleanse the scalp and leave hair feeling soft.', 'Multani Mitti, Amla powder, Hibiscus powder, Reetha powder', 'Mix with water or curd into a smooth paste. Apply on scalp and lengths, leave 20-30 minutes, rinse well.'),
  ];
  const fs = require('fs'); const imgDir = require('path').join(__dirname, '..', 'frontend', 'public', 'products');
  for (const it of items) {
    const slug = slugify(it.name, { lower: true, strict: true });
    if (fs.existsSync(imgDir) && [1, 2].some(n => !fs.existsSync(`${imgDir}/${slug}-${n}.jpg`))) console.warn(`WARNING: image file missing for "${it.name}" (expected ${slug}-1.jpg / -2.jpg in frontend/public/products)`);
    const p = await M.Product.findOneAndUpdate({ slug }, { name: it.name, slug, category: cats[it.cat]._id, description: it.description, ingredients: it.ingredients, directions: it.directions, isFeatured: false, isBestSeller: false, isNewArrival: false, isAvailable: true, images: [{ url: `/products/${slug}-1.jpg` }, { url: `/products/${slug}-2.jpg` }], ...it.flags }, { upsert: true, new: true });
    for (const w of Object.keys(MULT)) {
      if (await M.ProductVariant.findOne({ product: p._id, weight: w })) continue; // never overwrite prices/stock you changed
      const sku = `RV-${slug.split('-').map(x => x[0]).join('').toUpperCase()}-${w.toUpperCase()}`;
      const price = Math.round((it.base * MULT[w]) / 5) * 5 - 1;
      const v = await M.ProductVariant.create({ product: p._id, weight: w, sku, price, discountPrice: Math.round(price * (100 - it.off) / 100), stock: STOCK[w] });
      await M.InventoryTransaction.create({ variant: v._id, product: p._id, type: 'initial', change: STOCK[w], before: 0, after: STOCK[w], note: 'Seed' });
    }
  }
  // category tiles on the home page use a product photo from that category
  for (const [catName, c] of Object.entries(cats)) { const first = items.find(i => i.cat === catName); if (first) await M.Category.updateOne({ _id: c._id }, { image: `/products/${slugify(first.name, { lower: true, strict: true })}-2.jpg` }); }
  await M.Coupon.findOneAndUpdate({ code: 'WELCOME10' }, { code: 'WELCOME10', type: 'percent', value: 10, minOrder: 299, maxDiscount: 150 }, { upsert: true });
  console.log(`Seed complete.\nAdmin: ${adminEmail} / ${process.env.SEED_ADMIN_PASSWORD || 'Admin@12345'}\nStaff: staff@radhaveda.com / Staff@12345\nChange these passwords immediately in production.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
