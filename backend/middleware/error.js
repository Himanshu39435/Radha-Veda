const { ZodError } = require('zod');
exports.notFound = (req, res) => res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
exports.errorHandler = (err, req, res, next) => {
  let status = err.status || 500, message = err.message || 'Server error';
  if (err instanceof ZodError) { status = 400; message = err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '); }
  else if (err.name === 'CastError') { status = 400; message = 'Invalid ID'; }
  else if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors).map(e => e.message).join('; '); }
  else if (err.code === 11000) { status = 409; message = `Duplicate value: ${Object.keys(err.keyValue || {}).join(', ')}`; }
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 && process.env.NODE_ENV === 'production' ? 'Server error' : message });
};
