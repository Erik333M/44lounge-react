// Generic editor: renders any part of site.json as form fields.
// Strings -> text inputs, image keys -> image pickers, arrays -> reorderable lists, objects -> groups.

import { useEffect, useRef, useState } from 'react';
import { asset } from '../asset.js';
import { listImages, uploadFile } from './api.js';

const LABELS = {
  brand: 'Name',
  tagline: 'Tagline',
  nav: 'Navigation labels',
  reserveLabel: 'Booking button',
  mapLink: 'Directions link',
  coordinates: 'Coordinates line',
  instagramHandle: 'Instagram name',
  open: 'Opens at',
  close: 'Closes at',
  openNow: 'Text when open',
  closedNow: 'Text when closed',
  hero: 'Hero (first screen)',
  eyebrow: 'Small line',
  scrollHint: 'Scroll hint',
  intro: 'Intro sentence',
  marquee: 'Moving words',
  rows: 'Rows (separate words with ·)',
  statement: 'Big statement',
  worlds: 'Three menus block',
  dishes: 'Popular dishes',
  gallery: 'Photo strip',
  link: 'Link',
  bigText: 'Giant word',
  line: 'Short line',
  ctaTitle: 'Big call to action',
  copyright: 'Copyright ({year} = current year)',
  mapUrl: 'Google Maps embed URL',
  label: 'Tab name',
  categories: 'Categories',
  items: 'Items',
  photos: 'Photos',
  images: 'Images',
  paragraphs: 'Paragraphs',
  lines: 'Lines',
  video: 'Smoke video (inside the 44)',
  image: 'Photo',
  name: 'Name',
  description: 'Description',
  price: 'Price',
  title: 'Title',
  text: 'Text',
  heading: 'Heading',
  headings: 'Column titles',
  addressLabel: 'Address label',
  bookLabel: 'Booking label',
  // buttons
  seeMenu: 'See the menu',
  fullKitchenMenu: 'Full kitchen menu',
  directions: 'Directions (long)',
  directionsShort: 'Directions (short, footer)',
  call: 'Call (before the phone number, mobile menu)',
  callNow: 'Call now',
  bookOnline: 'Book online',
  backToTop: 'Back to top',
  // booking form
  choose: 'Time placeholder',
  noTimes: 'When no times are left today',
  submit: 'Send button',
  sending: 'While sending',
  note: 'Small line under the button',
  chooseTimeError: 'Error: no time chosen',
  sendError: 'Error: could not send',
  sentLabel: 'After sending: small line',
  sentTitle: 'After sending: title',
  tableFor: 'After sending: table line',
  sentText: 'After sending: text',
  done: 'Done button',
  button: 'Button',
};

const HINTS = {
  mapUrl: 'Google Maps → Share → Embed a map → copy the src="…" link.',
  open: '24-hour time, e.g. 12:00. Used for the live "Open now" status (Yerevan time).',
  close: 'Can be after midnight, e.g. 04:00.',
  rows: 'Example: Hookah · Cocktails · Kitchen',
  price: 'Leave empty for items without a price (they show as tags).',
  video: 'MP4 file. It plays inside each 4 on the first screen (the second 4 starts 5 seconds later).',
  link: 'A page of this site, e.g. /menu/kitchen',
  note: '{open} and {close} are replaced with the opening hours.',
  sentTitle: '{name} is replaced with the guest’s first name.',
  tableFor: '{guests} is replaced with the number of guests.',
  sentText: '{phone} is replaced with the lounge phone number.',
  call: 'The phone number is added after this word.',
};

const HIDDEN = new Set([]); // keys never shown as fields
const IMAGE_KEYS = new Set(['image']);
const VIDEO_KEYS = new Set(['video']);
const IMAGE_LISTS = new Set(['images', 'photos']);
const FIXED_LISTS = new Set([]); // lists whose length is tied to the layout

const humanize = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
// labels that depend on where the key sits
const PATH_LABELS = { 'hours.label': 'Days line (e.g. Open daily)', 'general.nav': 'Menu bar links' };
export const labelFor = (k, path) => (path && PATH_LABELS[path.join('.')]) ?? LABELS[k] ?? humanize(k);

const stripHtml = (s) => String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Short title for a list item (first meaningful text inside it).
function summary(v) {
  if (typeof v === 'string') return stripHtml(v);
  if (Array.isArray(v)) return v.map(summary).filter(Boolean).slice(0, 3).join(', ');
  if (v && typeof v === 'object') {
    for (const k of ['name', 'n', 'title', 'label', 'html']) if (v[k]) return stripHtml(v[k]);
    for (const [k, x] of Object.entries(v)) if (!HIDDEN.has(k) && !IMAGE_KEYS.has(k) && summary(x)) return summary(x);
  }
  return '';
}

// New list item = copy of an existing one with the texts emptied (structure keys are kept).
function blank(v) {
  if (typeof v === 'string') return '';
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return 0;
  if (Array.isArray(v)) return v.length ? [blank(v[0])] : [];
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, HIDDEN.has(k) ? x : blank(x)]));
  }
  return '';
}

const isHtml = () => false;

export function Field({ k, parentKey, value, path, onChange }) {
  if (typeof value === 'boolean') {
    return (
      <label className="adm-check">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        {labelFor(k)}
      </label>
    );
  }
  if (Array.isArray(value)) {
    return <ListEditor k={k} value={value} path={path} onChange={onChange} />;
  }
  if (value && typeof value === 'object') {
    return (
      <fieldset className="adm-group">
        <legend>{labelFor(k, path)}</legend>
        <ObjectEditor value={value} path={path} onChange={onChange} />
      </fieldset>
    );
  }
  const video = VIDEO_KEYS.has(k);
  const image = IMAGE_KEYS.has(k) || IMAGE_LISTS.has(parentKey);
  const inList = typeof k === 'number';
  return (
    <div className="adm-field">
      {!inList && <label className="adm-label">{labelFor(k, path)}</label>}
      {video ? (
        <ImageField value={value} onChange={onChange} video />
      ) : image ? (
        <ImageField value={value} onChange={onChange} />
      ) : (
        <TextField value={value ?? ''} html={isHtml(k, parentKey, path)} onChange={onChange} />
      )}
      {HINTS[k] && <p className="adm-hint">{HINTS[k]}</p>}
    </div>
  );
}

export function ObjectEditor({ value, path, onChange }) {
  return (
    <div className="adm-object">
      {Object.entries(value)
        .filter(([k]) => !HIDDEN.has(k))
        .map(([k, v]) => (
          <Field
            key={k}
            k={k}
            value={v}
            path={[...path, k]}
            onChange={(nv) => onChange({ ...value, [k]: nv })}
          />
        ))}
    </div>
  );
}

function TextField({ value, html, onChange }) {
  const multiline = html || value.length > 60 || value.includes('\n');
  return (
    <>
      {multiline ? (
        <textarea
          className="adm-input"
          rows={Math.min(8, Math.max(2, Math.ceil(value.length / 60)))}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className="adm-input" type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {html && <p className="adm-hint">HTML allowed, e.g. &lt;br&gt; for a line break.</p>}
    </>
  );
}

function ListEditor({ k, value, path, onChange }) {
  const fixed = FIXED_LISTS.has(k);
  const isObjects = value.some((v) => v && typeof v === 'object');
  const set = (i, nv) => onChange(value.map((x, j) => (j === i ? nv : x)));
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const remove = (i) => onChange(value.filter((_, j) => j !== i));
  const add = () => onChange([...value, value.length ? blank(value[value.length - 1]) : '']);

  const controls = (i) =>
    !fixed && (
      <span className="adm-item-tools">
        <button type="button" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
        <button type="button" title="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓</button>
        <button type="button" title="Remove" className="danger" onClick={() => remove(i)}>✕</button>
      </span>
    );

  return (
    <fieldset className="adm-group adm-list">
      <legend>
        {labelFor(k)} <span className="adm-count">{value.length}</span>
      </legend>
      {fixed && <p className="adm-hint">The number of items is fixed by the page layout and animation.</p>}
      {value.map((item, i) =>
        isObjects || Array.isArray(item) ? (
          <details className="adm-item" key={i} open={value.length <= 3}>
            <summary>
              <span className="adm-item-title">
                {Array.isArray(item) ? `${labelFor(k).replace(/s$/, '')} ${i + 1}` : summary(item) || `Item ${i + 1}`}
              </span>
              {controls(i)}
            </summary>
            <div className="adm-item-body">
              {Array.isArray(item) ? (
                <ListEditor k="items" value={item} path={[...path, i]} onChange={(nv) => set(i, nv)} />
              ) : (
                <ObjectEditor value={item} path={[...path, i]} onChange={(nv) => set(i, nv)} />
              )}
            </div>
          </details>
        ) : (
          <div className="adm-row" key={i}>
            <div className="adm-row-main">
              <Field k={i} parentKey={k} value={item} path={[...path, i]} onChange={(nv) => set(i, nv)} />
            </div>
            {controls(i)}
          </div>
        )
      )}
      {!fixed && (
        <button type="button" className="adm-add" onClick={add}>
          + Add
        </button>
      )}
    </fieldset>
  );
}

// ---- images ----

export function ImageField({ value, onChange, video = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [library, setLibrary] = useState(false);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await uploadFile(file));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="adm-image"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        upload(e.dataTransfer.files[0]);
      }}
    >
      <div className="adm-thumb">
        {value ? (
          video ? <video src={asset(value)} muted loop autoPlay playsInline /> : <img src={asset(value)} alt="" />
        ) : (
          <span>None</span>
        )}
      </div>
      <div className="adm-image-side">
        <input
          className="adm-input"
          type="text"
          value={value}
          placeholder="None"
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="adm-image-buttons">
          <button type="button" disabled={busy} onClick={() => fileRef.current.click()}>
            {busy ? 'Uploading…' : 'Upload'}
          </button>
          {!video && (
            <button type="button" onClick={() => setLibrary(true)}>Library</button>
          )}
          {value && (
            <button type="button" onClick={() => onChange('')}>Clear</button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={video ? 'video/mp4,video/webm' : 'image/*'}
            style={{ display: "none" }}
            onChange={(e) => {
              upload(e.target.files[0]);
              e.target.value = '';
            }}
          />
        </div>
        {error && <p className="adm-error">{error}</p>}
      </div>
      {library && (
        <ImageLibrary
          current={value}
          onPick={(p) => {
            onChange(p);
            setLibrary(false);
          }}
          onClose={() => setLibrary(false)}
        />
      )}
    </div>
  );
}

function ImageLibrary({ current, onPick, onClose }) {
  const [images, setImages] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    listImages().then(setImages, (e) => setError(e.message));
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shown = (images || []).filter((p) => p.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="adm-modal" onClick={onClose}>
      <div className="adm-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal-head">
          <input className="adm-input" autoFocus placeholder="Search images…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" onClick={onClose}>Close</button>
        </div>
        {error && <p className="adm-error">{error}</p>}
        {!images && !error && <p className="adm-hint">Loading…</p>}
        <div className="adm-grid">
          {shown.map((p) => (
            <button type="button" key={p} className={`adm-tile${p === current ? ' current' : ''}`} onClick={() => onPick(p)} title={p}>
              <img src={asset(p)} alt="" loading="lazy" />
              <span>{p.split('/').pop()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
