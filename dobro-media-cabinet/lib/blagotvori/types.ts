export type VacancyCategory =
  | 'Помощь людям'
  | 'Природа и животные'
  | 'Помощь на мероприятиях'
  | 'Медиа'
  | 'Дистанционные задания';

export type VacancyFormat = 'Очно' | 'Дистанционно';

export type ConfirmationType =
  | 'Подтверждение организатора'
  | 'Ссылка на материал'
  | 'Фото результата'
  | 'Ссылка или файл';

export type ApplicationStatus =
  | 'Заявка подана'
  | 'Участие подтверждено'
  | 'В работе'
  | 'Отчёт отправлен'
  | 'На доработке'
  | 'Часы зачтены'
  | 'Отменено'
  | 'Не участвовал';

export type Vacancy = {
  id: string;
  title: string;
  category: VacancyCategory;
  event_date: string;
  start_time: string;
  end_time: string | null;
  place: string;
  estimated_minutes: number;
  slots: number;
  free_slots: number;
  occupied_slots?: number;
  min_age: number | null;
  max_age: number | null;
  format: VacancyFormat;
  confirmation_type: ConfirmationType;
  confirmation_text: string;
  description: string;
  duties: string[];
  take_with_you: string;
  contact_person: string | null;
  is_active: boolean;
};

export type VolunteerApplication = {
  id: string;
  vacancy_id: string;
  volunteer_name: string;
  contact: string;
  status: ApplicationStatus;
  actual_minutes: number | null;
  evidence_url: string | null;
  evidence_comment: string | null;
  admin_comment: string | null;
  hours_confirmed: boolean;
  dobro_hours_entered: boolean;
  created_at: string;
};
