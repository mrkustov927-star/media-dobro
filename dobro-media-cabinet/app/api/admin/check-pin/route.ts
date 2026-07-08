import { NextResponse } from 'next/server';
import { requireAdminPin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireAdminPin(body.pin);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Ошибка' }, { status: 401 });
  }
}
