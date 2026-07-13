import { createHash } from 'node:crypto';

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

export function vkRandomIdForEvent(eventKey?: string) {
  if (!eventKey) return Math.floor(Math.random() * 2147483646) + 1;

  const digest = createHash('sha256').update(eventKey).digest();
  return (digest.readUInt32BE(0) & 0x7fffffff) || 1;
}

export async function sendVkAdminMessage(text: string, eventKey?: string) {
  const token = process.env.VK_GROUP_TOKEN?.trim();
  const peerId = process.env.VK_ADMIN_PEER_ID?.trim();
  const version = process.env.VK_API_VERSION?.trim() || '5.199';

  if (!token || !peerId) {
    return { sent: false, error: 'Не заданы VK_GROUP_TOKEN и VK_ADMIN_PEER_ID' };
  }

  try {
    const randomId = vkRandomIdForEvent(eventKey);
    const params = new URLSearchParams({
      access_token: token,
      v: version,
      peer_id: peerId,
      random_id: String(randomId),
      message: text
    });

    const response = await fetch('https://api.vk.com/method/messages.send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result || result.error) {
      const details = result?.error?.error_msg || `HTTP ${response.status}`;
      console.error('VK notification failed:', details, result?.error || '');
      return { sent: false, error: details };
    }

    return { sent: true };
  } catch (error: any) {
    console.error('VK notification failed:', error);
    return { sent: false, error: error?.message || 'Неизвестная ошибка VK' };
  }
}

export async function notifyAdmin(text: string, eventKey?: string) {
  await Promise.allSettled([
    notifyByTelegram(text),
    notifyByEmail(text),
    sendVkAdminMessage(text, eventKey)
  ]);
}
