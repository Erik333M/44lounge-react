// Live-site admin endpoint: /api/content (password: ADMIN_PASSWORD). See server/admin-content.js.
import { handleContent } from '../server/admin-content.js';
import { clientIp, readBody, reply } from './_http.js';

export default async function handler(req, res) {
  const body = req.method === 'POST' ? readBody(req) : {};
  if (!body) return res.status(400).json({ error: 'Invalid request' });
  return reply(res, await handleContent({ method: req.method, body, auth: req.headers.authorization, ip: clientIp(req), env: process.env }));
}
