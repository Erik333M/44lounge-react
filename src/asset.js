// Builds a URL to a file in /public (works when the site is deployed under a sub-path too).
// Full http(s) URLs are returned as they are.
export const asset = (path) =>
  /^(https?:)?\/\//.test(path || '') ? path : encodeURI(`${import.meta.env.BASE_URL}${String(path || '').replace(/^\/+/, '')}`);
