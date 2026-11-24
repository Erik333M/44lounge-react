// Languages: English is written in site.json; Armenian and Russian are dictionaries keyed by the English text
// (site.json → translations.hy / translations.ru). A text without a translation falls back to English, and
// translations stay attached when menu items are added or reordered, because they follow the text, not the position.

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English', locale: 'en-GB' },
  { code: 'hy', label: 'ՀԱՅ', name: 'Հայերեն', locale: 'hy-AM' },
  { code: 'ru', label: 'РУ', name: 'Русский', locale: 'ru-RU' },
];
export const DEFAULT_LANG = 'en';
export const isLang = (code) => LANGUAGES.some((l) => l.code === code);
export const localeOf = (code) => (LANGUAGES.find((l) => l.code === code) || LANGUAGES[0]).locale;

// Keys whose values are never translated (paths, links, numbers, prices, times, brand handles).
// Texts without letters (phone numbers, times) are left alone anyway.
export const NOT_TRANSLATED = new Set([
  'theme', 'translations', 'image', 'images', 'photos', 'video', 'link', 'mapUrl', 'mapLink',
  'instagram', 'facebook', 'instagramHandle', 'coordinates', 'open', 'close', 'price', 'count', 'customFonts', 'file',
]);

// Texts written in the code (screen-reader labels, small words, messages from the booking server).
// They are translated through the same dictionaries and listed in the admin's Translations page.
export const UI_STRINGS = [
  'Yerevan',
  'items',
  'lines',
  'Menu categories',
  'Previous category',
  'Next category',
  'Previous dish',
  'Next dish',
  'Close',
  'Menu sections',
  'Open menu',
  'Close menu',
  'Main',
  'Language',
  'Fewer guests',
  'More guests',
  'AMD',
  'Invalid request',
  'Please enter your name.',
  'Please enter a valid phone number.',
  'Please choose the number of guests.',
  'Please choose a date.',
  'Please choose a time.',
  'Too many requests. Please call us to book.',
  'Online booking is not set up yet. Please call us to book.',
];

const hasLetters = (s) => /\p{L}/u.test(s);

// Every English text a translator may need: site content first, then the code's own texts.
export function collectStrings(content) {
  const seen = new Set();
  const walk = (v, key) => {
    if (key && NOT_TRANSLATED.has(key)) return;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s && hasLetters(s)) seen.add(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(content);
  UI_STRINGS.forEach((s) => seen.add(s));
  return [...seen];
}

// Content with every text swapped for its translation (English when there is none).
export function localize(content, lang) {
  if (!content || lang === DEFAULT_LANG) return content;
  const dict = content.translations?.[lang] || {};
  const tr = (s) => (typeof s === 'string' && dict[s]?.trim() ? dict[s] : s);
  const currency = tr('AMD');
  const walk = (v, key) => {
    if (key === 'price' && typeof v === 'string') return v.replace(/\bAMD\b/g, currency);
    if (key && NOT_TRANSLATED.has(key)) return v;
    if (typeof v === 'string') return tr(v);
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  return walk(content);
}

// {placeholders} in texts
export const fill = (text, vars = {}) => String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

// Translator for the code's own texts. Plural words may hold several forms separated by "|"
// (Russian: one|few|many, e.g. "позиция|позиции|позиций").
export function makeT(content, lang) {
  const dict = lang === DEFAULT_LANG ? {} : content?.translations?.[lang] || {};
  const t = (s, vars) => fill(dict[s]?.trim() ? dict[s] : s, vars);
  const rules = new Intl.PluralRules(localeOf(lang));
  // `other` is the dictionary key: its translation holds the forms, e.g. "позиция|позиции|позиций"
  t.plural = (n, one, other) => {
    const raw = dict[other]?.trim();
    if (!raw) return n === 1 ? one : other;
    const forms = raw.split('|').map((f) => f.trim());
    if (forms.length === 1) return forms[0]; // Armenian: one form after any number
    const cat = rules.select(n);
    return cat === 'one' ? forms[0] : cat === 'few' ? forms[1] || forms[0] : forms[2] || forms[forms.length - 1];
  };
  return t;
}

// English is always the starting language: a first visit, or opening the site from a link, shows English.
// A language the visitor picks lasts for that browser tab (reloads and page changes keep it).
const LANG_KEY = 'lang';

export function detectLang() {
  try {
    const picked = sessionStorage.getItem(LANG_KEY);
    if (isLang(picked)) return picked;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_LANG;
}

export function rememberLang(code) {
  try {
    sessionStorage.setItem(LANG_KEY, code);
  } catch {
    /* storage blocked */
  }
}
