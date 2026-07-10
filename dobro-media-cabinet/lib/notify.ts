export function minutesToHoursText(minutes?: number | null) {
  if (!minutes) return 'не указано';
  const hours = minutes / 60;
  const value = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
  return `${value} ч.`;
}

function getEmailSubject(text: string) {
  const firstLine = text.split('\n').find(line => line.trim())?.trim();
  return firstLine || 'Добро.Медиа: новое действие';
}

async function notifyByTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.error('Telegram notification failed:', response.status, details);
    }
  } catch (error) {
    console.error('Telegram notification failed:', error);
  }
}

async function notifyByEmail(text: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipient = process.env.ADMIN_EMAIL?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !recipient || !from) return;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: getEmailSubject(text),
        text
      })
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.error('Email notification failed:', response.status, details);
    }
  } catch (error) {
    console.error('Email notification failed:', error);
  }
}

export async function notifyAdmin(text: string) {
  await Promise.allSettled([
    notifyByTelegram(text),
    notifyByEmail(text)
  ]);
}
