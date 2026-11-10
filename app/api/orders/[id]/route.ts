import { NextResponse } from 'next/server';
import { ensureSchema, query, isAdmin } from '@/lib/db';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const status = String(body.status || '');

  if (!['new', 'reviewed', 'completed'].includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  try {
    await ensureSchema();
    const { id } = await params;
    await query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Order update failed:', (error as Error).message);
    return NextResponse.json({ error: 'order_update_failed' }, { status: 500 });
  }
}
