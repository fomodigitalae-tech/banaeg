import { getDatabasePool, ensureSchema, isAdmin } from '../_db.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { name, middle, phone, national, watchName, watchColor } = req.body || {};
    if (!name || !middle || !phone || !national || String(national).length !== 14 || !watchName || !watchColor) {
      return res.status(400).json({ error: 'invalid_order' });
    }
    try {
      await ensureSchema();
      const db = getDatabasePool();
      const [result] = await db.execute(
        'INSERT INTO orders (customer_name, middle_name, phone, national_id, watch_name, watch_color) VALUES (?, ?, ?, ?, ?, ?)',
        [String(name).trim(), String(middle).trim(), String(phone).trim(), String(national).trim(), String(watchName).trim(), String(watchColor).trim()],
      );
      return res.status(201).json({ ok: true, id: result.insertId });
    } catch (error) {
      console.error('Order create failed:', error.message);
      return res.status(500).json({ error: 'order_storage_failed' });
    }
  }

  if (req.method === 'GET') {
    if (!isAdmin(req)) return res.status(401).json({ orders: [] });
    try {
      await ensureSchema();
      const [rows] = await getDatabasePool().query(`
        SELECT id, customer_name AS customerName, middle_name AS middleName, phone, national_id AS nationalId,
          watch_name AS watchName, watch_color AS watchColor, status, created_at AS createdAt
        FROM orders ORDER BY created_at DESC LIMIT 500
      `);
      return res.json({ orders: rows });
    } catch (error) {
      console.error('Orders read failed:', error.message);
      return res.status(500).json({ error: 'orders_read_failed' });
    }
  }

  res.status(405).json({ error: 'method_not_allowed' });
}
