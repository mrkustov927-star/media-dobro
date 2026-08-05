import { NextRequest, NextResponse } from 'next/server';
import {
  checkBlagotvoriAdminPassword,
  getBlagotvoriAdmin,
  isBlagotvoriConfigured
} from '@/lib/blagotvori/supabaseAdmin';

type RelatedVacancy = {
  id: string;
  title: string;
  category: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  place: string;
  estimated_minutes: number;
};

type VacancyPreset = {
  title: string;
  category: 'Медиа';
  event_date: string;
  start_time: string;
  end_time: string;
  place: string;
  estimated_minutes: number;
  slots: number;
  min_age: number;
  max_age: number;
  format: 'Очно';
  confirmation_type: 'Ссылка или файл';
  confirmation_text: string;
  description: string;
  duties: string[];
  take_with_you: string;
  contact_person: string;
  is_active: boolean;
};

const shelterMediaTitle = 'Медиа-команда выезда в приют «Уши, лапы, хвост»';
const flagMediaTitle = 'Медиа-команда акции «Символ народа»';

function unauthorized() {
  return NextResponse.json({ error: 'Неверный пароль организатора.' }, { status: 401 });
}

function unavailable() {
  return NextResponse.json({ error: 'Отдельная база БлагоТвори пока не подключена.' }, { status: 503 });
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, value));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function durationMinutes(start: string, end: string) {
  return Math.max(60, timeToMinutes(end) - timeToMinutes(start));
}

function uniquePlaces(rows: RelatedVacancy[], fallback: string) {
  const places = Array.from(
    new Set(rows.map(row => String(row.place || '').trim()).filter(Boolean))
  );
  return places.length ? places.join(' • ') : fallback;
}

function buildPresets(rows: RelatedVacancy[]): VacancyPreset[] {
  const shelterRows = rows.filter(row =>
    row.event_date === '2026-08-14' && row.title !== shelterMediaTitle && row.category !== 'Медиа'
  );
  const shelterSource =
    shelterRows.find(row => row.title.toLocaleLowerCase('ru-RU').includes('приют')) || shelterRows[0];
  const shelterStart = shelterSource?.start_time?.slice(0, 5) || '10:00';
  const shelterEnd = shelterSource?.end_time?.slice(0, 5) || '12:00';
  const shelterPlace = shelterSource?.place || 'Приют «Уши, лапы, хвост»';

  const flagRows = rows.filter(row =>
    row.event_date === '2026-08-22' && row.title !== flagMediaTitle && row.category !== 'Медиа'
  );
  const flagStarts = flagRows.map(row => row.start_time?.slice(0, 5)).filter(Boolean) as string[];
  const flagEnds = flagRows
    .map(row => row.end_time?.slice(0, 5) || null)
    .filter(Boolean) as string[];
  const earliestFlagStart = flagStarts.length
    ? flagStarts.reduce((left, right) => (timeToMinutes(left) < timeToMinutes(right) ? left : right))
    : '11:00';
  const latestFlagEnd = flagEnds.length
    ? flagEnds.reduce((left, right) => (timeToMinutes(left) > timeToMinutes(right) ? left : right))
    : '14:00';
  const flagStart = minutesToTime(timeToMinutes(earliestFlagStart) - 30);
  const flagEnd = latestFlagEnd;
  const flagPlace = uniquePlaces(
    flagRows,
    'МБОУ Кемская СОШ № 3 • городская площадь, г. Кемь'
  );

  return [
    {
      title: shelterMediaTitle,
      category: 'Медиа',
      event_date: '2026-08-14',
      start_time: shelterStart,
      end_time: shelterEnd,
      place: shelterPlace,
      estimated_minutes: durationMinutes(shelterStart, shelterEnd),
      slots: 4,
      min_age: 13,
      max_age: 99,
      format: 'Очно',
      confirmation_type: 'Ссылка или файл',
      confirmation_text:
        'Передайте организатору ссылку на папку с отобранными фотографиями и видеоматериалами, а также черновик итоговой публикации. Материалы акции необходимо подготовить к публикации не позднее 15 августа. Используйте официальные хештеги #ЗаботаОМеньших #ДвижениеПервых #НавигаторыДетства #Росдетцентр; всего в публикации — не более 10 хештегов.',
      description:
        'Медиа-команда поможет сохранить историю добровольческого выезда в приют «Уши, лапы, хвост»: работу волонтёров, передачу помощи, хозяйственные задачи и бережное общение с животными. В соответствии с августовскими рекомендациями участники акции «Забота о меньших» проводят фото- и видеосъёмку и готовят публикацию о результате. Животных нельзя подвергать стрессу ради кадра, использовать вспышку без разрешения сотрудников приюта или придумывать неподтверждённые истории.',
      duties: [
        'снять подготовку команды, передачу помощи и основные этапы работы волонтёров',
        'сделать серию чётких фотографий и коротких видеозаписей без постановочного стресса для животных',
        'зафиксировать конкретный результат помощи приюту',
        'записать короткие комментарии волонтёров и представителей приюта только с их согласия',
        'проверить имена, факты и сведения о животных у организатора или представителя приюта',
        'отобрать лучшие материалы и загрузить их в общую папку',
        'подготовить черновик итоговой публикации с официальными хештегами акции'
      ],
      take_with_you:
        'Заряженный телефон или фотоаппарат, пауэрбанк, свободную память на устройстве, удобную закрытую одежду и обувь, воду. Съёмка животных проводится только с разрешения сотрудников приюта.',
      contact_person: 'Евгений Валерьевич Кустов',
      is_active: true
    },
    {
      title: flagMediaTitle,
      category: 'Медиа',
      event_date: '2026-08-22',
      start_time: flagStart,
      end_time: flagEnd,
      place: flagPlace,
      estimated_minutes: durationMinutes(flagStart, flagEnd),
      slots: 5,
      min_age: 13,
      max_age: 99,
      format: 'Очно',
      confirmation_type: 'Ссылка или файл',
      confirmation_text:
        'Передайте организатору ссылку на папку с отобранными фотографиями и видеоматериалами, короткие комментарии участников и черновик итогового поста. Публикацию необходимо подготовить 22 августа. Используйте официальные хештеги #СимволСтраны #ДвижениеПервых #НавигаторыДетства #Росдетцентр; всего в публикации — не более 10 хештегов.',
      description:
        'Медиа-команда осветит мероприятия акции «Символ народа» ко Дню Государственного флага России: квиз о государственных и народных символах в МБОУ Кемской СОШ № 3 и конкурс рисунков мелом «Мир в цвете Российского флага» на городской площади. Августовские рекомендации предусматривают фото- и видеосъёмку мероприятий и публикацию результата не позднее 22 августа.',
      duties: [
        'прийти заранее и снять подготовку площадок к квизу и конкурсу рисунков',
        'сфотографировать команды, игровые раунды, участников и готовые рисунки',
        'записать короткие видеокадры ключевых моментов мероприятий',
        'собрать два-три коротких комментария участников о символах России с их согласия',
        'зафиксировать общий план, детали и итоговый результат каждого события',
        'проверить имена участников и названия мероприятий у организатора',
        'отобрать лучшие материалы, загрузить их в общую папку и подготовить черновик публикации'
      ],
      take_with_you:
        'Заряженный телефон или фотоаппарат, пауэрбанк, свободную память, одежду по погоде и воду. Для съёмки на улице желательно иметь защиту устройства от дождя.',
      contact_person: 'Евгений Валерьевич Кустов',
      is_active: true
    }
  ];
}

export async function POST(request: NextRequest) {
  if (!checkBlagotvoriAdminPassword(request.headers.get('x-admin-password'))) return unauthorized();
  if (!isBlagotvoriConfigured()) return unavailable();

  try {
    const supabase = getBlagotvoriAdmin();
    const { data, error } = await supabase
      .from('bt_vacancies')
      .select('id,title,category,event_date,start_time,end_time,place,estimated_minutes')
      .in('event_date', ['2026-08-14', '2026-08-22']);

    if (error) throw error;

    const rows = (data || []) as RelatedVacancy[];
    const presets = buildPresets(rows);
    let created = 0;
    let skipped = 0;

    for (const preset of presets) {
      const exists = rows.some(row => row.title === preset.title && row.event_date === preset.event_date);
      if (exists) {
        skipped += 1;
        continue;
      }

      const { error: insertError } = await supabase.from('bt_vacancies').insert({
        ...preset,
        updated_at: new Date().toISOString()
      });
      if (insertError) throw insertError;
      created += 1;
    }

    return NextResponse.json({ ok: true, created, skipped, total: presets.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Не удалось добавить медиавакансии.' },
      { status: 500 }
    );
  }
}
