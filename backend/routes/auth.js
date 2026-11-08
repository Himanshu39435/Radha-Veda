const router = require('express').Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { User } = require('../models');
const { ah, HttpError, signToken } = require('../utils/helpers');
const { protect } = require('../middleware/auth');
const mail = require('../utils/mailer');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: +process.env.AUTH_RATE_LIMIT || 20, message: { message: 'Too many attempts, try again later' } });
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role });

router.post('/register', limiter, ah(async (req, res) => {
  const b = z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional(), password: z.string().min(8) }).parse(req.body);
  if (await User.findOne({ email: b.email.toLowerCase() })) throw new HttpError(409, 'Email already registered');
  const u = await User.create({ ...b, role: 'customer' });
  res.status(201).json({ token: signToken(u), user: pub(u) });
}));

const loginFor = (roles) => ah(async (req, res) => {
  const b = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const u = await User.findOne({ email: b.email.toLowerCase() }).select('+password');
  if (!u || !(await u.matchPassword(b.password)) || !roles.includes(u.role)) throw new HttpError(401, 'Invalid credentials');
  if (!u.isActive) throw new HttpError(403, 'Account deactivated. Contact admin.');
  res.json({ token: signToken(u), user: pub(u) });
});
router.post('/login', limiter, loginFor(['customer', 'admin', 'staff'])); // role in the response decides which dashboard opens
router.post('/admin-login', limiter, loginFor(['admin']));
router.post('/staff-login', limiter, loginFor(['staff']));

router.post('/forgot-password', limiter, ah(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const u = await User.findOne({ email: email.toLowerCase() });
  if (u) {
    // Older accounts may predate the required display name field. Keep reset
    // requests working while repairing the record for future updates.
    if (!u.name) u.name = email.split('@')[0];
    const raw = crypto.randomBytes(32).toString('hex');
    u.resetTokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    u.resetTokenExpires = Date.now() + 30 * 60 * 1000;
    await u.save();
    await mail(u.email, 'Reset your Radha Veda password', `Reset link (valid 30 min): ${process.env.CLIENT_URL}/reset-password/${raw}`);
  }
  res.json({ message: 'If that email exists, a reset link has been sent.' });
}));
router.post('/reset-password/:token', limiter, ah(async (req, res) => {
  const { password } = z.object({ password: z.string().min(8) }).parse(req.body);
  const hash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const u = await User.findOne({ resetTokenHash: hash, resetTokenExpires: { $gt: Date.now() } });
  if (!u) throw new HttpError(400, 'Reset link invalid or expired');
  if (!u.name) u.name = u.email.split('@')[0];
  u.password = password; u.resetTokenHash = undefined; u.resetTokenExpires = undefined; await u.save();
  res.json({ message: 'Password updated' });
}));

router.get('/me', protect, (req, res) => res.json({ user: pub(req.user) }));
router.put('/me', protect, ah(async (req, res) => {
  const b = z.object({ name: z.string().min(2).optional(), phone: z.string().regex(/^[6-9]\d{9}$/).optional() }).parse(req.body);
  Object.assign(req.user, b); await req.user.save(); res.json({ user: pub(req.user) });
}));
router.put('/change-password', protect, limiter, ah(async (req, res) => {
  const b = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }).parse(req.body);
  const u = await User.findById(req.user._id).select('+password');
  if (!(await u.matchPassword(b.currentPassword))) throw new HttpError(400, 'Current password is wrong');
  u.password = b.newPassword; await u.save(); res.json({ message: 'Password changed' });
}));
module.exports = router;
