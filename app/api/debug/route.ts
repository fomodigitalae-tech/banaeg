import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: 'DATABASE_URL not set', envKeys: Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('SUPABASE')) });
  }

  try {
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
    const result = await pool.query('SELECT NOW() as time');
    await pool.end();
    return NextResponse.json({ ok: true, time: result.rows[0].time, dbUrlPrefix: url.slice(0, 30) + '...' });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message, dbUrlPrefix: url.slice(0, 30) + '...' });
  }
}
