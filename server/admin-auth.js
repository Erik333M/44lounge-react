// Password check for everything under /admin on the live site (bookings, content, uploads).
// The password is ADMIN_PASSWORD (Vercel → Settings → Environment Variables). On your own computer
// (`npm run dev`) no password is needed unless ADMIN_PASSWORD is set in .env.local.

import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (s) => createHash('sha256').update(String(s)).digest();

// wrong tries per visitor; after 10 within 15 minutes every try is refused (even the right password)
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

function recent(ip) {
  const now = Date.now();
  const list = (failures.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  failures.set(ip, list);
  return list;
}

/**
 * Returns null when the request may go on, or { status, error } to send back.
 * `open` is true only on the local dev server.
 */
export function checkAdmin({ auth, ip, env, open = false }) {
  const password = env.ADMIN_PASSWORD;
  if (!password) return open ? null : { status: 503, error: 'Set ADMIN_PASSWORD to use the admin.' };
  const who = ip || 'unknown';
  if (recent(who).length >= MAX_FAILURES) return { status: 429, error: 'Too many attempts. Try again later.' };
  const given = String(auth || '').replace(/^Bearer\s+/i, '');
  if (timingSafeEqual(digest(given), digest(password))) return null;
  recent(who).push(Date.now());
  return { status: 401, error: 'Wrong password' };
}
