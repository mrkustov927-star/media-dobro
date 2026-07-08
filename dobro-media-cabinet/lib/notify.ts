export function minutesToHoursText(minutes?: number | null) {
  if (!minutes) return 'не указано';
  const hours = minutes / 60;
  const value = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
  return `${value} ч.`;
}

export async function notifyAdmin(text: string) {
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
