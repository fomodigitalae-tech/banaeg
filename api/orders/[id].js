import { getDatabasePool, ensureSchema, isAdmin } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'method_not_allowed' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'authentication_required' });

  const status = String(req.body?.status || '');
  if (!['new', 'reviewed', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }
  try {
    await ensureSchema();
    await getDatabasePool().execute('UPDATE orders SET status = ? WHERE id = ?', [status, req.query.id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Order update failed:', error.message);
    res.status(500).json({ error: 'order_update_failed' });
  }
}
