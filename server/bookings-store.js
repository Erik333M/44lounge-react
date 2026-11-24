// Where table requests are kept, so staff can see and answer them in the admin.
//
// Hosted (Vercel): a Redis database from the Vercel Marketplace (Upstash). Adding it to the project sets
//   KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
// On your computer (npm run dev): a file, data/bookings.json (not uploaded to GitHub).

import { randomUUID } from 'node:crypto';

const KEY = 'bookings';
export const STATUSES = ['pending', 'confirmed', 'declined'];

function redisStore(url, token) {
  const call = async (...cmd) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `Storage error ${res.status}`);
    return data.result;
  };
  return {
    async add(record) {
      await call('HSET', KEY, record.id, JSON.stringify(record));
      return record;
    },
    async list() {
      const flat = (await call('HGETALL', KEY)) || [];
      const out = [];
      for (let i = 1; i < flat.length; i += 2) {
        try {
          out.push(JSON.parse(flat[i]));
        } catch {
          /* skip a broken entry */
        }
      }
      return out;
    },
    async get(id) {
      const raw = await call('HGET', KEY, id);
      return raw ? JSON.parse(raw) : null;
    },
    async put(record) {
      await call('HSET', KEY, record.id, JSON.stringify(record));
      return record;
    },
    async remove(id) {
      await call('HDEL', KEY, id);
    },
  };
}

function fileStore(file) {
  const load = async () => {
    const { readFile } = await import('node:fs/promises');
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {
      return [];
    }
  };
  const save = async (list) => {
    const { mkdir, writeFile, rename } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(list, null, 2));
    await rename(tmp, file); // never leaves a half-written file
  };
  // one write at a time
  let queue = Promise.resolve();
  const locked = (fn) => (queue = queue.then(fn, fn));
  return {
    add: (record) => locked(async () => save([...(await load()), record]).then(() => record)),
    list: () => load(),
    async get(id) {
      return (await load()).find((b) => b.id === id) || null;
    },
    put: (record) =>
      locked(async () => {
        const list = await load();
        await save(list.map((b) => (b.id === record.id ? record : b)));
        return record;
      }),
    remove: (id) => locked(async () => save((await load()).filter((b) => b.id !== id))),
  };
}

// null when nothing is set up (hosted without a database).
export function bookingsStore(env = process.env, { localFile } = {}) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return redisStore(url.replace(/\/$/, ''), token);
  if (localFile) return fileStore(localFile);
  return null;
}

export function newBooking(fields) {
  return { id: randomUUID(), createdAt: new Date().toISOString(), status: 'pending', ...fields };
}

// newest first
export const sortBookings = (list) => [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
