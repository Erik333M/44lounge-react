// Admin panel (only in `npm run dev`, at /admin).
// Edits src/content/site.json: texts, images, colors and fonts. Animations are not editable.

import { useCallback, useEffect, useRef, useState } from 'react';
import saved from '../content/site.json';
import { PREVIEW_MESSAGE, READY_MESSAGE } from '../content/ContentContext.jsx';
import { fontFaces, googleFontsHref } from '../content/theme.js';
import { saveContent } from './api.js';
import { ObjectEditor } from './fields.jsx';
import { ColorsEditor, FontsEditor } from './theme-editors.jsx';
import { TranslationsEditor } from './translations-editor.jsx';
import './admin.css';

const SECTIONS = [
  { id: 'colors', group: 'Design', label: 'Colors', page: '/' },
  { id: 'fonts', group: 'Design', label: 'Fonts', page: '/' },
  { id: 'general', group: 'Whole site', label: 'Name & contacts', path: ['general'], page: '/visit' },
  { id: 'hours', group: 'Whole site', label: 'Opening hours', path: ['hours'], page: '/' },
  { id: 'buttons', group: 'Whole site', label: 'Buttons', path: ['buttons'], page: '/visit' },
  { id: 'booking', group: 'Whole site', label: 'Booking form', path: ['booking'], page: '/visit' },
  { id: 'footer', group: 'Whole site', label: 'Footer', path: ['footer'], page: '/' },
  { id: 'home', group: 'Pages', label: 'Home', path: ['home'], page: '/' },
  { id: 'about', group: 'Pages', label: 'About', path: ['about'], page: '/about' },
  { id: 'visit', group: 'Pages', label: 'Visit', path: ['visit'], page: '/visit' },
  { id: 'notFound', group: 'Pages', label: 'Page not found', path: ['notFound'], page: '/this-page-does-not-exist' },
  { id: 'menuPage', group: 'Menu', label: 'Menu page', path: ['menu'], only: ['title', 'intro'], page: '/menu/hookah' },
  { id: 'hookah', group: 'Menu', label: 'Hookah', path: ['menu', 'hookah'], page: '/menu/hookah' },
  { id: 'kitchen', group: 'Menu', label: 'Kitchen', path: ['menu', 'kitchen'], page: '/menu/kitchen' },
  { id: 'bar', group: 'Menu', label: 'Bar', path: ['menu', 'bar'], page: '/menu/bar' },
  { id: 'lang-hy', group: 'Languages', label: 'Հայերեն · Armenian', lang: 'hy', page: '/' },
  { id: 'lang-ru', group: 'Languages', label: 'Русский · Russian', lang: 'ru', page: '/' },
];

const PAGES = [
  ['/', 'Home'],
  ['/menu/hookah', 'Menu · Hookah'],
  ['/menu/kitchen', 'Menu · Kitchen'],
  ['/menu/bar', 'Menu · Bar'],
  ['/about', 'About'],
  ['/visit', 'Visit'],
  ['/this-page-does-not-exist', 'Page not found'],
];

const getIn = (obj, path) => path.reduce((o, k) => o?.[k], obj);
const setIn = (obj, [k, ...rest], value) => (rest.length ? { ...obj, [k]: setIn(obj[k], rest, value) } : { ...obj, [k]: value });

const SAVED_FLAG = 'adm-just-saved';

export default function Admin() {
  const [draft, setDraft] = useState(saved);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(saved));
  const [section, setSection] = useState(() => {
    const saved = sessionStorage.getItem('adm-section');
    return SECTIONS.some((s) => s.id === saved) ? saved : 'colors';
  });
  const [page, setPage] = useState('/');
  const [frameKey, setFrameKey] = useState(0);
  const [device, setDevice] = useState('desktop');
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }
  const [saving, setSaving] = useState(false);
  const frameRef = useRef(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const langRef = useRef('en');

  const dirty = JSON.stringify(draft) !== savedJson;
  const current = SECTIONS.find((s) => s.id === section) || SECTIONS[0];
  langRef.current = current.lang || 'en'; // the preview shows the language being edited

  useEffect(() => {
    document.title = 'Admin · 44Lounge';
    try {
      if (sessionStorage.getItem(SAVED_FLAG)) {
        sessionStorage.removeItem(SAVED_FLAG);
        setStatus({ type: 'ok', text: 'Saved' });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('adm-section', section);
    } catch {
      /* ignore */
    }
  }, [section]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 3500);
    return () => clearTimeout(t);
  }, [status]);

  // ---- live preview ----
  const sendPreview = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: PREVIEW_MESSAGE, content: draftRef.current, lang: langRef.current },
      window.location.origin
    );
  }, []);

  useEffect(() => {
    const t = setTimeout(sendPreview, 300);
    return () => clearTimeout(t);
  }, [draft, section, sendPreview]);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin === window.location.origin && e.data?.type === READY_MESSAGE) sendPreview();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [sendPreview]);

  // ---- save ----
  const save = useCallback(async () => {
    setSaving(true);
    try {
      sessionStorage.setItem(SAVED_FLAG, '1'); // the dev server may reload this page after the file changes
    } catch {
      /* ignore */
    }
    try {
      await saveContent(draftRef.current);
      setSavedJson(JSON.stringify(draftRef.current));
      setStatus({ type: 'ok', text: 'Saved' });
    } catch (e) {
      try {
        sessionStorage.removeItem(SAVED_FLAG);
      } catch {
        /* ignore */
      }
      setStatus({ type: 'error', text: `Not saved: ${e.message}` });
    } finally {
      setSaving(false);
    }
  }, []);

  const discard = () => {
    if (window.confirm('Discard all unsaved changes?')) setDraft(JSON.parse(savedJson));
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const openSection = (s) => {
    setSection(s.id);
    setPage(s.page);
  };

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const fontsHref = googleFontsHref(draft.theme, { includePreloaded: true });

  let groups = [];
  for (const s of SECTIONS) {
    const g = groups.find((x) => x.name === s.group);
    g ? g.items.push(s) : groups.push({ name: s.group, items: [s] });
  }

  return (
    <div className="adm">
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}
      <style>{fontFaces(draft.theme)}</style>

      <aside className="adm-nav">
        <div className="adm-logo">
          44Lounge <span>admin</span>
        </div>
        {groups.map((g) => (
          <div key={g.name} className="adm-nav-group">
            <p>{g.name}</p>
            {g.items.map((s) => (
              <button key={s.id} type="button" className={s.id === section ? 'active' : ''} onClick={() => openSection(s)}>
                {s.label}
              </button>
            ))}
          </div>
        ))}
        <p className="adm-nav-foot">
          Changes are saved to <code>src/content/site.json</code>. Older versions are kept in <code>content-backups/</code>.
        </p>
      </aside>

      <main className="adm-main">
        <header className="adm-bar">
          <h1>{current.label}</h1>
          <div className="adm-bar-actions">
            {status && <span className={`adm-status ${status.type}`}>{status.text}</span>}
            {dirty && !status && <span className="adm-status dirty">Unsaved changes</span>}
            <button type="button" disabled={!dirty || saving} onClick={discard}>
              Discard
            </button>
            <button type="button" className="primary" disabled={!dirty || saving} onClick={save} title="⌘S">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </header>

        <div className="adm-editor" key={section}>
          {section === 'colors' && (
            <ColorsEditor colors={draft.theme.colors} onChange={(colors) => set('theme', { ...draft.theme, colors })} />
          )}
          {section === 'fonts' && <FontsEditor theme={draft.theme} onChange={(theme) => set('theme', theme)} />}
          {current.lang && (
            <TranslationsEditor content={draft} lang={current.lang} onChange={(translations) => set('translations', translations)} />
          )}
          {current.path && (
            <ObjectEditor
              value={
                current.only
                  ? Object.fromEntries(current.only.map((k) => [k, getIn(draft, current.path)[k]]))
                  : getIn(draft, current.path)
              }
              path={current.path}
              onChange={(v) =>
                setDraft((d) => setIn(d, current.path, current.only ? { ...getIn(d, current.path), ...v } : v))
              }
            />
          )}
        </div>
      </main>

      <section className="adm-preview">
        <div className="adm-preview-bar">
          <select value={page} onChange={(e) => setPage(e.target.value)}>
            {PAGES.map(([p, l]) => (
              <option key={p} value={p}>
                {l}
              </option>
            ))}
          </select>
          <div className="adm-seg">
            <button type="button" className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')}>
              Desktop
            </button>
            <button type="button" className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}>
              Mobile
            </button>
          </div>
          <button type="button" title="Reload preview" onClick={() => setFrameKey((k) => k + 1)}>
            ↻
          </button>
          <a href={page} target="_blank" rel="noreferrer" title="Open the saved page in a new tab">
            ↗
          </a>
        </div>
        <div className={`adm-frame-wrap ${device}`}>
          <iframe key={`${page}-${frameKey}`} ref={frameRef} src={page} title="Preview" />
        </div>
        <p className="adm-preview-note">Preview shows unsaved changes. The live site updates after you save.</p>
      </section>
    </div>
  );
}
