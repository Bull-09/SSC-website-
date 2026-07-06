const FULL_AMOUNT_PAISE = 29900;
const TEST_COUPON = 'SSC';
const TEST_COUPON_DISCOUNT_PAISE = 28900;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(500).json({ error: 'Razorpay credentials are not configured' });
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const phone = String(body.phone || '').replace(/\D/g, '');
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const coupon = String(body.coupon || '').trim().toUpperCase();

  if (!name || !/^[6-9][0-9]{9}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid customer details' });
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const receipt = `ssc_${Date.now()}`;
  const discountPaise = coupon === TEST_COUPON ? TEST_COUPON_DISCOUNT_PAISE : 0;
  const amountPaise = FULL_AMOUNT_PAISE - discountPaise;

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        service: 'Waterproofing Expert Inspection',
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        coupon_code: coupon || 'none',
        discount_inr: String(discountPaise / 100),
        source_page: 'waterproofing-landing'
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return res.status(response.status).json({
      error: data.error && data.error.description ? data.error.description : 'Razorpay order creation failed'
    });
  }

  return res.status(200).json({
    id: data.id,
    amount: data.amount,
    currency: data.currency,
    receipt: data.receipt,
    coupon: coupon === TEST_COUPON ? TEST_COUPON : '',
    discount: discountPaise / 100
  });
};
