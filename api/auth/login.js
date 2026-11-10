import { ADMIN_TOKEN } from '../_db.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234@@';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, token: ADMIN_TOKEN });
  }
  res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
}
