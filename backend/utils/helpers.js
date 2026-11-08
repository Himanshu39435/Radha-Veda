const jwt = require('jsonwebtoken');
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const signToken = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const genOrderId = () => 'RV' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + Math.random().toString(36).slice(2, 6).toUpperCase();
module.exports = { ah, HttpError, signToken, genOrderId };
