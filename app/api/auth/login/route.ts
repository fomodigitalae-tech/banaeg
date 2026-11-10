import { NextResponse } from 'next/server';
import { ADMIN_TOKEN } from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234@@';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.password === ADMIN_PASSWORD) {
    return NextResponse.json({ success: true, token: ADMIN_TOKEN });
  }
  return NextResponse.json({ success: false, message: 'كلمة المرور غير صحيحة' }, { status: 401 });
}
