// Table booking: validates a request and sends it to the lounge's Telegram chat.
// Used by the dev server (scripts/booking-api.mjs) and by the hosted function (api/book.js).
//
// Settings (in .env.local for local use, or in the hosting dashboard):
//   TELEGRAM_BOT_TOKEN  token of the bot created with @BotFather
//   TELEGRAM_CHAT_ID    chat that receives bookings (a person or a staff group)

const MAX_GUESTS = 30;

function clean(v, max = 80) {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max);
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function validateBooking(body) {
  const b = body && typeof body === 'object' ? body : {};
  // invisible field: real people leave it empty, spam bots fill it in
  if (clean(b.website)) return { error: 'Invalid request' };

  const name = clean(b.name, 60);
  const phone = clean(b.phone, 30);
  const guests = Number.parseInt(b.guests, 10);
  const date = clean(b.date, 10);
  const time = clean(b.time, 5);

  if (name.length < 2) return { error: 'Please enter your name.' };
  if ((phone.match(/\d/g) || []).length < 8 || !/^[+\d\s()-]+$/.test(phone)) return { error: 'Please enter a valid phone number.' };
  if (!Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) return { error: 'Please choose the number of guests.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { error: 'Please choose a date.' };
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: 'Please choose a time.' };

  return { booking: { name, phone, guests, date, time } };
}

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export async function sendBooking(booking, env = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { status: 503, error: 'Online booking is not set up yet. Please call us to book.' };

  const tel = booking.phone.replace(/[^\d+]/g, '');
  const text = [
    '<b>New table booking</b>',
    '',
    `<b>Name:</b> ${escapeHtml(booking.name)}`,
    `<b>Phone:</b> <a href="tel:${tel}">${escapeHtml(booking.phone)}</a>`,
    `<b>Guests:</b> ${booking.guests}`,
    `<b>Date:</b> ${escapeHtml(formatDate(booking.date))}`,
    `<b>Time:</b> ${escapeHtml(booking.time)}`,
  ].join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return { status: 502, error: 'Could not send the booking right now. Please call us.' };
    return { status: 200 };
  } catch {
    return { status: 502, error: 'Could not send the booking right now. Please call us.' };
  }
}

// Very small in-memory limit per visitor (protects the chat from floods).
const hits = new Map();
export function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 5;
}

export async function handleBooking(body, ip, env) {
  if (rateLimited(ip || 'unknown')) return { status: 429, error: 'Too many requests. Please call us to book.' };
  const { booking, error } = validateBooking(body);
  if (error) return { status: 400, error };
  return sendBooking(booking, env);
}
