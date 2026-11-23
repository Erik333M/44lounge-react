// Hosted booking endpoint (Vercel serverless function): POST /api/book
import { handleBooking } from '../server/booking.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const result = await handleBooking(body, ip, process.env);
  return res.status(result.status).json(result.error ? { error: result.error } : { ok: true });
}
