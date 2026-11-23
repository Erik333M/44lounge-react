import { Fragment, useEffect, useState } from 'react';
import { asset } from '../asset.js';
import { useContent } from '../content/ContentContext.jsx';

// Heading text split into words, each inside a mask, for the "rise" entrance.
export function Split({ text, as: Tag = 'span', className = '', ...rest }) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  return (
    <Tag className={`split ${className}`} aria-label={text} {...rest}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="w" aria-hidden="true">
            <span>{w}</span>
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </Tag>
  );
}

export const Img = ({ src, alt = '', ...rest }) => (src ? <img src={asset(src)} alt={alt} loading="lazy" decoding="async" {...rest} /> : null);

export const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const Star = (props) => (
  <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M50 0 L57 38 L95 22 L62 50 L95 78 L57 62 L50 100 L43 62 L5 78 L38 50 L5 22 L43 38 Z" />
  </svg>
);

export const telHref = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;

// ---- opening hours (Yerevan time) ----

const YEREVAN = 'Asia/Yerevan';

function yerevanNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: YEREVAN,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { minutes: (get('hour') % 24) * 60 + get('minute'), text: `${String(get('hour') % 24).padStart(2, '0')}:${String(get('minute')).padStart(2, '0')}` };
}

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Open window may cross midnight (12:00 → 04:00).
export function isOpenAt(minutes, open, close) {
  const o = toMinutes(open);
  const c = toMinutes(close);
  if (o === c) return true;
  return o < c ? minutes >= o && minutes < c : minutes >= o || minutes < c;
}

export function useYerevanClock() {
  const [now, setNow] = useState(yerevanNow);
  useEffect(() => {
    const id = setInterval(() => setNow(yerevanNow()), 15000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function OpenStatus({ withTime = false }) {
  const { hours } = useContent();
  const now = useYerevanClock();
  const open = isOpenAt(now.minutes, hours.open, hours.close);
  return (
    <span className={`status${open ? ' is-open' : ''}`}>
      <span className="status__dot" />
      {open ? hours.openNow : hours.closedNow}
      {withTime && <span className="muted"> · Yerevan {now.text}</span>}
    </span>
  );
}
