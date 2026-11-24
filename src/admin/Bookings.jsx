// Table requests from the website's "Book a table" form.
// Shown as a section of the admin (npm run dev) and as the whole /admin page on the live site (password).
// New requests arrive as "pending": the page checks every 15 seconds, plays a short sound, shows a desktop
// notification (when allowed) and puts the pending count in the browser tab.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './admin.css';

const POLL_MS = 15000;
const PASS_KEY = 'adm-bookings-pass';
const FILTERS = [
  ['pending', 'Pending'],
  ['confirmed', 'Confirmed'],
  ['declined', 'Declined'],
  ['all', 'All'],
];

const readPass = () => {
  try {
    return sessionStorage.getItem(PASS_KEY) || '';
  } catch {
    return '';
  }
};
const writePass = (p) => {
  try {
    if (p) sessionStorage.setItem(PASS_KEY, p);
    else sessionStorage.removeItem(PASS_KEY);
  } catch {
    /* storage blocked */
  }
};

// short two-note chime, no sound file needed
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio not available */
  }
}

async function api(method, pass, body) {
  const res = await fetch('/api/bookings', {
    method,
    headers: { 'Content-Type': 'application/json', ...(pass ? { Authorization: `Bearer ${pass}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  // anything but JSON means the bookings service is missing (e.g. the site is hosted without the /api functions)
  if (!(res.headers.get('content-type') || '').includes('application/json')) {
    const err = new Error('The bookings service is not reachable.');
    err.status = 0;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Loads the requests and keeps them fresh. Shared by the admin (for the menu badge) and the Bookings page.
 * `onNew` is called with the requests that appeared since the last check.
 */
export function useBookings({ enabled = true } = {}) {
  const [pass, setPass] = useState(readPass);
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState(null); // { status, message }
  const known = useRef(null);
  const [fresh, setFresh] = useState([]);

  const load = useCallback(async () => {
    try {
      const data = await api('GET', pass);
      const list = data.bookings || [];
      if (known.current) {
        const added = list.filter((b) => !known.current.has(b.id) && b.status === 'pending');
        if (added.length) setFresh(added);
      }
      known.current = new Set(list.map((b) => b.id));
      setBookings(list);
      setError(null);
    } catch (e) {
      setError({ status: e.status || 0, message: e.message });
    }
  }, [pass]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const id = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, load]);

  // sound + desktop notification for new requests
  useEffect(() => {
    if (!fresh.length) return;
    chime();
    if ('Notification' in window && Notification.permission === 'granted') {
      const b = fresh[0];
      const more = fresh.length > 1 ? ` (+${fresh.length - 1} more)` : '';
      new Notification('New table request', {
        body: `${b.name} · ${b.guests} guests · ${b.date}${b.time ? ` ${b.time}` : ''}${more}`,
        tag: 'bookings',
      });
    }
  }, [fresh]);

  const update = useCallback(
    async (id, change) => {
      await api('POST', pass, { id, ...change });
      await load();
    },
    [pass, load]
  );

  const login = (p) => {
    writePass(p);
    known.current = null;
    setPass(p);
  };
  const logout = () => login('');

  const pending = bookings ? bookings.filter((b) => b.status === 'pending').length : 0;
  return { bookings, error, pending, update, reload: load, login, logout, hasPass: !!pass };
}

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
const fmtAgo = (iso) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function NotificationsButton() {
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  if (perm === 'unsupported' || perm === 'granted') return null;
  if (perm === 'denied') return <span className="adm-hint">Desktop notifications are blocked in this browser.</span>;
  return (
    <button type="button" onClick={() => Notification.requestPermission().then(setPerm)}>
      Turn on desktop notifications
    </button>
  );
}

function Login({ onLogin, error }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="adm-login"
      onSubmit={(e) => {
        e.preventDefault();
        onLogin(value);
      }}
    >
      <h2>Bookings</h2>
      <p className="adm-hint">Enter the staff password.</p>
      <input className="adm-input" type="password" autoComplete="current-password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
      {error && <p className="adm-error">{error}</p>}
      <button type="submit" className="primary" disabled={!value}>
        Open
      </button>
    </form>
  );
}

export function BookingsPanel({ state }) {
  const { bookings, error, update, reload, login, logout, hasPass } = state;
  const [filter, setFilter] = useState('pending');
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState('');

  const counts = useMemo(() => {
    const c = { pending: 0, confirmed: 0, declined: 0, all: bookings?.length || 0 };
    (bookings || []).forEach((b) => (c[b.status] = (c[b.status] || 0) + 1));
    return c;
  }, [bookings]);

  if (error?.status === 401 || error?.status === 429) {
    return <Login onLogin={login} error={hasPass ? error.message : ''} />;
  }

  const act = async (id, change) => {
    setBusy(id);
    setActionError('');
    try {
      await update(id, change);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(null);
    }
  };

  // pending: soonest table first; the rest: newest request first
  const shown = (bookings || [])
    .filter((b) => filter === 'all' || b.status === filter)
    .sort((a, b) =>
      filter === 'pending' ? `${a.date} ${a.time || '99'}`.localeCompare(`${b.date} ${b.time || '99'}`) : String(b.createdAt).localeCompare(String(a.createdAt))
    );

  return (
    <div className="adm-bookings">
      <div className="adm-bk-bar">
        <div className="adm-seg">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
              {label}
              {counts[id] ? <span className={`adm-bk-count${id === 'pending' ? ' is-hot' : ''}`}>{counts[id]}</span> : null}
            </button>
          ))}
        </div>
        <div className="adm-bk-tools">
          <NotificationsButton />
          <button type="button" onClick={reload} title="Check now">
            ↻
          </button>
          {hasPass && (
            <button type="button" onClick={logout}>
              Log out
            </button>
          )}
        </div>
      </div>

      {error && <p className="adm-error">{error.message}</p>}
      {actionError && <p className="adm-error">{actionError}</p>}
      {!bookings && !error && <p className="adm-hint">Loading…</p>}
      {bookings && !shown.length && (
        <p className="adm-bk-empty">{filter === 'pending' ? 'No pending requests. New ones appear here automatically.' : 'Nothing here yet.'}</p>
      )}

      <ul className="adm-bk-list">
        {shown.map((b) => (
          <li key={b.id} className={`adm-bk is-${b.status}`}>
            <div className="adm-bk-main">
              <p className="adm-bk-when">
                {fmtDate(b.date)} · {b.time || 'any time'}
              </p>
              <p className="adm-bk-name">
                {b.name} <span>· {b.guests} {b.guests === 1 ? 'guest' : 'guests'}</span>
              </p>
              <p className="adm-bk-meta">
                <a href={`tel:${String(b.phone).replace(/[^\d+]/g, '')}`}>{b.phone}</a> · {b.lang || 'English'} · received {fmtAgo(b.createdAt)}
              </p>
            </div>
            <div className="adm-bk-side">
              <span className={`adm-bk-status is-${b.status}`}>{b.status}</span>
              <div className="adm-bk-actions">
                {b.status !== 'confirmed' && (
                  <button type="button" className="primary" disabled={busy === b.id} onClick={() => act(b.id, { status: 'confirmed' })}>
                    Confirm
                  </button>
                )}
                {b.status !== 'declined' && (
                  <button type="button" disabled={busy === b.id} onClick={() => act(b.id, { status: 'declined' })}>
                    Decline
                  </button>
                )}
                {b.status !== 'pending' && (
                  <button type="button" disabled={busy === b.id} onClick={() => act(b.id, { status: 'pending' })}>
                    Back to pending
                  </button>
                )}
                <button
                  type="button"
                  className="danger"
                  title="Delete"
                  disabled={busy === b.id}
                  onClick={() => window.confirm(`Delete the request from ${b.name}? This cannot be undone.`) && act(b.id, { remove: true })}
                >
                  ✕
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The whole /admin page on the live site: bookings only.
export default function BookingsApp() {
  const state = useBookings();
  useEffect(() => {
    document.title = `${state.pending ? `(${state.pending}) ` : ''}Bookings · 44 Lounge`;
  }, [state.pending]);
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  return (
    <div className="adm adm-solo">
      <main className="adm-main">
        <header className="adm-bar">
          <h1>
            44 Lounge · Bookings {state.pending ? <span className="adm-bk-count is-hot">{state.pending} pending</span> : null}
          </h1>
        </header>
        <div className="adm-editor">
          <BookingsPanel state={state} />
        </div>
      </main>
    </div>
  );
}
