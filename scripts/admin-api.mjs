// Dev-only API behind the /admin panel. It runs inside `npm run dev` and nowhere else:
// a production build (`npm run build`) contains neither this API nor the admin page.
//
//   POST /__admin/content  -> saves the JSON body to src/content/site.json (old version goes to content-backups/)
//   POST /__admin/upload   -> saves the raw body to public/uploads/<x-filename>, returns { path }

import { mkdir, readdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { dirname, extname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_FILE = join(ROOT, 'src/content/site.json');
const BACKUP_DIR = join(ROOT, 'content-backups');
const UPLOAD_DIR = join(ROOT, 'public/uploads');
const KEEP_BACKUPS = 30;
const MAX_UPLOAD = 25 * 1024 * 1024;
const UPLOAD_TYPES = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif',
  '.woff', '.woff2', '.ttf', '.otf',
  '.mp4', '.webm',
]);

const readBody = (req, limit) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('File is too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const send = (res, status, data) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
};

const exists = (p) => access(p).then(() => true, () => false);

// Only accept requests made by pages of this dev server (blocks other websites from writing files).
const sameOrigin = (req) => req.headers.origin && req.headers.origin === `http://${req.headers.host}`;

async function backup() {
  await mkdir(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await writeFile(join(BACKUP_DIR, `site-${stamp}.json`), await readFile(CONTENT_FILE));
  const files = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith('site-')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) await rm(join(BACKUP_DIR, f));
}

const IMAGE_TYPES = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif']);
const PUBLIC_DIR = join(ROOT, 'public');

async function listImages() {
  const out = [];
  const walk = async (dir, rel) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(join(dir, e.name), r);
      else if (IMAGE_TYPES.has(extname(e.name).toLowerCase())) out.push(r);
    }
  };
  await walk(PUBLIC_DIR, '');
  // uploads first, then dish photos, then venue photos, then anything else
  const rank = (p) => (p.startsWith('uploads/') ? 0 : p.startsWith('images/menu/') ? 1 : p.startsWith('images/venue/') ? 2 : 3);
  return out.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function adminApi() {
  return {
    name: '44lounge-admin-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__admin/')) return next();

        // Read-only list of the images in /public, for the image library in the panel.
        if (req.method === 'GET' && req.url === '/__admin/images') {
          try {
            return send(res, 200, { images: await listImages() });
          } catch (e) {
            return send(res, 500, { error: e.message });
          }
        }

        if (req.method !== 'POST' || !sameOrigin(req)) return send(res, 403, { error: 'Forbidden' });

        try {
          if (req.url === '/__admin/content') {
            const data = JSON.parse((await readBody(req, 5 * 1024 * 1024)).toString('utf8'));
            if (!data || typeof data !== 'object' || !data.theme || !data.general) {
              return send(res, 400, { error: 'This does not look like site content' });
            }
            await backup();
            await writeFile(CONTENT_FILE, JSON.stringify(data, null, 2) + '\n');
            return send(res, 200, { ok: true });
          }

          if (req.url === '/__admin/upload') {
            const raw = decodeURIComponent(String(req.headers['x-filename'] || ''));
            const ext = extname(raw).toLowerCase();
            if (!UPLOAD_TYPES.has(ext)) return send(res, 400, { error: `File type ${ext || '?'} is not allowed` });
            const stem = basename(raw, extname(raw)).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
            const body = await readBody(req, MAX_UPLOAD);
            if (!body.length) return send(res, 400, { error: 'Empty file' });
            await mkdir(UPLOAD_DIR, { recursive: true });
            let name = `${stem}${ext}`;
            for (let i = 2; await exists(join(UPLOAD_DIR, name)); i++) name = `${stem}-${i}${ext}`;
            await writeFile(join(UPLOAD_DIR, name), body);
            return send(res, 200, { path: `uploads/${name}` });
          }

          return send(res, 404, { error: 'Not found' });
        } catch (e) {
          return send(res, 500, { error: e.message });
        }
      });
    },
  };
}
