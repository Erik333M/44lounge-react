// Calls to the dev-only API in scripts/admin-api.mjs.

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const saveContent = (content) =>
  fetch('/__admin/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  }).then(json);

export const uploadFile = (file) =>
  fetch('/__admin/upload', {
    method: 'POST',
    headers: { 'x-filename': encodeURIComponent(file.name) },
    body: file,
  })
    .then(json)
    .then((d) => d.path);

export const listImages = () =>
  fetch('/__admin/images')
    .then(json)
    .then((d) => d.images);
