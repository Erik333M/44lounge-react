import { createContext, useContext, useEffect, useState } from 'react';
import saved from './site.json';
import { applyTheme } from './theme.js';

// All editable texts, images, colors and fonts live in src/content/site.json (edited at /admin in dev).
const ContentContext = createContext(saved);

export const PREVIEW_MESSAGE = '44admin:preview';
export const READY_MESSAGE = '44admin:ready';

export function ContentProvider({ children }) {
  const [content, setContent] = useState(saved);

  // In dev, the admin panel shows this site in an iframe and sends unsaved edits for live preview.
  useEffect(() => {
    if (!import.meta.env.DEV || window.parent === window) return;
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.data?.type !== PREVIEW_MESSAGE) return;
      setContent(e.data.content);
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: READY_MESSAGE }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => applyTheme(content.theme), [content.theme]);

  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export const useContent = () => useContext(ContentContext);
