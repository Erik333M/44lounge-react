// Translations: every English text of the site next to its Armenian or Russian version.
// An empty field means the English text is shown in that language.

import { useMemo, useState } from 'react';
import { collectStrings, UI_STRINGS } from '../content/i18n.js';

const PLURAL_HINT = {
  ru: 'Russian plural: three forms separated by | — one | few | many, e.g. позиция|позиции|позиций',
  hy: 'One form is enough in Armenian.',
};
const PLURAL_WORDS = new Set(['items', 'lines']);
const SITE_TEXT = 'Site text';
const CODE_TEXT = 'Labels and messages';

export function TranslationsEditor({ content, lang, onChange }) {
  const [q, setQ] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const dict = content.translations?.[lang] || {};
  const strings = useMemo(() => collectStrings(content), [content]);
  const ui = useMemo(() => new Set(UI_STRINGS), []);

  const done = strings.filter((s) => dict[s]?.trim()).length;
  const needle = q.trim().toLowerCase();
  const shown = strings.filter((s) => {
    if (missingOnly && dict[s]?.trim()) return false;
    if (!needle) return true;
    return s.toLowerCase().includes(needle) || String(dict[s] || '').toLowerCase().includes(needle);
  });

  const set = (en, value) => {
    const next = { ...dict, [en]: value };
    if (!value.trim()) delete next[en];
    onChange({ ...(content.translations || {}), [lang]: next });
  };

  let lastGroup = null;
  return (
    <div className="adm-object adm-tr">
      <p className="adm-hint">
        Leave a field empty to show the English text (good for brand names such as Jameson or Al Fakher). Keep words in{' '}
        <code>{'{curly braces}'}</code> as they are; they are replaced with the name, time, phone and so on. If you change an English text in another section, translate it
        again here.
      </p>
      <div className="adm-tr-bar">
        <input className="adm-input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="adm-check">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          Missing only
        </label>
        <span className="adm-tr-progress">
          {done} / {strings.length} translated
        </span>
      </div>

      {shown.map((en) => {
        const group = ui.has(en) ? CODE_TEXT : SITE_TEXT;
        const header = group !== lastGroup ? group : null;
        lastGroup = group;
        return (
          <div key={en}>
            {header && <p className="adm-tr-group">{header}</p>}
            <div className={`adm-tr-row${dict[en]?.trim() ? '' : ' is-missing'}`}>
              <p className="adm-tr-en" lang="en">
                {en}
              </p>
              <textarea
                className="adm-input"
                lang={lang}
                rows={en.length > 70 ? 3 : 1}
                value={dict[en] || ''}
                placeholder={en}
                onChange={(e) => set(en, e.target.value)}
              />
              {PLURAL_WORDS.has(en) && <p className="adm-hint">{PLURAL_HINT[lang]}</p>}
            </div>
          </div>
        );
      })}
      {!shown.length && <p className="adm-hint">Nothing found.</p>}
    </div>
  );
}
