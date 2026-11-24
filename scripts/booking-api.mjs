// Makes /api/book and /api/bookings work while running `npm run dev` (same logic as the hosted functions).
// Without a Redis database in .env.local, requests are kept in data/bookings.json on this computer,
// and the Bookings page needs no password unless ADMIN_PASSWORD is set.
import { join } from 'node:path';
import { handleBooking, handleBookingsAdmin } from '../server/booking.js';
import { bookingsStore } from '../server/bookings-store.js';

export function bookingApi(env) {
  const store = bookingsStore(env, { localFile: join(process.cwd(), 'data', 'bookings.json') });

  const send = (res, result) => {
    res.statusCode = result.status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(result.error ? { error: result.error } : result.data || { ok: true }));
  };
  const readJson = (req) =>
    new Promise((resolve) => {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
        if (raw.length > 10000) req.destroy();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(raw || '{}'));
        } catch {
          resolve(null);
        }
      });
    });

  return {
    name: '44lounge-booking-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/bookings', async (req, res) => {
        const body = req.method === 'POST' ? await readJson(req) : {};
        if (!body) return send(res, { status: 400, error: 'Invalid request' });
        send(
          res,
          await handleBookingsAdmin({
            method: req.method,
            body,
            auth: req.headers.authorization,
            ip: req.socket.remoteAddress,
            env,
            store,
            open: true,
          })
        );
      });
      server.middlewares.use('/api/book', async (req, res, next) => {
        if (req.url !== '/' && req.url !== '') return next(); // let /api/bookings through
        if (req.method !== 'POST') return send(res, { status: 405, error: 'Method not allowed' });
        const body = await readJson(req);
        if (!body) return send(res, { status: 400, error: 'Invalid request' });
        send(res, await handleBooking(body, req.socket.remoteAddress, env, store));
      });
    },
  };
}
