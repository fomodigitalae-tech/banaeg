import { sql } from '@vercel/postgres';
import crypto from 'node:crypto';

let schemaReady;

export async function ensureSchema() {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name VARCHAR(160) NOT NULL,
      middle_name VARCHAR(160) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      national_id VARCHAR(32) NOT NULL,
      watch_name VARCHAR(80) NOT NULL,
      watch_color VARCHAR(80) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'new',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  schemaReady = true;
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234@@';
export const ADMIN_TOKEN = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

export function isAdmin(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7) === ADMIN_TOKEN;
  }
  return false;
}
