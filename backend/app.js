require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use('/api/webhooks/razorpay', require('./routes/webhook')); // raw body, no CORS, no rate limit
app.use(cors({ origin: (process.env.CLIENT_URL || '').split(',').map(s => s.trim()).filter(Boolean), credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// Block NoSQL operator injection: keys starting with "$" (or containing ".") are never legitimate in our API
const bad = (o, d = 0) => d < 6 && o && typeof o === 'object' && Object.entries(o).some(([k, v]) => k.startsWith('$') || k.includes('.') || bad(v, d + 1));
app.use((req, res, next) => (bad(req.query) || bad(req.body) ? res.status(400).json({ message: 'Invalid request' }) : next()));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: +process.env.API_RATE_LIMIT || 300 }));
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/catalog'));
app.use('/api', require('./routes/customer'));
app.use('/api/manage/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use(notFound);
app.use(errorHandler);
module.exports = app;
