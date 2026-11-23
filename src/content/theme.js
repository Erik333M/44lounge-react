// Applies the editable colors and fonts as CSS variables on <html>.
// Every style in the site reads these variables, so a change in the admin recolors the whole site.

export const SYSTEM_FONTS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Courier New'];

// Loaded by index.html already.
const PRELOADED = ['unbounded', 'manrope', 'jetbrains mono'];

const FONTS_LINK_ID = 'site-theme-fonts';
const FACES_ID = 'site-theme-faces';

const COLOR_VARS = {
  background: '--bg',
  surface: '--surface',
  text: '--text',
  muted: '--muted',
  accent: '--accent',
  brass: '--brass',
};
const FONT_VARS = {
  display: ['--font-display', 'sans-serif'],
  body: ['--font-body', 'sans-serif'],
  mono: ['--font-mono', 'monospace'],
};

const cssFontName = (name) => `"${String(name).replace(/["\\]/g, '')}"`;

// Google Fonts stylesheet URL for the theme fonts that still need loading ('' when none).
export function googleFontsHref(theme, { includePreloaded = false } = {}) {
  const custom = new Set((theme.customFonts || []).map((f) => f.name?.toLowerCase()));
  const skip = new Set([...SYSTEM_FONTS.map((f) => f.toLowerCase()), ...(includePreloaded ? [] : PRELOADED)]);
  const names = [...new Set(Object.values(theme.fonts || {}))].filter((n) => {
    const l = String(n || '').trim().toLowerCase();
    return l && !custom.has(l) && !skip.has(l);
  });
  if (!names.length) return '';
  const families = names.map((n) => `${encodeURIComponent(n.trim()).replace(/%20/g, '+')}:300,400,500,600,700`);
  return `https://fonts.googleapis.com/css?family=${families.join('|')}&display=swap`;
}

export const fontFaces = (theme) =>
  (theme.customFonts || [])
    .filter((f) => f.name && f.file)
    .map((f) => `@font-face{font-family:${cssFontName(f.name)};src:url("/${encodeURI(f.file)}");font-display:swap;}`)
    .join('');

function ensure(tag, id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement(tag);
    el.id = id;
    if (tag === 'link') el.rel = 'stylesheet';
    document.head.appendChild(el);
  }
  return el;
}

export function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement.style;
  for (const [key, cssVar] of Object.entries(COLOR_VARS)) {
    if (theme.colors?.[key]) root.setProperty(cssVar, theme.colors[key]);
  }
  for (const [key, [cssVar, fallback]] of Object.entries(FONT_VARS)) {
    if (theme.fonts?.[key]) root.setProperty(cssVar, `${cssFontName(theme.fonts[key])}, ${fallback}`);
  }

  const href = googleFontsHref(theme);
  if (href) {
    const link = ensure('link', FONTS_LINK_ID);
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  } else {
    document.getElementById(FONTS_LINK_ID)?.remove();
  }
  ensure('style', FACES_ID).textContent = fontFaces(theme);
}
