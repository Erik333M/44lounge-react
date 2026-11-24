import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import saved from './site.json';
import { applyTheme } from './theme.js';
import { DEFAULT_LANG, detectLang, isLang, localize, makeT, rememberLang } from './i18n.js';

// All editable texts, images, colors and fonts live in src/content/site.json (edited at /admin in dev).
// Pages read the content already translated into the visitor's language.
const ContentContext = createContext(saved);
const LanguageContext = createContext({ lang: DEFAULT_LANG, setLang: () => {}, t: makeT(saved, DEFAULT_LANG) });

export const PREVIEW_MESSAGE = '44admin:preview';
export const READY_MESSAGE = '44admin:ready';

export function ContentProvider({ children }) {
  const [raw, setRaw] = useState(saved);
  const [lang, setLangState] = useState(detectLang);

  const setLang = useCallback((code, { remember = true } = {}) => {
    if (!isLang(code)) return;
    setLangState(code);
    if (remember) rememberLang(code);
  }, []);

  // The admin shows this site in a frame and sends unsaved edits (and the language being edited).
  // Only a page of this same site can send them (the origin check), so visitors can't be shown anything else.
  useEffect(() => {
    if (window.parent === window) return;
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.source !== window.parent || e.data?.type !== PREVIEW_MESSAGE) return;
      if (e.data.assets) window.__previewAssets = e.data.assets; // uploads not published yet
      setRaw(e.data.content);
      if (e.data.lang) setLang(e.data.lang, { remember: false });
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: READY_MESSAGE }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [setLang]);

  useEffect(() => applyTheme(raw.theme), [raw.theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const content = useMemo(() => localize(raw, lang), [raw, lang]);
  const language = useMemo(() => ({ lang, setLang, t: makeT(raw, lang) }), [raw, lang, setLang]);

  return (
    <LanguageContext.Provider value={language}>
      <ContentContext.Provider value={content}>{children}</ContentContext.Provider>
    </LanguageContext.Provider>
  );
}

export const useContent = () => useContext(ContentContext);
export const useLanguage = () => useContext(LanguageContext);
