import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import saved from './site.json';
import { applyTheme } from './theme.js';
import { DEFAULT_LANG, detectLang, isLang, localize, makeT } from './i18n.js';

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
    if (remember) {
      try {
        localStorage.setItem('lang', code);
      } catch {
        /* storage blocked */
      }
    }
  }, []);

  // In dev, the admin panel shows this site in an iframe and sends unsaved edits (and the language being edited).
  useEffect(() => {
    if (!import.meta.env.DEV || window.parent === window) return;
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.data?.type !== PREVIEW_MESSAGE) return;
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
