// Hosted booking endpoint (Vercel serverless function): POST /api/book
import { handleBooking } from '../server/booking.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid request' });
    }
  }
  const result = await handleBooking(body, ip, process.env);
  return res.status(result.status).json(result.error ? { error: result.error } : { ok: true });
}
