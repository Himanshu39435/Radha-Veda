require('dotenv').config();
const connectDB = require('./config/db');
const prod = process.env.NODE_ENV === 'production';
for (const k of ['MONGO_URI', 'JWT_SECRET']) if (!process.env[k]) { console.error(`Missing env var ${k}`); process.exit(1); }
if (prod && process.env.JWT_SECRET.length < 32) { console.error('JWT_SECRET must be at least 32 characters in production'); process.exit(1); }
for (const k of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLIENT_URL']) if (!process.env[k]) console.warn(`WARNING: ${k} is not set; related features will not work`);
const app = require('./app');
const { startSweeper } = require('./services/paymentService');
const port = process.env.PORT || 5000;
connectDB().then(() => {
  const server = app.listen(port, () => console.log(`API on :${port}`));
  startSweeper();
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}).catch(e => { console.error(e); process.exit(1); });
