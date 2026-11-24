import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useContent, useLanguage } from '../content/ContentContext.jsx';
import { LANGUAGES } from '../content/i18n.js';
import { onScroll } from '../lib/motion.js';
import { OpenStatus, telHref } from './ui.jsx';
import { BookButton } from './Booking.jsx';

export function Brand() {
  const { general } = useContent();
  const [first, ...rest] = String(general.brand).split(' ');
  return (
    <Link to="/" className="brand" aria-label={`${general.brand} home`}>
      <span className="brand__num">{first}</span>
      {rest.join(' ')}
    </Link>
  );
}

// EN / ՀԱՅ / РУ
export function LanguageSwitch({ className = '', tabIndex }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t('Language')}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          title={l.name}
          aria-pressed={lang === l.code}
          className={lang === l.code ? 'is-active' : undefined}
          tabIndex={tabIndex}
          onClick={() => setLang(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export default function Nav() {
  const { general, buttons } = useContent();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [intro, setIntro] = useState(pathname === '/');
  const [open, setOpen] = useState(false);

  const links = [
    ['/', general.nav.home],
    ['/menu', general.nav.menu],
    ['/about', general.nav.about],
    ['/visit', general.nav.visit],
  ];

  useEffect(() => {
    let last = window.scrollY;
    const update = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      setIntro(pathname === '/' && y < 30);
      setHidden(y > 400 && y > last + 4); // hide while scrolling down, show on the way up
      if (y < last - 4 || y < 400) setHidden(false);
      last = y;
    };
    update();
    return onScroll(update);
  }, [pathname]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <header className={`nav${scrolled && !open ? ' is-scrolled' : ''}${hidden && !open ? ' is-hidden' : ''}${intro && !open ? ' is-intro' : ''}`}>
        <div className="wrap nav__inner">
          <Brand />
          <nav className="nav__links" aria-label={t('Main')}>
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="nav__right">
            <OpenStatus />
            <LanguageSwitch className="nav__lang" />
            <BookButton className="btn btn--accent btn--small" />
            <button
              type="button"
              className={`nav__burger${open ? ' is-open' : ''}`}
              aria-label={open ? t('Close menu') : t('Open menu')}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <div className={`menu-overlay${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <nav className="menu-overlay__links" aria-label="Mobile">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} tabIndex={open ? 0 : -1}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="menu-overlay__foot">
          <OpenStatus withTime />
          <p className="muted">{general.address}</p>
          <BookButton className="btn btn--accent" tabIndex={open ? 0 : -1} onClickCapture={() => setOpen(false)} />
          <a className="btn" href={telHref(general.phone)} tabIndex={open ? 0 : -1}>
            {buttons.call} {general.phone}
          </a>
        </div>
      </div>
    </>
  );
}
