const UNIT_PRICE = 54.99;
const SCENTS = ['Rain', 'Cedar', 'Moss', 'Vetiver', 'Pine', 'Birch'];
const MAX_QTY = 9;

const round = (value) => Math.round(value * 100) / 100;

function parseBody(body) {
  if (!body) return null;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (error) {
      return null;
    }
  }
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch (error) {
      return null;
    }
  }
  return typeof body === 'object' ? body : null;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  const merged = new Map();

  items.slice(0, 12).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const scent = SCENTS.includes(entry.scent) ? entry.scent : SCENTS[0];
    const quantity = Math.min(MAX_QTY, Math.max(1, Math.round(Number(entry.quantity) || 1)));
    const existing = merged.get(scent);
    if (existing) {
      existing.quantity = Math.min(MAX_QTY, existing.quantity + quantity);
    } else {
      merged.set(scent, { scent, quantity });
    }
  });

  return Array.from(merged.values()).map((entry) => ({
    id: 'scent-engine',
    name: 'SCENT ENGINE',
    scent: entry.scent,
    quantity: entry.quantity,
    price: UNIT_PRICE,
    lineTotal: round(UNIT_PRICE * entry.quantity)
  }));
}

function cleanText(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function orderId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SE-${stamp}-${random}`;
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      service: 'SCENT ENGINE concept orders',
      method: 'POST',
      currency: 'USD',
      unitPrice: UNIT_PRICE,
      status: 'concept'
    });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const body = parseBody(req.body);
  if (!body) {
    res.status(400).json({ ok: false, error: 'A JSON body is required' });
    return;
  }

  const items = normalizeItems(body.items);
  if (!items.length) {
    res.status(400).json({ ok: false, error: 'At least one item is required' });
    return;
  }

  const input = body.customer && typeof body.customer === 'object' ? body.customer : {};
  const email = cleanText(input.email, 200);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ ok: false, error: 'A valid email is required' });
    return;
  }

  const customer = {
    name: cleanText(input.name, 120),
    email,
    address1: cleanText(input.address1, 200),
    address2: cleanText(input.address2, 200),
    city: cleanText(input.city, 120),
    postal: cleanText(input.postal, 30),
    country: cleanText(input.country, 80),
    note: cleanText(input.note, 600)
  };

  if (!customer.name || !customer.address1 || !customer.city || !customer.postal || !customer.country) {
    res.status(400).json({ ok: false, error: 'A complete shipping address is required' });
    return;
  }

  const subtotal = round(items.reduce((total, item) => total + item.lineTotal, 0));
  const order = {
    id: orderId(),
    status: 'concept',
    currency: 'USD',
    unitPrice: UNIT_PRICE,
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal,
    shipping: 0,
    total: subtotal,
    customer,
    createdAt: new Date().toISOString()
  };

  res.status(201).json({ ok: true, order });
};
