// Table booking: checks a request, saves it as "pending" for the admin's Bookings page, and (optionally)
// also pings the lounge's Telegram chat. Used by the dev server (scripts/booking-api.mjs) and by the
// hosted functions (api/book.js, api/bookings.js).
//
// Settings (in .env.local for local use, or in the hosting dashboard):
//   KV_REST_API_URL / KV_REST_API_TOKEN   booking storage (Vercel → Storage → Upstash Redis); see bookings-store.js
//   ADMIN_PASSWORD                        password for the Bookings page at /admin on the live site
//   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID optional: also send each new request to Telegram

import { createHash, timingSafeEqual } from 'node:crypto';
import { newBooking, sortBookings, STATUSES } from './bookings-store.js';

const MAX_GUESTS = 30;

function clean(v, max = 80) {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max);
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Required: name, phone, guests, date. Time is optional ("any time").
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
  if (time && !/^\d{2}:\d{2}$/.test(time)) return { error: 'Please choose a time.' };

  const lang = { hy: 'Armenian', ru: 'Russian' }[b.lang] || 'English';
  return { booking: { name, phone, guests, date, time, lang } };
}

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Optional extra alert. Returns true when sent, false when not set up or failed.
export async function notifyTelegram(booking, env = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const tel = booking.phone.replace(/[^\d+]/g, '');
  const text = [
    '<b>New table request</b> (pending)',
    '',
    `<b>Name:</b> ${escapeHtml(booking.name)}`,
    `<b>Phone:</b> <a href="tel:${tel}">${escapeHtml(booking.phone)}</a>`,
    `<b>Guests:</b> ${booking.guests}`,
    `<b>Date:</b> ${escapeHtml(formatDate(booking.date))}`,
    `<b>Time:</b> ${escapeHtml(booking.time || 'any time')}`,
    `<b>Language:</b> ${booking.lang || 'English'}`,
    '',
    'Confirm or decline it in the admin → Bookings.',
  ].join('\n');
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok;
  } catch {
    return false;
  }
}

// Very small in-memory limit per visitor (protects against floods).
const hits = new Map();
export function rateLimited(ip, { max = 5, windowMs = 10 * 60 * 1000, bucket = 'book' } = {}) {
  const key = `${bucket}:${ip || 'unknown'}`;
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

const UNAVAILABLE = 'Online booking is not set up yet. Please call us to book.';
const FAILED = 'Could not send the booking right now. Please call us.';

// POST /api/book
export async function handleBooking(body, ip, env, store) {
  if (rateLimited(ip)) return { status: 429, error: 'Too many requests. Please call us to book.' };
  const { booking, error } = validateBooking(body);
  if (error) return { status: 400, error };

  const record = newBooking(booking);
  let saved = false;
  if (store) {
    try {
      await store.add(record);
      saved = true;
    } catch (e) {
      console.error('[booking] could not save:', e.message);
    }
  }
  const sent = await notifyTelegram(record, env);
  if (saved || sent) return { status: 200, data: { ok: true } };
  return { status: store ? 502 : 503, error: store ? FAILED : UNAVAILABLE };
}

// ---- admin: list and answer requests ----

const digest = (s) => createHash('sha256').update(String(s)).digest();

// `open` is true only on the local dev server (no password needed on your own computer).
export function authorized(auth, env, { open = false } = {}) {
  const password = env.ADMIN_PASSWORD;
  if (!password) return open;
  const given = String(auth || '').replace(/^Bearer\s+/i, '');
  return timingSafeEqual(digest(given), digest(password));
}

const LOGIN_LIMIT = { max: 10, windowMs: 15 * 60 * 1000, bucket: 'login' };
function loginLocked(ip) {
  const now = Date.now();
  const list = (hits.get(`login:${ip || 'unknown'}`) || []).filter((t) => now - t < LOGIN_LIMIT.windowMs);
  return list.length >= LOGIN_LIMIT.max;
}

// GET /api/bookings → list · POST /api/bookings { id, status } → update · POST { id, remove: true } → delete
export async function handleBookingsAdmin({ method, body, auth, ip, env, store, open = false }) {
  if (!env.ADMIN_PASSWORD && !open) return { status: 503, error: 'Set ADMIN_PASSWORD to use the Bookings page.' };
  // slow down password guessing: after 10 wrong tries, every try is refused for 15 minutes
  if (loginLocked(ip)) return { status: 429, error: 'Too many attempts. Try again later.' };
  if (!authorized(auth, env, { open })) {
    rateLimited(ip, LOGIN_LIMIT);
    return { status: 401, error: 'Wrong password' };
  }
  if (!store) return { status: 503, error: 'Booking storage is not set up yet (see README → Bookings).' };

  try {
    if (method === 'GET') return { status: 200, data: { bookings: sortBookings(await store.list()) } };
    if (method === 'POST') {
      const id = clean(body?.id, 64);
      const current = id && (await store.get(id));
      if (!current) return { status: 404, error: 'Booking not found' };
      if (body.remove) {
        await store.remove(id);
        return { status: 200, data: { ok: true } };
      }
      if (!STATUSES.includes(body.status)) return { status: 400, error: 'Unknown status' };
      const updated = await store.put({ ...current, status: body.status, updatedAt: new Date().toISOString() });
      return { status: 200, data: { booking: updated } };
    }
    return { status: 405, error: 'Method not allowed' };
  } catch (e) {
    console.error('[bookings] storage error:', e.message);
    return { status: 502, error: 'Booking storage is not reachable right now.' };
  }
}
