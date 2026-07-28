import { NextRequest, NextResponse } from 'next/server';
import { applicationAccessCode } from '@/lib/blagotvori/accessCode';
import { getBlagotvoriAdmin, isBlagotvoriConfigured } from '@/lib/blagotvori/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isBlagotvoriConfigured()) {
    return NextResponse.json({ error: 'Сервис заявок временно недоступен.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const volunteerName = String(body.volunteer_name || '').trim().replace(/\s+/g, ' ');
    const contact = String(body.contact || '').trim();

    if (volunteerName.length < 3 || contact.length < 5) {
      return NextResponse.json({ error: 'Укажите имя и контакт точно так же, как при подаче заявки.' }, { status: 400 });
    }

    const supabase = getBlagotvoriAdmin();
    const { data, error } = await supabase
      .from('bt_applications')
      .select('id,volunteer_name,status,actual_minutes,hours_confirmed,dobro_hours_entered,admin_comment,evidence_comment,evidence_url,created_at,vacancy:bt_vacancies(id,title,event_date,start_time,place,format,confirmation_text)')
      .ilike('volunteer_name', volunteerName)
      .ilike('contact', contact)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const applications = (data || []).map(application => ({
      ...application,
      access_code: applicationAccessCode(String(application.id))
    }));

    return NextResponse.json(
      { applications },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Не удалось проверить заявки.' }, { status: 500 });
  }
}
