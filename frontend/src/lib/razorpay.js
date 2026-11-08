import { api } from './api';
const load = () => new Promise((res, rej) => { if (window.Razorpay) return res(); const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load Razorpay. Check your connection.')); document.body.appendChild(s); });
// Opens Razorpay Checkout for an existing order. The server webhook is the source of truth, so even if the
// browser dies after paying, the order is still confirmed. verify() just makes the confirmation instant.
export async function payOnline({ razorpay, prefill, onVerified, onPending, onDismiss, onFailed }) {
  await load();
  const rz = new window.Razorpay({
    key: razorpay.keyId, amount: razorpay.amount, currency: razorpay.currency, order_id: razorpay.orderId, name: 'Radha Veda', description: 'Skincare order',
    prefill, theme: { color: '#4E5D42' },
    handler: async (resp) => { try { await api().post('/payments/verify', resp); onVerified?.(); } catch { onPending?.(); /* webhook will still confirm */ } },
    modal: { ondismiss: () => onDismiss?.() },
  });
  rz.on('payment.failed', (x) => onFailed?.(x.error?.description || 'Payment failed'));
  rz.open();
}
