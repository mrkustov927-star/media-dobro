-- Выполнить после schema.sql, если живые обновления не появляются автоматически.
-- В Supabase также можно включить Realtime в интерфейсе: Database → Replication.

alter publication supabase_realtime add table activities;
alter publication supabase_realtime add table assignments;
