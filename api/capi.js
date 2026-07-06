const crypto = require('crypto');

const META_PIXEL_ID = process.env.META_PIXEL_ID || '877435018747813';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://siddhsaicorporation.in');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Razorpay-Signature');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const type = req.query.type || '';
  const rawBody = await readRawBody(req);
  let body = {};

  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (type === 'lead') return handleLead(body, res);
  if (type === 'purchase') return handlePurchase(req, rawBody, body, res);

  return res.status(400).json({ error: 'Unknown type' });
};

async function handleLead(body, res) {
  const phone = normalizeIndiaPhone(body.phone);
  const email = String(body.email || '').trim().toLowerCase();
  const nameParts = String(body.name || '').trim().toLowerCase().split(/\s+/, 2);

  const userData = {
    country: [hash('in')]
  };
  if (phone) userData.ph = [hash(phone)];
  if (email) userData.em = [hash(email)];
  if (nameParts[0]) userData.fn = [hash(nameParts[0])];
  if (nameParts[1]) userData.ln = [hash(nameParts[1])];

  const event = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: 'https://siddhsaicorporation.in/waterproofing-landing.html',
    user_data: userData,
    custom_data: {
      lead_type: body.problem || '',
      area: body.area || ''
    }
  };

  if (body.event_id) event.event_id = body.event_id;

  const result = await sendToMeta([event]);
  return res.status(200).json({ ok: true, events_received: result.events_received || 0 });
}

async function handlePurchase(req, rawBody, body, res) {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Razorpay webhook secret is not configured' });
  }

  const signature = req.headers['x-razorpay-signature'] || '';
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');

  if (String(signature).length !== expected.length) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)))) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  if (body.event !== 'payment.captured') {
    return res.status(200).json({ ok: true, note: `Ignored: ${body.event || 'unknown'}` });
  }

  const payment = body.payload && body.payload.payment && body.payload.payment.entity
    ? body.payload.payment.entity
    : {};

  const phone = normalizeIndiaPhone(payment.contact);
  const email = String(payment.email || '').trim().toLowerCase();

  const userData = {
    country: [hash('in')]
  };
  if (phone) userData.ph = [hash(phone)];
  if (email) userData.em = [hash(email)];

  const amountInr = payment.amount ? payment.amount / 100 : 299;
  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: 'https://siddhsaicorporation.in/waterproofing-landing.html',
    event_id: payment.id || `pay_${Date.now()}`,
    user_data: userData,
    custom_data: {
      currency: 'INR',
      value: Number(amountInr),
      content_name: 'Waterproofing Expert Inspection',
      content_ids: ['waterproofing-inspection-299']
    }
  };

  const result = await sendToMeta([event]);
  return res.status(200).json({ ok: true, events_received: result.events_received || 0 });
}

async function sendToMeta(events) {
  if (!META_ACCESS_TOKEN) return {};

  const response = await fetch(`https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: events,
      access_token: META_ACCESS_TOKEN
    })
  });

  return response.json().catch(() => ({}));
}

function normalizeIndiaPhone(value) {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.length === 10) phone = `91${phone}`;
  return phone;
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function readRawBody(req) {
  if (typeof req.body === 'string') return Promise.resolve(req.body);
  if (req.body && typeof req.body === 'object') return Promise.resolve(JSON.stringify(req.body));

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
