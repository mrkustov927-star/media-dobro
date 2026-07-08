export type Activity = {
  id: string;
  day: number;
  month: number;
  title: string;
  tag: string;
  type: 'r' | 'b' | 'd';
  description: string;
  task: string;
  how_to: string;
  collect: string;
  send_to_admin: string;
  estimated_minutes: number;
  is_active: boolean;
  sort_order: number;
};

export type AssignmentStatus =
  | 'Взято в работу'
  | 'Материал сдан'
  | 'На доработке'
  | 'Проверено'
  | 'Зачтено'
  | 'Отменено';

export type Assignment = {
  id: string;
  activity_id: string;
  volunteer_name: string;
  status: AssignmentStatus;
  planned_minutes: number | null;
  spent_minutes: number | null;
  material_link: string | null;
  volunteer_comment: string | null;
  admin_comment: string | null;
  created_at: string;
  updated_at: string;
};
