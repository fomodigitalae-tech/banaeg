import mysql from 'mysql2/promise';
import crypto from 'node:crypto';

let pool;
let schemaReady;

export function getDatabasePool() {
  if (pool) return pool;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not configured');
  const url = new URL(raw);
  pool = mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4',
  });
  return pool;
}

export async function ensureSchema() {
  if (schemaReady) return;
  const db = getDatabasePool();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customer_name VARCHAR(160) NOT NULL,
      middle_name VARCHAR(160) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      national_id VARCHAR(32) NOT NULL,
      watch_name VARCHAR(80) NOT NULL,
      watch_color VARCHAR(80) NOT NULL,
      status ENUM('new','reviewed','completed') NOT NULL DEFAULT 'new',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_orders_created_at (created_at),
      INDEX idx_orders_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
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
