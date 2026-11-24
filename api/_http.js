// Shared bits for the hosted functions. (Files starting with "_" are not endpoints on Vercel.)
export const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;

export function readBody(req) {
  if (typeof req.body !== 'string') return req.body || {};
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return null;
  }
}

export function reply(res, result) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(result.status).json(result.error ? { error: result.error } : result.data || { ok: true });
}
