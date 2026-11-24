// Live-site admin: read / save the site content and upload images, through GitHub (see github.js).
// All three need the admin password (admin-auth.js).
import { randomBytes } from 'node:crypto';
import { checkAdmin } from './admin-auth.js';
import { GitHubError, githubConfig, listImages, publish, readContent, storeFile } from './github.js';

const NOT_SET_UP = 'Live editing is not set up yet: add GITHUB_TOKEN in Vercel (see README → Editing the live site).';
const UPLOAD_TYPES = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'woff', 'woff2', 'ttf', 'otf']);
const MAX_UPLOAD = 3 * 1024 * 1024; // the request limit on Vercel is 4.5 MB, and base64 adds a third

function fail(e) {
  if (e instanceof GitHubError) {
    if (e.status === 409) return { status: 409, error: e.message };
    if (e.status === 401 || e.status === 403) return { status: 502, error: 'GitHub refused the token. Check GITHUB_TOKEN (repository access, "Contents: Read and write").' };
    if (e.status === 404) return { status: 502, error: 'GitHub repository or branch not found. Check GITHUB_TOKEN / GITHUB_REPO.' };
  }
  console.error('[admin]', e);
  return { status: 502, error: 'Could not reach GitHub right now. Try again in a moment.' };
}

function guard(req) {
  const denied = checkAdmin(req);
  if (denied) return { denied };
  const cfg = githubConfig(req.env);
  if (!cfg) return { denied: { status: 503, error: NOT_SET_UP } };
  return { cfg };
}

// GET → { content, sha } · POST { content, sha, uploads } → { sha, commit }
export async function handleContent(req) {
  const { denied, cfg } = guard(req);
  if (denied) return denied;
  try {
    if (req.method === 'GET') return { status: 200, data: await readContent(cfg) };
    if (req.method !== 'POST') return { status: 405, error: 'Method not allowed' };
    const { content, sha, uploads } = req.body || {};
    if (!content || typeof content !== 'object' || !content.general || !content.menu || !content.theme) {
      return { status: 400, error: 'That does not look like the site content.' };
    }
    const files = (Array.isArray(uploads) ? uploads : [])
      .filter((u) => u && /^uploads\/[\w.-]+$/.test(u.path) && /^[0-9a-f]{40}$/.test(u.sha))
      .slice(0, 50);
    const result = await publish(cfg, {
      content,
      baseSha: typeof sha === 'string' ? sha : '',
      uploads: files,
      message: `Update site content from the admin${files.length ? ` (+${files.length} file${files.length > 1 ? 's' : ''})` : ''}`,
    });
    return { status: 200, data: result };
  } catch (e) {
    return fail(e);
  }
}

// POST { name, data (base64) } → { path, sha }. The file is committed with the next content save.
export async function handleUpload(req) {
  const { denied, cfg } = guard(req);
  if (denied) return denied;
  if (req.method !== 'POST') return { status: 405, error: 'Method not allowed' };
  const { name, data } = req.body || {};
  const ext = String(name || '').split('.').pop().toLowerCase();
  if (!UPLOAD_TYPES.has(ext)) return { status: 400, error: `File type .${ext || '?'} is not allowed` };
  if (typeof data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(data)) return { status: 400, error: 'Invalid file' };
  if ((data.length * 3) / 4 > MAX_UPLOAD) return { status: 413, error: 'File is too large (max 3 MB).' };
  const stem =
    String(name)
      .replace(/\.[^.]+$/, '')
      .normalize('NFKD')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 50) || 'file';
  // a short random ending, so an upload never replaces an existing file
  const path = `uploads/${stem}-${randomBytes(3).toString('hex')}.${ext}`;
  try {
    return { status: 200, data: { path, sha: await storeFile(cfg, data) } };
  } catch (e) {
    return fail(e);
  }
}

// GET → { images: [...] }
export async function handleImages(req) {
  const { denied, cfg } = guard(req);
  if (denied) return denied;
  try {
    return { status: 200, data: { images: await listImages(cfg) } };
  } catch (e) {
    return fail(e);
  }
}
