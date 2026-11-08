const jwt = require('jsonwebtoken');
const { User, Staff } = require('../models');
const { ah, HttpError } = require('../utils/helpers');
exports.protect = ah(async (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw new HttpError(401, 'Not authenticated');
  let decoded;
  try { decoded = jwt.verify(h.slice(7), process.env.JWT_SECRET); } catch { throw new HttpError(401, 'Invalid or expired token'); }
  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) throw new HttpError(401, 'Account unavailable');
  req.user = user; next();
});
exports.authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Forbidden'));
exports.staffCan = (perm) => ah(async (req, res, next) => {
  if (req.user.role === 'admin') return next();
  const s = await Staff.findOne({ user: req.user._id });
  if (!s || !s.permissions.includes(perm)) throw new HttpError(403, 'Permission denied');
  req.staff = s; next();
});
