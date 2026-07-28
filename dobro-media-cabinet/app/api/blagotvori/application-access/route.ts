import { NextRequest, NextResponse } from 'next/server';
import { applicationAccessCode, applicationAccessCodeMatches, normalizeApplicationAccessCode } from '@/lib/blagotvori/accessCode';
import { getBlagotvoriAdmin, isBlagotvoriConfigured } from '@/lib/blagotvori/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isBlagotvoriConfigured()) {
    return NextResponse.json({ error: 'Сервис заявок временно недоступен.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const accessCode = normalizeApplicationAccessCode(body.access_code);

    if (accessCode.length !== 12) {
      return NextResponse.json({ error: 'Проверьте код заявки. Он состоит из 12 символов.' }, { status: 400 });
    }

    const supabase = getBlagotvoriAdmin();
    const { data: ids, error: idsError } = await supabase
      .from('bt_applications')
      .select('id')
      .limit(5000);

    if (idsError) throw idsError;

    const matched = (ids || []).find(item => applicationAccessCodeMatches(String(item.id), accessCode));
    if (!matched) {
      return NextResponse.json({ error: 'Заявка с таким кодом не найдена.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('bt_applications')
      .select('id,volunteer_name,status,actual_minutes,hours_confirmed,dobro_hours_entered,admin_comment,evidence_comment,evidence_url,created_at,vacancy:bt_vacancies(id,title,event_date,start_time,place,format,confirmation_text)')
      .eq('id', matched.id)
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        application: {
          ...data,
          access_code: applicationAccessCode(String(data.id))
        }
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Не удалось проверить заявку.' }, { status: 500 });
  }
}
