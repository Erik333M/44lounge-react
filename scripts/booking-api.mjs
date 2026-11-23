// Makes POST /api/book work while running `npm run dev` (same logic as the hosted function).
import { handleBooking } from '../server/booking.js';

export function bookingApi(env) {
  return {
    name: '44lounge-booking-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/book', (req, res) => {
        const send = (status, data) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };
        if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
        let raw = '';
        req.on('data', (c) => {
          raw += c;
          if (raw.length > 10000) req.destroy();
        });
        req.on('end', async () => {
          let body = {};
          try {
            body = JSON.parse(raw || '{}');
          } catch {
            return send(400, { error: 'Invalid request' });
          }
          const result = await handleBooking(body, req.socket.remoteAddress, env);
          send(result.status, result.error ? { error: result.error } : { ok: true });
        });
      });
    },
  };
}
