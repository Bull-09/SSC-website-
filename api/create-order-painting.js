const FULL_AMOUNT_PAISE = 24900;
const TEST_COUPON = 'NISHANTISGOD';
const TEST_COUPON_AMOUNT_PAISE = 100;

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

  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').replace(/\D/g, '');
  const propertyType = String(body.property_type || '').trim();
  const area = String(body.area || '').trim();
  const requirement = String(body.requirement || '').trim();
  const size = String(body.size || '').trim();
  const timeline = String(body.timeline || '').trim();
  const coupon = String(body.coupon || '').trim().toUpperCase();

  if (!name || !/^[6-9][0-9]{9}$/.test(phone) || !propertyType || !area || !requirement) {
    return res.status(400).json({ error: 'Please enter valid painting visit details' });
  }

  const couponApplied = coupon === TEST_COUPON;
  const amountPaise = couponApplied ? TEST_COUPON_AMOUNT_PAISE : FULL_AMOUNT_PAISE;
  const discountPaise = FULL_AMOUNT_PAISE - amountPaise;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const receipt = `ssc_paint_${Date.now()}`;

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
        service: 'Painting Visit',
        customer_name: name,
        customer_phone: phone,
        property_type: propertyType,
        area,
        requirement,
        size: size || 'not specified',
        timeline: timeline || 'not specified',
        coupon_code: couponApplied ? TEST_COUPON : 'none',
        discount_inr: String(discountPaise / 100),
        source_page: 'painting-landing'
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
    coupon: couponApplied ? TEST_COUPON : '',
    discount: discountPaise / 100
  });
};
