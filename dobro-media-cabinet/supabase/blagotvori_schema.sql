create extension if not exists pgcrypto;

create table if not exists public.bt_vacancies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in (
    'Помощь людям',
    'Природа и животные',
    'Помощь на мероприятиях',
    'Медиа',
    'Дистанционные задания'
  )),
  event_date date not null,
  start_time time not null,
  end_time time,
  place text not null,
  estimated_minutes integer not null check (estimated_minutes > 0),
  slots integer not null default 1 check (slots > 0),
  min_age integer,
  max_age integer,
  format text not null check (format in ('Очно', 'Дистанционно')),
  confirmation_type text not null check (confirmation_type in (
    'Подтверждение организатора',
    'Ссылка на материал',
    'Фото результата',
    'Ссылка или файл'
  )),
  confirmation_text text not null,
  description text not null,
  duties jsonb not null default '[]'::jsonb,
  take_with_you text not null default 'Ничего специального брать не нужно.',
  contact_person text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bt_applications (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid not null references public.bt_vacancies(id) on delete cascade,
  volunteer_name text not null,
  contact text not null,
  status text not null default 'Заявка подана' check (status in (
    'Заявка подана',
    'Участие подтверждено',
    'В работе',
    'Отчёт отправлен',
    'На доработке',
    'Часы зачтены',
    'Отменено',
    'Не участвовал'
  )),
  actual_minutes integer,
  evidence_url text,
  evidence_comment text,
  admin_comment text,
  hours_confirmed boolean not null default false,
  dobro_hours_entered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bt_applications_no_duplicate_active
  on public.bt_applications (vacancy_id, lower(volunteer_name), lower(contact))
  where status not in ('Отменено', 'Не участвовал');

create index if not exists bt_vacancies_event_date_idx
  on public.bt_vacancies (event_date);

create index if not exists bt_applications_vacancy_idx
  on public.bt_applications (vacancy_id);

alter table public.bt_vacancies enable row level security;
alter table public.bt_applications enable row level security;

-- Публичный доступ осуществляется только через серверные API-маршруты сайта.
-- Для браузера отдельные политики не создаются.
