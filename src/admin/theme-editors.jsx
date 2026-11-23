// Colors and fonts editors.

import { useRef, useState } from 'react';
import { SYSTEM_FONTS } from '../content/theme.js';
import { uploadFile } from './api.js';

// The template's original values, for the "Reset" buttons.
export const ORIGINAL_THEME = {
  colors: { background: '#0e0c0b', surface: '#1a1614', text: '#f2eadf', muted: '#9d9189', accent: '#fa3601', brass: '#c7ad88' },
  fonts: { display: 'Unbounded', body: 'Manrope', mono: 'JetBrains Mono' },
};

const COLORS = [
  ['accent', 'Accent', 'Neon color: buttons, the 44, hours band, highlights'],
  ['background', 'Background', 'Page background'],
  ['surface', 'Surface', 'Behind images while they load, map frame'],
  ['text', 'Text', 'Headings and main text'],
  ['muted', 'Muted text', 'Descriptions and small labels'],
  ['brass', 'Prices', 'Menu prices'],
];

const FONTS = [
  ['display', 'Headings', 'Big titles, menu names, the 44'],
  ['body', 'Text', 'Paragraphs and menu items'],
  ['mono', 'Labels', 'Small uppercase labels, buttons, prices'],
];

export const GOOGLE_FONTS = [
  'Unbounded', 'JetBrains Mono', 'Syne', 'Space Grotesk', 'Space Mono', 'Poppins', 'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Raleway', 'Inter', 'Rubik',
  'Manrope', 'Nunito', 'Josefin Sans', 'Oswald', 'Bebas Neue', 'Playfair Display', 'Lora', 'Cormorant Garamond',
  'Cinzel', 'Libre Baskerville', 'Great Vibes', 'Dancing Script', 'Pacifico', 'Noto Sans Armenian', 'Noto Serif Armenian',
];

const SAMPLE = '44 Lounge — Hookah & Bar  Աբգ  Абв  1234';

function hexOk(v) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}
const full = (v) => (v.length === 4 ? '#' + v.slice(1).split('').map((c) => c + c).join('') : v);

export function ColorsEditor({ colors, onChange }) {
  const set = (k, v) => onChange({ ...colors, [k]: v });
  return (
    <div className="adm-object">
      <p className="adm-hint">
        Each color is used everywhere on the site. Animations are not affected.
      </p>
      {COLORS.map(([k, label, hint]) => {
        const v = colors[k] ?? ORIGINAL_THEME.colors[k];
        return (
          <div className="adm-color" key={k}>
            <input type="color" value={hexOk(v) ? full(v) : '#000000'} onChange={(e) => set(k, e.target.value)} />
            <div className="adm-color-text">
              <label className="adm-label">{label}</label>
              <p className="adm-hint">{hint}</p>
            </div>
            <input className={`adm-input adm-hex${hexOk(v) ? '' : ' invalid'}`} value={v} onChange={(e) => set(k, e.target.value.trim())} />
            <button
              type="button"
              disabled={v.toLowerCase() === ORIGINAL_THEME.colors[k]}
              onClick={() => set(k, ORIGINAL_THEME.colors[k])}
            >
              Reset
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function FontsEditor({ theme, onChange }) {
  const fonts = theme.fonts;
  const custom = theme.customFonts || [];
  const setFont = (k, v) => onChange({ ...theme, fonts: { ...fonts, [k]: v } });
  const setCustom = (list) => onChange({ ...theme, customFonts: list });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const path = await uploadFile(file);
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      setCustom([...custom, { name, file: path }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-object">
      <p className="adm-hint">
        Type any <a href="https://fonts.google.com" target="_blank" rel="noreferrer">Google Fonts</a> name, pick one from
        the list, or upload your own font file below.
      </p>
      <datalist id="adm-font-list">
        {[...new Set([...custom.map((f) => f.name), ...GOOGLE_FONTS, ...SYSTEM_FONTS])].map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      {FONTS.map(([k, label, hint]) => (
        <div className="adm-font" key={k}>
          <div className="adm-font-head">
            <div>
              <label className="adm-label">{label}</label>
              <p className="adm-hint">{hint}</p>
            </div>
            <input className="adm-input" list="adm-font-list" value={fonts[k] ?? ''} onChange={(e) => setFont(k, e.target.value)} />
            <button type="button" disabled={fonts[k] === ORIGINAL_THEME.fonts[k]} onClick={() => setFont(k, ORIGINAL_THEME.fonts[k])}>
              Reset
            </button>
          </div>
          <p className="adm-sample" style={{ fontFamily: `"${fonts[k]}", sans-serif` }}>
            {SAMPLE}
          </p>
        </div>
      ))}

      <fieldset className="adm-group">
        <legend>Uploaded fonts</legend>
        <p className="adm-hint">.woff2, .woff, .ttf or .otf. After uploading, type its name in one of the fields above.</p>
        {custom.map((f, i) => (
          <div className="adm-row" key={i}>
            <div className="adm-row-main adm-custom-font">
              <input
                className="adm-input"
                value={f.name}
                onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <code>{f.file}</code>
            </div>
            <span className="adm-item-tools">
              <button type="button" className="danger" title="Remove" onClick={() => setCustom(custom.filter((_, j) => j !== i))}>
                ✕
              </button>
            </span>
          </div>
        ))}
        <button type="button" className="adm-add" disabled={busy} onClick={() => fileRef.current.click()}>
          {busy ? 'Uploading…' : '+ Upload font'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".woff2,.woff,.ttf,.otf"
          style={{ display: "none" }}
          onChange={(e) => {
            upload(e.target.files[0]);
            e.target.value = '';
          }}
        />
        {error && <p className="adm-error">{error}</p>}
      </fieldset>
    </div>
  );
}
