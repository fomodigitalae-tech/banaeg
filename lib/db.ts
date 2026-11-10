import pg from 'pg';
import crypto from 'node:crypto';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let schemaReady = false;

function getPool(): pg.Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

export async function ensureSchema() {
  if (schemaReady) return;
  await getPool().query(`
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
  `);
  schemaReady = true;
}

export async function query(text: string, params?: unknown[]) {
  return getPool().query(text, params);
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234@@';
export const ADMIN_TOKEN = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

export function isAdmin(request: Request): boolean {
  const auth = request.headers.get('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) === ADMIN_TOKEN : false;
}
