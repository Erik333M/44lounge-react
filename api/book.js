// Hosted booking endpoint (Vercel serverless function): POST /api/book
import { handleBooking } from '../server/booking.js';
import { bookingsStore } from '../server/bookings-store.js';
import { clientIp, readBody, reply } from './_http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const body = readBody(req);
  if (!body) return res.status(400).json({ error: 'Invalid request' });
  return reply(res, await handleBooking(body, clientIp(req), process.env, bookingsStore(process.env)));
}
