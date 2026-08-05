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
  category: 'Медиа' | 'Помощь на мероприятиях';
  event_date: string;
  start_time: string;
  end_time: string;
  place: string;
  estimated_minutes: number;
  slots: number;
  min_age: number;
  max_age: number;
  format: 'Очно' | 'Дистанционно';
  confirmation_type: 'Ссылка или файл' | 'Подтверждение организатора';
  confirmation_text: string;
  description: string;
  duties: string[];
  take_with_you: string;
  contact_person: string;
  is_active: boolean;
};

const shelterMediaTitle = 'Медиа-команда выезда в приют «Уши, лапы, хвост»';
const flagMediaTitle = 'Медиа-команда акции «Символ народа»';
const exhibitionTitle = 'Помощь в установке выставки «В тылу ковалась Победа: Карельский фронт»';
const kurskMediaTitle = 'Подготовка видеоматериала или публикации «Памяти Курской дуги»';
const cinemaResearchTitle = 'Кино снималось здесь: Кемь и Карелия';

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
      title: exhibitionTitle,
      category: 'Помощь на мероприятиях',
      event_date: '2026-08-16',
      start_time: '14:00',
      end_time: '17:00',
      place: 'Центр культуры и спорта Кеми',
      estimated_minutes: 180,
      slots: 10,
      min_age: 13,
      max_age: 99,
      format: 'Очно',
      confirmation_type: 'Подтверждение организатора',
      confirmation_text:
        'Участие и фактически отработанное время подтвердит организатор после завершения установки выставки.',
      description:
        '18 августа в Центре культуры и спорта Кеми откроется передвижная выставка «В тылу ковалась Победа: Карельский фронт», посвящённая труду жителей северного тыла в годы Великой Отечественной войны. Волонтёры помогут 16 августа подготовить выставочное пространство и установить элементы экспозиции под руководством организаторов. Выставка будет работать с 18 августа по 6 сентября.',
      duties: [
        'помочь подготовить и освободить выставочное пространство',
        'перенести упаковки, стойки и безопасные элементы экспозиции по указанию организаторов',
        'помочь собрать и установить выставочные конструкции',
        'разместить информационные материалы и элементы оформления по готовой схеме',
        'проверить аккуратность и устойчивость установленных элементов вместе с организатором',
        'собрать упаковочные материалы и привести площадку в порядок',
        'не перемещать самостоятельно тяжёлые, хрупкие или подлинные музейные предметы'
      ],
      take_with_you:
        'Удобную закрытую одежду и обувь, рабочие перчатки и воду. Все действия с выставочными предметами выполняются только по указанию организаторов.',
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
    },
    {
      title: kurskMediaTitle,
      category: 'Медиа',
      event_date: '2026-08-23',
      start_time: '09:00',
      end_time: '20:00',
      place: 'Дистанционно',
      estimated_minutes: 240,
      slots: 5,
      min_age: 13,
      max_age: 99,
      format: 'Дистанционно',
      confirmation_type: 'Ссылка или файл',
      confirmation_text:
        'Передайте организатору готовый видеоматериал или текст публикации, иллюстрации и список использованных источников. Материал необходимо подготовить 23 августа. Используйте официальные хештеги #ПамятиКурскойДуги #ДвижениеПервых #НавигаторыДетства #Росдетцентр; всего — не более 10 хештегов.',
      description:
        'Медиаволонтёрам предлагается подготовить содержательный видеоматериал или публикацию о Курской битве, её историческом значении, участниках и военной технике. Задание проводится в рамках тематической линии «Памяти Курской дуги». Все факты, даты, изображения и цитаты необходимо проверять по надёжным источникам; неподтверждённые сведения использовать нельзя.',
      duties: [
        'выбрать конкретную тему материала и согласовать её с организатором',
        'изучить официальные музейные, архивные, библиотечные или научно-просветительские источники',
        'подготовить сценарий видеоролика или структуру публикации',
        'создать собственный текст без копирования больших фрагментов из источников',
        'подобрать изображения с указанием происхождения и соблюдением прав на использование',
        'проверить даты, имена, названия воинских частей и технические характеристики',
        'оформить итоговый материал и приложить список использованных источников'
      ],
      take_with_you:
        'Компьютер или телефон с доступом в интернет. Для видеоролика рекомендуется горизонтальная ориентация и разрешение не ниже 1280×720.',
      contact_person: 'Евгений Валерьевич Кустов',
      is_active: true
    },
    {
      title: cinemaResearchTitle,
      category: 'Медиа',
      event_date: '2026-08-25',
      start_time: '09:00',
      end_time: '20:00',
      place: 'Дистанционно',
      estimated_minutes: 240,
      slots: 5,
      min_age: 13,
      max_age: 99,
      format: 'Дистанционно',
      confirmation_type: 'Ссылка или файл',
      confirmation_text:
        'Передайте организатору готовый текст, карточки или видеоматериал и отдельный список ссылок на использованные источники. Для зачёта необходимо указать не менее двух надёжных источников и отделить подтверждённые факты от предположений.',
      description:
        'Ко Дню российского кино медиаволонтёрам предлагается самостоятельно исследовать, какие фильмы, эпизоды и телевизионные проекты снимались в Кеми и других районах Карелии, а также какие актёры участвовали в этих съёмках. Итогом станет достоверный материал о Карелии как киноплощадке. Это муниципальная медиаинициатива, поэтому особенно важны самостоятельный поиск, проверка фактов и точное указание источников.',
      duties: [
        'определить тему: отдельный фильм, актёр, место съёмок или обзор нескольких кинопроектов',
        'найти не менее двух надёжных источников: материалы киностудий, музеев, архивов, библиотек, официальных СМИ или интервью участников съёмок',
        'сопоставить сведения из разных источников и отметить обнаруженные расхождения',
        'не включать в публикацию слухи и неподтверждённые истории',
        'подготовить авторский текст, карточки, фоторепортаж или короткий видеоматериал',
        'указать названия фильмов, годы, места съёмок и имена участников только после проверки',
        'приложить полный список ссылок и источников для редакторской проверки'
      ],
      take_with_you:
        'Компьютер или телефон с доступом в интернет, приложение для заметок и при необходимости редактор изображений или видео.',
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
    const dates = ['2026-08-14', '2026-08-16', '2026-08-22', '2026-08-23', '2026-08-25'];
    const { data, error } = await supabase
      .from('bt_vacancies')
      .select('id,title,category,event_date,start_time,end_time,place,estimated_minutes')
      .in('event_date', dates);

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
      { error: error?.message || 'Не удалось добавить августовские активности.' },
      { status: 500 }
    );
  }
}
