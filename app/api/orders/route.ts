import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { ensureSchema, isAdmin } from '@/lib/db';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { name, middle, phone, national, watchName, watchColor } = body;

  if (!name || !middle || !phone || !national || String(national).length !== 14 || !watchName || !watchColor) {
    return NextResponse.json({ error: 'invalid_order' }, { status: 400 });
  }

  try {
    await ensureSchema();
    const result = await sql`
      INSERT INTO orders (customer_name, middle_name, phone, national_id, watch_name, watch_color)
      VALUES (${String(name).trim()}, ${String(middle).trim()}, ${String(phone).trim()}, ${String(national).trim()}, ${String(watchName).trim()}, ${String(watchColor).trim()})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error('Order create failed:', (error as Error).message);
    return NextResponse.json({ error: 'order_storage_failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ orders: [] }, { status: 401 });
  }

  try {
    await ensureSchema();
    const result = await sql`
      SELECT id, customer_name AS "customerName", middle_name AS "middleName", phone,
        national_id AS "nationalId", watch_name AS "watchName", watch_color AS "watchColor",
        status, created_at AS "createdAt"
      FROM orders ORDER BY created_at DESC LIMIT 500
    `;
    return NextResponse.json({ orders: result.rows });
  } catch (error) {
    console.error('Orders read failed:', (error as Error).message);
    return NextResponse.json({ error: 'orders_read_failed' }, { status: 500 });
  }
}
