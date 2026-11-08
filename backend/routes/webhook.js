const express = require('express');
const crypto = require('crypto');
const { WebhookEvent } = require('../models');
const P = require('../services/paymentService');
const router = express.Router();
const STALE_MS = 2 * 60 * 1000;

// Mounted BEFORE express.json(): the signature is computed over the exact raw bytes.
router.post('/', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) { console.error('RAZORPAY_WEBHOOK_SECRET is not set; rejecting webhook'); return res.status(503).json({ message: 'Webhook not configured' }); }
  const sig = req.headers['x-razorpay-signature']; const raw = req.body;
  if (!sig || !Buffer.isBuffer(raw) || !raw.length) return res.status(400).json({ message: 'Bad request' });
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(raw).digest('hex'));
  const given = Buffer.from(String(sig));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return res.status(400).json({ message: 'Invalid signature' });
  let body; try { body = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ message: 'Invalid JSON' }); }

  const eventId = req.headers['x-razorpay-event-id'] || crypto.createHash('sha256').update(raw).digest('hex');
  try {
    // Idempotency: the first delivery inserts the row; replays find it.
    let existing;
    try { existing = await WebhookEvent.findOneAndUpdate({ eventId }, { $setOnInsert: { eventId, event: body.event, status: 'processing', startedAt: new Date() } }, { upsert: true, new: false }); }
    catch (e) { if (e.code === 11000) return res.json({ received: true, inFlight: true }); throw e; }
    if (existing) {
      if (existing.status === 'done') return res.json({ received: true, duplicate: true });
      if (existing.status === 'processing' && Date.now() - existing.startedAt < STALE_MS) return res.json({ received: true, inFlight: true });
      await WebhookEvent.updateOne({ eventId }, { $set: { status: 'processing', startedAt: new Date() }, $inc: { attempts: 1 } }); // retry of a failed/stuck event
    }
    const pay = body.payload?.payment?.entity || {}; const ref = body.payload?.refund?.entity || {};
    let out;
    switch (body.event) {
      case 'payment.captured': case 'order.paid':
        out = await P.settlePayment({ razorpayOrderId: pay.order_id, paymentId: pay.id, amount: pay.amount, currency: pay.currency, method: pay.method, source: 'webhook' }); break;
      case 'payment.failed':
        out = await P.markFailed({ razorpayOrderId: pay.order_id, paymentId: pay.id, reason: pay.error_description }); break;
      case 'refund.processed':
        out = await P.refundProcessed({ paymentId: ref.payment_id, refundId: ref.id, amount: ref.amount }); break;
      case 'refund.failed':
        out = await P.refundFailed({ paymentId: ref.payment_id }); break;
      default: out = { result: 'ignored' }; // e.g. payment.authorized, order events we don't act on
    }
    await WebhookEvent.updateOne({ eventId }, { $set: { status: 'done', result: out.result } });
    res.json({ received: true, result: out.result });
  } catch (e) {
    console.error('Webhook processing failed:', e);
    await WebhookEvent.updateOne({ eventId }, { $set: { status: 'failed', error: e.message } }).catch(() => {});
    res.status(500).json({ message: 'Processing failed, please retry' }); // non-2xx makes Razorpay retry
  }
});
module.exports = router;
