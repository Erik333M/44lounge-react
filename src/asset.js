// Builds a URL to a file in /public (works when the site is deployed under a sub-path too).
// Full http(s) URLs are returned as they are. While the admin is open, images uploaded but not yet
// published are shown from a local copy (window.__previewAssets, set by the admin and its preview).
export const asset = (path) => {
  const local = typeof window !== 'undefined' && window.__previewAssets?.[path];
  if (local) return local;
  return /^(https?:)?\/\//.test(path || '') ? path : encodeURI(`${import.meta.env.BASE_URL}${String(path || '').replace(/^\/+/, '')}`);
};
