import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useContent, useLanguage } from '../content/ContentContext.jsx';
import { fill, localeOf } from '../content/i18n.js';
import { lockScroll } from '../lib/motion.js';
import { telHref } from './ui.jsx';

/* "Book a table": a form (name, phone, guests, date, time) that sends the request to the
   lounge's Telegram chat through POST /api/book (see server/booking.js). */

const BookingContext = createContext({ open: () => {} });
export const useBooking = () => useContext(BookingContext);

const YEREVAN = 'Asia/Yerevan';

function yerevanToday() {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: YEREVAN }).format(new Date());
}
function yerevanMinutes() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: YEREVAN, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const g = (t) => Number(p.find((x) => x.type === t)?.value || 0);
  return (g('hour') % 24) * 60 + g('minute');
}
const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmt = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Half-hour slots from opening until 30 min before closing (the night can run past midnight).
function timeSlots(open, close, date) {
  const o = toMin(open);
  let c = toMin(close);
  if (c <= o) c += 24 * 60;
  const slots = [];
  for (let t = o; t <= c - 30; t += 30) slots.push(t);
  if (date !== yerevanToday()) return slots.map(fmt);
  const now = yerevanMinutes();
  return slots.filter((t) => t > now + 30).map(fmt);
}

// Same rules as the server (server/booking.js): name, phone, guests and date are required; time is optional.
function checkForm(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = 'Please enter your name.';
  const phone = form.phone.trim();
  if ((phone.match(/\d/g) || []).length < 8 || !/^[+\d\s()-]+$/.test(phone)) errors.phone = 'Please enter a valid phone number.';
  if (!(form.guests >= 1 && form.guests <= 30)) errors.guests = 'Please choose the number of guests.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = 'Please choose a date.';
  return errors;
}

function BookingModal({ onClose }) {
  const { general, hours, booking: tx } = useContent();
  const { lang, t } = useLanguage();
  const today = yerevanToday();
  const [form, setForm] = useState({ name: '', phone: '+374 ', guests: 2, date: today, time: '', website: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');
  const firstField = useRef(null);
  const formRef = useRef(null);

  const slots = useMemo(() => timeSlots(hours.open, hours.close, form.date), [hours.open, hours.close, form.date]);
  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (errors[k]) setErrors(({ [k]: _, ...rest }) => rest); // clear a field's message as soon as it is edited
  };

  useEffect(() => {
    if (form.time && !slots.includes(form.time)) setForm((f) => ({ ...f, time: '' }));
  }, [slots, form.time]);

  useEffect(() => {
    lockScroll(true);
    firstField.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      lockScroll(false);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    const found = checkForm(form);
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus('idle');
      // move to the first field that needs attention
      formRef.current?.querySelector(`[name="${Object.keys(found)[0]}"]`)?.focus();
      return;
    }
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ? t(data.error) : tx.sendError);
      setStatus('sent');
    } catch (err) {
      // a dropped connection has no message of ours: show the friendly one
      setError(err instanceof TypeError ? tx.sendError : err.message);
      setStatus('error');
    }
  };

  const dateLabel = form.date
    ? new Date(`${form.date}T12:00:00Z`).toLocaleDateString(localeOf(lang), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    : '';

  // label with a required mark, and the field's message underneath
  const label = (text, required = false) => (
    <span>
      {text}
      {required && (
        <b className="field__req" aria-hidden="true">
          {' '}
          *
        </b>
      )}
    </span>
  );
  const message = (name) =>
    errors[name] ? (
      <small className="field__error" id={`booking-${name}-error`}>
        {t(errors[name])}
      </small>
    ) : null;
  const invalid = (name) => (errors[name] ? { 'aria-invalid': true, 'aria-describedby': `booking-${name}-error` } : {});

  return (
    <div className="booking" role="dialog" aria-modal="true" aria-labelledby="booking-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="booking__panel">
        <button type="button" className="booking__close" onClick={onClose} aria-label={t('Close')}>
          ✕
        </button>

        {status === 'sent' ? (
          <div className="booking__done" role="status">
            <p className="booking__badge">
              <span className="booking__badge-dot" /> {tx.sentLabel}
            </p>
            <h2 className="display booking__title" id="booking-title">
              {fill(tx.sentTitle, { name: form.name.trim().split(' ')[0] })}
            </h2>
            <dl className="booking__details">
              <div>
                <dt>{tx.name}</dt>
                <dd>{form.name.trim()}</dd>
              </div>
              <div>
                <dt>{tx.phone}</dt>
                <dd>{form.phone.trim()}</dd>
              </div>
              <div>
                <dt>{tx.guests}</dt>
                <dd>{form.guests}</dd>
              </div>
              <div>
                <dt>{tx.date}</dt>
                <dd>{dateLabel}</dd>
              </div>
              <div>
                <dt>{tx.time}</dt>
                <dd>{form.time || tx.anyTime}</dd>
              </div>
            </dl>
            <p className="muted">{fill(tx.sentText, { phone: general.phone })}</p>
            <button type="button" className="btn" onClick={onClose}>
              {tx.done}
            </button>
          </div>
        ) : (
          <form className="booking__form" onSubmit={submit} noValidate ref={formRef}>
            <p className="eyebrow eyebrow--accent">{general.brand}</p>
            <h2 className="display booking__title" id="booking-title">
              {tx.title}
            </h2>

            <label className={`field${errors.name ? ' is-invalid' : ''}`}>
              {label(tx.name, true)}
              <input
                ref={firstField}
                name="name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={60}
                value={form.name}
                onChange={set('name')}
                {...invalid('name')}
              />
              {message('name')}
            </label>

            <label className={`field${errors.phone ? ' is-invalid' : ''}`}>
              {label(tx.phone, true)}
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                required
                maxLength={30}
                value={form.phone}
                onChange={set('phone')}
                {...invalid('phone')}
              />
              {message('phone')}
            </label>

            <div className={`field${errors.guests ? ' is-invalid' : ''}`}>
              {label(tx.guests, true)}
              <div className="stepper">
                <button type="button" aria-label={t('Fewer guests')} onClick={() => setForm((f) => ({ ...f, guests: Math.max(1, f.guests - 1) }))}>
                  −
                </button>
                <output aria-live="polite" name="guests">
                  {form.guests}
                </output>
                <button type="button" aria-label={t('More guests')} onClick={() => setForm((f) => ({ ...f, guests: Math.min(30, f.guests + 1) }))}>
                  +
                </button>
              </div>
              {message('guests')}
            </div>

            <div className="field-row">
              <label className={`field${errors.date ? ' is-invalid' : ''}`}>
                {label(tx.date, true)}
                <input
                  name="date"
                  type="date"
                  required
                  min={today}
                  max={addDays(today, 60)}
                  value={form.date}
                  onChange={set('date')}
                  {...invalid('date')}
                />
                {message('date')}
              </label>
              <label className="field">
                {label(tx.time)}
                <select name="time" value={form.time} onChange={set('time')}>
                  <option value="">{slots.length ? tx.anyTime : tx.noTimes}</option>
                  {slots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* left empty by people; catches spam bots */}
            <input className="booking__trap" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} aria-hidden="true" />

            {status === 'error' && (
              <p className="booking__error" role="alert">
                {error}{' '}
                <a href={telHref(general.phone)}>{general.phone}</a>
              </p>
            )}

            <button type="submit" className="btn booking__submit" disabled={status === 'sending'}>
              {status === 'sending' ? tx.sending : tx.submit}
            </button>
            <p className="booking__note muted">
              <b className="field__req">*</b> {tx.requiredNote} · {fill(tx.note, { open: hours.open, close: hours.close })}{' '}
              <a href={telHref(general.phone)}>{general.phone}</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export function BookingProvider({ children }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  return (
    <BookingContext.Provider value={{ open }}>
      {children}
      {isOpen && <BookingModal onClose={close} />}
    </BookingContext.Provider>
  );
}

// Any "Book a table" button on the site.
export function BookButton({ className = 'btn', children, ...rest }) {
  const { open } = useBooking();
  const { general } = useContent();
  return (
    <button type="button" className={className} onClick={open} {...rest}>
      {children || general.reserveLabel}
    </button>
  );
}
