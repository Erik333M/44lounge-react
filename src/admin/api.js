// How the admin reads and saves.
//   npm run dev  → files on this computer (scripts/admin-api.mjs)
//   live site    → GitHub through /api/content, /api/upload, /api/images (password); a save publishes the site
import saved from '../content/site.json';
import { authHeaders } from './auth.js';

export const LIVE = !import.meta.env.DEV;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function json(res) {
  const type = res.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new ApiError('The admin service is not reachable.', 0);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `HTTP ${res.status}`, res.status);
  return data;
}

const call = (url, { method = 'GET', body } = {}) =>
  fetch(url, {
    method,
    cache: 'no-store',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  }).then(json);

// ---- files uploaded in this session, not saved yet ----
// path → { sha, url }: `url` is a local preview, used by the admin and its preview until the site is republished.
const pending = new Map();
const previewMap = () => Object.fromEntries([...pending].map(([path, p]) => [path, p.url]));
const publishPreview = () => {
  window.__previewAssets = previewMap(); // read by asset() so new images show before they are published
};
export const previewAssets = previewMap;

// ---- content ----

// { content, sha } — on the live site always the latest version from GitHub
export async function loadContent() {
  if (!LIVE) return { content: saved, sha: null };
  return call('/api/content');
}

export async function saveContent(content, { sha } = {}) {
  if (!LIVE) return call('/__admin/content', { method: 'POST', body: content });
  const uploads = [...pending].map(([path, p]) => ({ path, sha: p.sha }));
  const result = await call('/api/content', { method: 'POST', body: { content, sha, uploads } });
  // the uploads are part of the commit now; keep their previews until the new version is online
  pending.forEach((p) => (p.saved = true));
  return result;
}

// ---- uploads ----

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

// Large photos are scaled down (max 2000 px) and saved as WebP before uploading, keeping transparency.
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { blob: file, name: file.name };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 600 * 1024) return { blob: file, name: file.name };
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.86));
    if (!blob || blob.size >= file.size) return { blob: file, name: file.name };
    return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.webp' };
  } catch {
    return { blob: file, name: file.name };
  }
}

// Returns the site path of the uploaded file (uploads/…).
export async function uploadFile(file) {
  if (!LIVE) {
    return fetch('/__admin/upload', {
      method: 'POST',
      headers: { 'x-filename': encodeURIComponent(file.name) },
      body: file,
    })
      .then(json)
      .then((d) => d.path);
  }
  const { blob, name } = await shrink(file);
  if (blob.size > 3 * 1024 * 1024) throw new ApiError('File is too large (max 3 MB).', 413);
  const { path, sha } = await call('/api/upload', { method: 'POST', body: { name, data: await blobToBase64(blob) } });
  pending.set(path, { sha, url: URL.createObjectURL(blob) });
  publishPreview();
  return path;
}

export async function listImages() {
  if (!LIVE) return call('/__admin/images').then((d) => d.images);
  const { images } = await call('/api/images');
  // this session's uploads first
  return [...new Set([...[...pending.keys()].reverse(), ...images])];
}

export const hasUnsavedUploads = () => [...pending.values()].some((p) => !p.saved);
