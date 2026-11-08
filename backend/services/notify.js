// Customer emails. Never throws and never blocks an order/payment flow.
const mail = require('../utils/mailer');
const { Setting } = require('../models');
const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
const items = (o) => o.items.map(i => `  • ${i.name} (${i.weight}) × ${i.quantity}: ${money(i.price * i.quantity)}`).join('\n');
const link = () => (process.env.CLIENT_URL || '').split(',')[0].trim();
async function send(o, subject, body) {
  try {
    const to = o.shippingAddress?.email; if (!to) return;
    const s = await Setting.findOne({ key: 'main' }).lean(); const brand = s?.brandName || 'Radha Veda';
    const contact = [s?.contact?.email, s?.contact?.phone, s?.whatsapp && `WhatsApp: https://wa.me/${s.whatsapp}`].filter(Boolean).join(' | ');
    await mail(to, `${subject} (${o.orderId})`, `Hi ${o.shippingAddress.name},\n\n${body}\n\nView your order: ${link()}/account/orders/${o._id}\n\nThank you for choosing ${brand}.${contact ? `\nNeed help? ${contact}` : ''}`);
  } catch (e) { console.error('[notify]', e.message); }
}
exports.orderPlaced = (o) => send(o, 'We received your order', `Thank you for your order ${o.orderId}.\n\n${items(o)}\n\nTotal: ${money(o.total)} (Cash on Delivery)\nWe will confirm it shortly.`);
exports.paymentReceived = (o) => send(o, 'Payment received', `We received your payment of ${money(o.total)} for order ${o.orderId}.\n\n${items(o)}\n\nWe will start preparing it right away.`);
exports.statusChanged = (o, status) => {
  const t = o.tracking || {};
  const msg = {
    Shipped: ['Your order has shipped', `Order ${o.orderId} is on its way.${t.courier ? `\nCourier: ${t.courier}` : ''}${t.trackingNumber ? `\nTracking number: ${t.trackingNumber}` : ''}${t.trackingUrl ? `\nTrack here: ${t.trackingUrl}` : ''}`],
    Delivered: ['Your order was delivered', `Order ${o.orderId} has been delivered. We hope you love it! You can now write a review on the product page.`],
    Cancelled: ['Your order was cancelled', `Order ${o.orderId} has been cancelled.${o.paymentStatus === 'Paid' || o.paymentStatus === 'Refund Pending' ? ' Your payment will be refunded to the original payment method.' : ''}`],
    Refunded: ['Your refund was processed', `The refund of ${money(o.total)} for order ${o.orderId} has been processed. Banks usually take 5-7 working days to show it.`],
  }[status];
  return msg ? send(o, msg[0], msg[1]) : undefined;
};
