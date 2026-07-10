# Перенос Добро.Медиа на Cloud.ru Evolution

Ветка `cloudru-migration` предназначена для параллельного запуска сайта
в российском Cloud.ru Container Apps. Ветка `main`, Vercel и база Supabase
не изменяются.

## 1. Ресурсы Cloud.ru

1. Создайте аккаунт Cloud.ru Evolution.
2. Создайте Artifact Registry.
3. Создайте Container App из образа `dobro-media:latest`.
4. Используйте порт контейнера `3000`.
5. Минимальное количество экземпляров: `1` на этапе проверки.
6. Публичный доступ: включён.

Container Apps требует образ формата linux/amd64. Workflow уже собирает его
для этой платформы.

## 2. Секреты GitHub для загрузки образа

В настройках репозитория GitHub добавьте Actions secrets:

- `CLOUDRU_REGISTRY` — адрес реестра без `https://`;
- `CLOUDRU_REGISTRY_USERNAME`;
- `CLOUDRU_REGISTRY_PASSWORD`.

После этого вручную запустите workflow `Build image for Cloud.ru`
из ветки `cloudru-migration`.

## 3. Переменные Container App

Скопируйте значения из действующего проекта Vercel.

Публичные переменные:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_VK_COMMUNITY_URL`
- `NEXT_PUBLIC_VK_MESSAGES_URL`

Секретные переменные:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PIN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `RESEND_API_KEY`
- `ADMIN_EMAIL`
- `EMAIL_FROM`
- `VK_GROUP_TOKEN`
- `VK_ADMIN_PEER_ID`
- `VK_API_VERSION`

Не добавляйте реальные значения в GitHub и не присылайте их в переписку.

## 4. Сохранность данных

Cloud.ru будет подключён к существующему проекту Supabase. Все задания,
заявки, статусы, ссылки, время и комментарии сохранятся.

Не выполняйте повторно `dobro-media-cabinet/supabase/schema.sql`: файл
содержит команды очистки таблиц.

## 5. Проверка

До переключения основного адреса одновременно оставьте Vercel и Cloud.ru.

1. Откройте адрес `*.containerapps.ru` без VPN.
2. Проверьте существующие записи календаря.
3. Возьмите тестовую активность.
4. Сдайте тестовую ссылку.
5. Откройте `/admin` и проверьте PIN.
6. Измените статус и комментарий.
7. Проверьте уведомления.
8. Удалите тестовую запись.

Только после полной проверки подключайте основной домен. Vercel останется
резервной версией.
