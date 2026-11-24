// Hosted admin endpoint for table requests (password: ADMIN_PASSWORD):
//   GET  /api/bookings               list, newest first
//   POST /api/bookings { id, status } confirm / decline / back to pending
//   POST /api/bookings { id, remove } delete
import { handleBookingsAdmin } from '../server/booking.js';
import { bookingsStore } from '../server/bookings-store.js';
import { clientIp, readBody, reply } from './_http.js';

export default async function handler(req, res) {
  const body = req.method === 'POST' ? readBody(req) : {};
  if (!body) return res.status(400).json({ error: 'Invalid request' });
  return reply(
    res,
    await handleBookingsAdmin({
      method: req.method,
      body,
      auth: req.headers.authorization,
      ip: clientIp(req),
      env: process.env,
      store: bookingsStore(process.env),
    })
  );
}
