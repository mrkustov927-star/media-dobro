import { NextRequest, NextResponse } from 'next/server';
import {
  checkBlagotvoriAdminPassword,
  getBlagotvoriAdmin,
  isBlagotvoriConfigured
} from '@/lib/blagotvori/supabaseAdmin';

type VacancyPreset = {
  title: string;
  category: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  place: string;
  estimated_minutes: number;
  slots: number;
  min_age: number;
  max_age: number;
  format: 'Очно' | 'Дистанционно';
  confirmation_type: string;
  confirmation_text: string;
  description: string;
  duties: string[];
  take_with_you: string;
  contact_person: string;
  is_active: boolean;
};

function unauthorized() {
  return NextResponse.json({ error: 'Неверный пароль организатора.' }, { status: 401 });
}

function unavailable() {
  return NextResponse.json({ error: 'Отдельная база БлагоТвори пока не подключена.' }, { status: 503 });
}

function normalizeTime(value: unknown) {
  const time = String(value || '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Укажите время посещения приюта в формате ЧЧ:ММ.');
  }
  return time;
}

function durationMinutes(start: string, end: string) {
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
  return endMinutes - startMinutes;
}

function buildPresets(shelterStart: string, shelterEnd: string): VacancyPreset[] {
  return [
    {
      title: 'Онлайн-акция «Расскажи о своём друге»',
      category: 'Дистанционные задания',
      event_date: '2026-08-10',
      start_time: '09:00',
      end_time: '20:00',
      place: 'Онлайн — сообщества первичных организаций и Движения Первых Кемского муниципального округа',
      estimated_minutes: 60,
      slots: 50,
      min_age: 13,
      max_age: 99,
      format: 'Дистанционно',
      confirmation_type: 'Ссылка на материал',
      confirmation_text:
        'Прикрепите ссылку на опубликованный пост или скриншот публикации. Акция проходит с 10 по 14 августа. Хештеги: #ДвижениеПервых10 #ПервыеКемь #ЗаботаОМеньших #КалендарьПервых',
      description:
        'Расскажите о своём домашнем питомце: как его зовут, как он появился в семье, какой у него характер, чему он учит своих хозяев и почему важно ответственно относиться к животным. Предложите готовый пост в сообщество своей первичной организации и в сообщество Движения Первых Кемского муниципального округа. Акция проходит с 10 по 14 августа.',
      duties: [
        'подготовить добрый авторский рассказ о своём питомце',
        'выбрать качественную фотографию питомца',
        'проверить текст перед публикацией',
        'предложить пост в сообщество своей первичной организации',
        'предложить пост в сообщество Движения Первых Кемского муниципального округа',
        'сохранить ссылку или скриншот опубликованного материала'
      ],
      take_with_you: 'Фотографию питомца, телефон или компьютер и немного времени для доброго рассказа.',
      contact_person: 'Евгений Валерьевич Кустов',
      is_active: true
    },
    {
      title: 'Сбор карточек для выставки «Носики Первых»',
      category: 'Дистанционные задания',
      event_date: '2026-08-10',
      start_time: '09:00',
      end_time: '20:00',
      place: 'Онлайн',
      estimated_minutes: 120,
      slots: 15,
      min_age: 13,
      max_age: 99,
      format: 'Дистанционно',
      confirmation_type: 'Ссылка или файл',
      confirmation_text:
        'Передайте организатору готовую карточку или заполненную форму с проверенными сведениями о животном. Активность проходит 10 и 11 августа.',
      description:
        'Помогите собрать фотографии и проверенную информацию о животных, находящихся в приюте «Уши, лапы, хвост», для выставки «Носики Первых» и общего банка данных. Все сведения должны быть получены от представителей приюта: придумывать истории и характеристики животных нельзя.',
      duties: [
        'получить у организатора фотографию и проверенные сведения о животном',
        'подготовить карточку с кличкой, возрастом и особенностями характера',
        'указать сведения о здоровье только при наличии подтверждения приюта',
        'добавить информацию о поиске нового дома и контакты приюта',
        'проверить текст на ошибки и передать готовую карточку организатору'
      ],
      take_with_you: 'Телефон или компьютер с доступом в интернет. Все исходные сведения предоставит организатор.',
      contact_person: 'Евгений Валерьевич Кустов',
      is_active: true
    },
    {
      title: 'Помощь в оформлении выставки «Носики Первых»',
      category: 'Помощь на мероприятиях',
      event_date: '2026-08-12',
      start_time: '10:00',
      end_time: '11:00',
      place: 'Пришкольный лагерь',
      estimated_minutes: 60,
      slots: 8,
      min_age: 13,
      max_age: 99,
      format: 'Очно',
      confirmation_type: 'Подтверждение организатора',
      confirmation_text:
        'Организатор подтвердит участие и фактически отработанное время после завершения оформления выставки.',
      description:
        'Приглашаем волонтёров помочь оформить выставку «Носики Первых» в пришкольном лагере. На выставке будут представлены карточки животных из приюта «Уши, лапы, хвост», которым нужны внимание, забота и новый дом.',
      duties: [
        'подготовить выставочное пространство',
        'разместить карточки животных и информационные материалы',
        'проверить правильность подписей и контактных данных',
        'помочь оформить стенды и материалы для посетителей',
        'сделать фотографии готовой выставки',
        'привести площадку в порядок после завершения работы'
      ],
      take_with_you: 'Хорошее настроение и готовность аккуратно работать с выставочными материалами.',
      contact_person: 'Евгений Валерьевич Кустов',
      is_active: true
    },
    {
      title: 'Добровольческий выезд в приют «Уши, лапы, хвост»',
      category: 'Природа и животные',
      event_date: '2026-08-14',
      start_time: shelterStart,
      end_time: shelterEnd,
      place: 'Приют «Уши, лапы, хвост»',
      estimated_minutes: Math.max(60, durationMinutes(shelterStart, shelterEnd)),
      slots: 10,
      min_age: 13,
      max_age: 99,
      format: 'Очно',
      confirmation_type: 'Подтверждение организатора',
      confirmation_text:
        'Организатор подтвердит участие и фактически отработанное время после завершения помощи приюту.',
      description:
        'Посетим приют «Уши, лапы, хвост» и поможем его сотрудникам с актуальными хозяйственными задачами. Конкретный перечень работ будет согласован с представителями приюта. Все поручения выполняются под контролем взрослых и сотрудников приюта.',
      duties: [
        'передать собранную помощь приюту',
        'помочь с уборкой территории или помещений',
        'разложить корм и необходимые принадлежности',
        'выполнить безопасные хозяйственные поручения сотрудников приюта',
        'при разрешении сотрудников помочь с выгулом или общением с животными',
        'сделать фотографии для итоговой публикации'
      ],
      take_with_you:
        'Удобную закрытую одежду и обувь, рабочие перчатки и воду. Дополнительные требования организатор сообщит после согласования с приютом.',
      contact_person: 'Евгений Валерьевич Кустов',
      is_active: true
    }
  ];
}

export async function POST(request: NextRequest) {
  if (!checkBlagotvoriAdminPassword(request.headers.get('x-admin-password'))) return unauthorized();
  if (!isBlagotvoriConfigured()) return unavailable();

  try {
    const body = await request.json();
    const shelterStart = normalizeTime(body.shelter_start_time);
    const shelterEnd = normalizeTime(body.shelter_end_time);
    if (durationMinutes(shelterStart, shelterEnd) <= 0) {
      return NextResponse.json(
        { error: 'Время окончания посещения приюта должно быть позже времени начала.' },
        { status: 400 }
      );
    }

    const supabase = getBlagotvoriAdmin();
    const presets = buildPresets(shelterStart, shelterEnd);
    let created = 0;
    let updated = 0;

    for (const preset of presets) {
      const { data: existing, error: findError } = await supabase
        .from('bt_vacancies')
        .select('id')
        .eq('title', preset.title)
        .eq('event_date', preset.event_date)
        .maybeSingle();
      if (findError) throw findError;

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from('bt_vacancies')
          .update({ ...preset, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (updateError) throw updateError;
        updated += 1;
      } else {
        const { error: insertError } = await supabase.from('bt_vacancies').insert({
          ...preset,
          updated_at: new Date().toISOString()
        });
        if (insertError) throw insertError;
        created += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      updated,
      total: presets.length,
      message: `Готово: создано ${created}, обновлено ${updated}.`
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Не удалось добавить августовские акции.' },
      { status: 500 }
    );
  }
}
