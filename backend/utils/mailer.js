const nodemailer = require('nodemailer');
const https = require('https');

const sendBrevo = (to, subject, text) => new Promise((resolve, reject) => {
  const body = JSON.stringify({
    sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'Radha Veda' },
    to: [{ email: to }],
    subject,
    textContent: text,
  });
  const req = https.request({
    hostname: 'api.brevo.com',
    path: '/v3/smtp/email',
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
  }, res => {
    let response = '';
    res.on('data', chunk => { response += chunk; });
    res.on('end', () => res.statusCode >= 200 && res.statusCode < 300
      ? resolve()
      : reject(new Error(`Brevo email failed (${res.statusCode}): ${response.slice(0, 200)}`)));
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

const send = async (to, subject, text) => {
  if (process.env.NODE_ENV === 'test') { send.outbox.push({ to, subject, text }); return; }
  if (process.env.BREVO_API_KEY?.trim() && process.env.BREVO_SENDER_EMAIL?.trim()) {
    await sendBrevo(to, subject, text);
    return;
  }
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter(k => !process.env[k]?.trim());
  if (missing.length) throw new Error(`Email service is not configured. Missing: ${missing.join(', ')}`);
  const port = +process.env.SMTP_PORT || 587;
  const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await t.sendMail({ from: `"Radha Veda" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`, to, subject, text });
};
send.outbox = [];
module.exports = send;
