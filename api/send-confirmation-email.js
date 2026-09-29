const CALL_NUMBER_DISPLAY = '+91 73593 59310';
const WHATSAPP_NUMBER_DISPLAY = '+91 99244 42799';
const WHATSAPP_LINK = 'https://wa.me/919924442799';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const paymentId = String(body.payment_id || '').trim();
  const amount = Number(body.amount || 0);
  const coupon = String(body.coupon || '').trim().toUpperCase();
  const discount = Number(body.discount || 0);

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !paymentId || amount <= 0) {
    return res.status(400).json({ error: 'Invalid confirmation details' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONFIRMATION_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return res.status(200).json({
      sent: false,
      skipped: true,
      reason: 'Email provider is not configured'
    });
  }

  const subject = 'Payment confirmed - Waterproofing inspection booking';
  const safeName = escapeHtml(name);
  const safePaymentId = escapeHtml(paymentId);
  const couponLine = coupon
    ? `<p><strong>Coupon:</strong> ${escapeHtml(coupon)}${discount ? ` - Rs. ${discount} discount applied` : ''}</p>`
    : '';

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#F7F2EA;font-family:Arial,sans-serif;color:#172033;">
    <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
      <div style="background:#ffffff;border-radius:16px;padding:28px;border-top:5px solid #C85F2D;">
        <h1 style="margin:0 0 12px;font-size:24px;color:#0F2240;">Your inspection booking is confirmed</h1>
        <p>Hi ${safeName},</p>
        <p>Thank you. We have received your payment for the Siddh Sai Corporation waterproofing expert inspection.</p>
        <div style="background:#F7F2EA;border-radius:12px;padding:16px;margin:20px 0;">
          <p><strong>Amount paid:</strong> Rs. ${amount}</p>
          ${couponLine}
          <p><strong>Payment reference:</strong> ${safePaymentId}</p>
          <p><strong>Registered phone:</strong> ${escapeHtml(phone)}</p>
        </div>
        <p>Our team will call you within 2 business hours to confirm the inspection date and time.</p>
        <p>Need help now? Call ${CALL_NUMBER_DISPLAY} or WhatsApp ${WHATSAPP_NUMBER_DISPLAY}.</p>
        <p><a href="${WHATSAPP_LINK}" style="color:#0F2240;font-weight:bold;">Message us on WhatsApp</a></p>
      </div>
    </div>
  </body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject,
      html,
      text: [
        `Hi ${name},`,
        '',
        'Your waterproofing expert inspection booking is confirmed.',
        `Amount paid: Rs. ${amount}`,
        coupon ? `Coupon: ${coupon}${discount ? ` - Rs. ${discount} discount applied` : ''}` : '',
        `Payment reference: ${paymentId}`,
        `Registered phone: ${phone}`,
        '',
        `Our team will call you within 2 business hours. Call ${CALL_NUMBER_DISPLAY} or WhatsApp ${WHATSAPP_NUMBER_DISPLAY}.`
      ].filter(Boolean).join('\n')
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return res.status(response.status).json({
      sent: false,
      error: data.message || 'Confirmation email failed'
    });
  }

  return res.status(200).json({ sent: true, id: data.id || '' });
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
