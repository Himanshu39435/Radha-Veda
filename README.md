# Radha Veda — Natural Skincare E-commerce

A full-stack D2C store: **customer site**, **admin panel** and **staff panel**, with a real Node/Express/MongoDB backend, COD and Razorpay payments (with a secure webhook), inventory tracking and role-based access.

```
radha-veda/
├── backend/                 Node.js + Express + Mongoose API
│   ├── app.js               Express app (middleware, routes)
│   ├── server.js            Boots DB, payment-expiry sweeper, listens
│   ├── models/index.js      User, Staff, Category, Product, ProductVariant, Order, Payment,
│   │                        Coupon, Review, Address, InventoryTransaction, Setting, Subscriber, WebhookEvent
│   ├── routes/              auth, catalog (products/categories/upload), customer (cart/orders/payments),
│   │                        orders (admin+staff), admin (dashboard/staff/inventory/reports/settings), webhook
│   ├── services/            orderService (pricing, stock, status rules) · paymentService (all payment state changes)
│   ├── middleware/          JWT auth + role/permission checks, error handling
│   ├── test/                payment-flow.test.js (integration tests)
│   ├── seed.js              Sample data + demo admin/staff
│   └── .env.example
└── frontend/                React + Vite + Tailwind (shadcn-style components) + Lucide
    └── src/ pages/{customer,admin,staff}, components/, context/, lib/
```

**One login for everyone:** open `/login`, sign in, and you are taken to your own dashboard based on your role:

| Role | Opens | What they see |
|---|---|---|
| Admin | `/admin` | Revenue, orders, customers, charts, all management pages |
| Staff | `/staff` | Their assigned orders, status counts, packing/dispatch pages only |
| Customer | `/account` | Their orders, spend, wishlist, addresses, profile, order tracking |

All three use the same left-sidebar layout (drawer with hamburger menu on phones). `/admin/login` and `/staff/login` also still work. Each role is blocked from the other dashboards both in the browser and by the API.

---

## 1. Run locally

**Prerequisites:** Node.js 20+ and a MongoDB database (Atlas free tier, section 2, or local MongoDB).

```bash
# Backend
cd backend
cp .env.example .env          # fill in values (see sections 2–4)
npm install
npm run seed                  # sample products + demo admin/staff (add "-- --reset" to wipe first)
npm run dev                   # http://localhost:5000/api/health

# Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173  (proxies /api to :5000)
```

The seed creates **12 sample products** across the 5 categories, each with 4 weight options (100g, 250g, 500g, 1kg), prices, discounts and stock. Their images are in `frontend/public/products/` (2 per product). These are **illustrated product packshots, not photographs of your real packaging**: replace them with your own photos from Admin → Products → Edit (upload images, remove the old ones) before launch. The home page hero, About photo and category tiles pick their photos automatically from your featured products and categories (set a category image in the database, or the seed uses a product photo), so they update when you change products. Re-running `npm run seed` refreshes the sample products' text and images but never overwrites prices or stock you changed; `npm run seed -- --reset` wipes everything first.

Demo logins created by the seed (**change or delete before launch**):
- Admin: `admin@radhaveda.com` / `Admin@12345` (set via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
- Staff: `staff@radhaveda.com` / `Staff@12345`

Without Cloudinary keys you can still add products using "Add by URL" for images. Without Razorpay keys, only Cash on Delivery works.

---

## 2. MongoDB Atlas

1. Create a free account at mongodb.com/atlas and a **Cluster** (M0 free is fine to start; choose the Mumbai region for Indian customers).
2. **Database Access → Add New Database User** with a strong password (role *Read and write to any database*).
3. **Network Access → Add IP Address**. For local development add your IP. Hosting platforms without fixed IPs (Render, Railway) require allowing `0.0.0.0/0`, so use a long random database password. For stricter security use a host with a static outbound IP, or Atlas Private Link on a paid tier.
4. **Connect → Drivers** and copy the connection string. Put it in `backend/.env` with a database name:
   ```
   MONGO_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/radhaveda?retryWrites=true&w=majority
   ```
   URL-encode special characters in the password (`@` → `%40`).
5. Turn on **Backup** (Atlas → your cluster → Backup) before taking real orders.

---

## 3. Cloudinary (product images)

1. Sign up at cloudinary.com. In the **Dashboard** copy *Cloud name*, *API Key*, *API Secret*.
2. Set in `backend/.env`:
   ```
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```
3. Admin → Products → Add product → upload images (JPG/PNG/WEBP up to 5 MB each). They are stored in the `radhaveda/` folder.

---

## 4. Razorpay (online payments) and the webhook

### 4.1 API keys
1. Create a Razorpay account. Start in **Test Mode** (toggle at the top of the dashboard).
2. **Account & Settings → API Keys → Generate Key**. Put them in `backend/.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxx
   ```
   The secret stays on the server. The frontend only receives the public key ID per order.
3. **Settings → Payment Capture → Automatic.** The webhook acts on `payment.captured`, so payments must be auto-captured.
4. UPI, cards, netbanking and wallets are enabled under the payment methods settings in your Razorpay dashboard.

### 4.2 Webhook (required)
The webhook is what confirms payments if the customer closes the tab, loses network, or their UPI app is slow. **Do not launch without it.**

1. Choose a webhook secret of 20+ random characters (**not** your API key secret) and put it in `backend/.env`:
   ```
   RAZORPAY_WEBHOOK_SECRET=your_long_random_secret
   ```
2. Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**
   - **URL:** `https://YOUR-API-DOMAIN/api/webhooks/razorpay`
   - **Secret:** the same value as `RAZORPAY_WEBHOOK_SECRET`
   - **Active events:** `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`
3. Webhooks are configured **separately for Test and Live mode**. Repeat the setup after switching to live keys.

**Testing the webhook on your laptop:** Razorpay needs a public URL. Run `npx cloudflared tunnel --url http://localhost:5000` (or ngrok), then use `https://<tunnel>/api/webhooks/razorpay` as the webhook URL in Test Mode. Pay with Razorpay's test UPI/card details and watch the backend log and the order status.

### 4.3 How payments are handled
- Order creation validates prices on the server, **reserves stock atomically**, and creates the Razorpay order.
- After paying, the browser calls `/api/payments/verify` (instant confirmation). **Separately**, Razorpay calls the webhook. Both go through one function that uses an atomic database claim, so a payment is applied **exactly once** no matter which arrives first, or if both arrive together.
- Webhooks are checked with HMAC-SHA256 over the raw body (timing-safe) and de-duplicated by Razorpay's event ID. Failed processing returns HTTP 500 so Razorpay retries.
- `payment.failed` keeps the order open for retry ("Complete payment" button on the order page).
- **Customer closes the payment page:** the order stays *Pending* with stock reserved for `PAYMENT_EXPIRY_MINUTES` (default 30). The order page lets them retry. After the window, a background job asks Razorpay whether a payment was captured; if yes it confirms the order, if no it cancels it and releases stock. If Razorpay can't be reached, it does nothing and tries again later.
- **Late payment after expiry:** if money arrives for an already-cancelled order, the stock is re-reserved and the order reinstated. If the product has sold out meanwhile, an automatic refund is started and the order is flagged. If the refund API fails, it is flagged for manual refund.
- Amount/currency mismatches are never applied as payments (flagged in the order timeline).
- Refunds: cancelling a paid online order marks it *Refund Pending*. Admin clicks **Refund via Razorpay**, and the `refund.processed` webhook completes it.

---

## 4b. WhatsApp support

Admin → **Website Settings → Contact and social → WhatsApp number**. Enter your support number (e.g. `98765 43210`, `+91 98765 43210` or `919876543210`; 10-digit Indian numbers get +91 added). After saving:
- a green **Chat with us** button appears on every store page (bottom-right), pre-filled with the page the customer is on;
- product pages get **Ask about this product on WhatsApp** (product name and weight pre-filled);
- each customer order page gets **Need help with this order?** (order ID pre-filled);
- the footer button and every order email include your WhatsApp link.

Clear the field and save to hide all of them. Use a **WhatsApp Business** number if you can: it gives you business hours, quick replies and an away message. This is click-to-chat (wa.me links); messages arrive in your WhatsApp app like any other chat. It is not the WhatsApp Business API, so there are no automatic order-status messages (those need an approved API provider).

**The seed uses a dummy number (`919000000000`). Replace it in Website Settings before launch, otherwise customers will message a number that is not yours.**

---

## 5. Tests

```bash
cd backend
TEST_MONGO_URI=mongodb://127.0.0.1:27017/radhaveda_test npm test
```
**The test database is wiped**, so the URI must contain "test". The suite starts the real app, sends correctly signed webhooks, and uses a fake Razorpay client. It covers: signature rejection, idempotent replays, verify-vs-webhook races, failed→retry→paid, amount mismatch, page-closed expiry and stock release, late-payment reinstatement, sold-out auto-refund (and refund-API failure), missed-webhook recovery, Razorpay outage safety, overselling under concurrency, the admin refund flow, coupon rollback, order emails (no duplicates), tracking, and GST maths.

---

## 5b. Security notes

- `npm audit --omit=dev` reported **0 vulnerabilities** on both apps when this was packaged (nodemailer, zod and react-router were upgraded to fix findings). Re-run `npm audit` in `backend/` and `frontend/` before launch and every few months.
- Requests containing MongoDB operator keys (`$...` or dotted keys) are rejected; all inputs are validated with zod; passwords are bcrypt-hashed; JWTs expire in 7 days; auth, webhook and payment endpoints are rate-limited. The general API limit is `API_RATE_LIMIT` requests per minute per IP (default 300); login/register/reset attempts are limited by `AUTH_RATE_LIMIT` per 15 minutes per IP (default 20).
- Login tokens are kept in the browser's `localStorage`. That is standard for this kind of app but means any cross-site-scripting bug would expose them. The React code does not render raw HTML, but if you add rich-text/HTML content later, sanitise it.
- Set `CLIENT_URL` exactly to your real frontend origin(s); the API only accepts browser requests from there.

## 6. Deploy

**Recommended:** backend on Render (or Railway), frontend on Vercel (or Netlify), database on Atlas.

### Backend (Render)
1. Push the repo to GitHub. Render → **New Web Service**, root directory `backend`.
2. Build command `npm install`, start command `npm start`, health check path `/api/health`.
3. Use an always-on plan: the payment-expiry job runs inside the server process, so a free instance that sleeps will not run it.
4. Environment variables (all from `.env.example`): `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET` (32+ random chars), `CLIENT_URL` (your frontend URL, e.g. `https://radhaveda.com`), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CLOUDINARY_*`, and `SMTP_*` (for password-reset emails).
5. Run the seed once (locally, pointed at the production database): `npm run seed`. Then **immediately change the admin password and delete the demo staff user.**
6. Add a custom domain such as `api.radhaveda.com`. Your webhook URL becomes `https://api.radhaveda.com/api/webhooks/razorpay`.

### Frontend (Vercel)
1. New Project, root directory `frontend`, framework Vite, build `npm run build`, output `dist`.
2. Environment variable: `VITE_API_URL=https://api.radhaveda.com` (origin only, no `/api`).
3. `vercel.json` and `public/_redirects` already provide the SPA rewrite so deep links work.
4. Add your domain. Make sure `CLIENT_URL` on the backend matches it exactly (comma-separate multiple origins, e.g. with and without `www`).

### Email (password reset)
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (e.g. Brevo, Amazon SES, Zoho) and `SMTP_FROM` (a sender address your provider has verified). Without SMTP, password-reset links and order emails are only printed to the server log.

---

## 7. Before you launch: remaining steps for you

**Must do**
- [ ] Switch Razorpay to **Live Mode** (complete KYC): new live keys, new live **webhook** with its own secret, auto-capture on. Do one real ₹1–10 test order and refund it.
- [ ] Change the admin password, **delete the demo staff account**, and create real staff accounts. Never ship `Admin@12345`.
- [ ] Set a strong `JWT_SECRET` (32+ chars) and `NODE_ENV=production`.
- [ ] Replace the 12 sample products and their illustrated images with your real products, photos, prices, SKUs and stock (sample reviews are intentionally not included, so every review on your store is from a real customer). Delete the `WELCOME10` coupon or keep it deliberately.
- [ ] Fill in **Website Settings** (contact, **your real WhatsApp number (replace the dummy 919000000000)**, social links, shipping charge, free-shipping threshold) and **write real Return, Privacy and Terms policies**, ideally reviewed by a professional. The placeholders are not legal text.
- [ ] Enable **Atlas backups** and restrict the DB user to this database.
- [ ] Place test orders end to end on the live domain, both COD and online, on a real phone: order, webhook confirmation, staff packing, delivery, review, cancel and refund.
- [ ] Configure SMTP and test the password-reset email and an order email.
- [ ] Fill in the GST settings (or leave GSTIN empty if not registered) and check a printed invoice with your accountant.

**Set up in the admin panel (built, needs your details)**
- **GST invoices:** Admin → Website Settings → *GST and invoice*: add legal name, GSTIN, your state, GST rate and HSN code. With a GSTIN, invoices become "Tax Invoice" with taxable value and CGST+SGST (same state) or IGST (other states); prices are treated as GST-inclusive. The default 18% / HSN 3304 is only a starting point. **Confirm the rate, HSN and invoice format with your accountant.** Without a GSTIN, invoices show no tax lines.
- **Customer emails** are sent via SMTP: order received (COD), payment received (online), shipped (with courier and tracking), delivered, cancelled, refunded. Set `SMTP_*` (and optionally `SMTP_FROM`). Without SMTP they are only printed to the server log. SMS/WhatsApp messages are not included.
- **Shipping/tracking:** when staff or admin mark an order *Shipped*, they can enter courier, tracking number and tracking link; customers see them on the order page and in the email. This is manual entry.

**Not built (decide whether you need them for launch)**
- **Automatic courier integration** (Shiprocket, Delhivery APIs: label creation, live tracking, pincode serviceability). It needs your courier account and API credentials.
- Monitoring and alerts (e.g. Sentry). Add an uptime monitor on `/api/health`.
- Admin sales reports count only *paid* orders, so COD revenue appears after payment collection is recorded.

**What I could and could not verify**
- **Tested against a real MongoDB 8:** 19 backend tests (payments, webhook, refunds, coupons, emails, tracking, GST maths, injection guard), plus a smoke test of the other API routes. Email sending was also verified against a local SMTP server with authentication.
- **Tested in a real headless Firefox:** the pages were opened and screenshotted at desktop width and at an exact 390px phone width, which found and fixed an admin-dashboard overflow, a wrapping header, broken-image layout and a coupon error that vanished instantly. Clicked through: browsing, cart, coupon rules, registration, COD checkout, customer cancel, admin login and order assignment, and the staff workflow (permissions, sidebar, confirm, process, pack), plus the mobile admin drawer and the login guards.
- **Not tested (needs your accounts or real devices):** the real Razorpay checkout popup and live webhook delivery (tests use a fake Razorpay client and correctly signed requests), Cloudinary uploads, real email delivery, Safari/iOS and Android browsers, and webfonts (the sandbox couldn't load Google Fonts, so I saw fallback fonts). Please do a full click-through on an iPhone and an Android phone before launch.
