import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useContent } from '../content/ContentContext.jsx';
import { scrollToTop, useScene, reveals } from '../lib/motion.js';
import { Brand } from './Nav.jsx';
import { BookButton } from './Booking.jsx';
import { Arrow, OpenStatus, Split, telHref, useYerevanClock } from './ui.jsx';

const Instagram = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const Facebook = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
  </svg>
);
const Phone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);

// Lets search engines show address, hours and phone for the lounge (Google Maps / search results).
function LocalBusinessData({ general, hours }) {
  const [lat, lng] = (general.coordinates.match(/[\d.]+/g) || []).map(Number);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BarOrPub',
    name: general.brand,
    description: general.tagline,
    telephone: general.phone.replace(/\s+/g, ''),
    address: {
      '@type': 'PostalAddress',
      streetAddress: general.address.split(',')[0],
      addressLocality: 'Yerevan',
      addressCountry: 'AM',
    },
    ...(lat && lng ? { geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } } : {}),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: hours.open,
        closes: hours.close,
      },
    ],
    hasMenu: `${window.location.origin}/menu`,
    sameAs: [general.instagram, general.facebook].filter(Boolean),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default function Footer() {
  const { general, hours, footer, menu, buttons } = useContent();
  const h = footer.headings;
  const ref = useRef(null);
  const now = useYerevanClock();
  const year = new Date().getFullYear();

  useScene(ref, ({ motion }) => motion && reveals(ref.current), [footer.ctaTitle]);

  return (
    <footer className="footer" ref={ref}>
      <LocalBusinessData general={general} hours={hours} />

      {/* booking call to action */}
      <div className="wrap">
        <div className="footer__cta">
          <h2 className="display footer__cta-title" data-reveal="rise">
            <Split text={footer.ctaTitle} />
          </h2>
          <div className="footer__cta-actions" data-reveal="fade">
            <BookButton />
            <a className="btn" href={telHref(general.phone)}>
              <Phone /> {general.phone}
            </a>
            <a className="btn" href={general.mapLink} target="_blank" rel="noreferrer">
              {buttons.directionsShort} <Arrow />
            </a>
          </div>
        </div>
      </div>

      {/* main footer */}
      <div className="wrap">
        <div className="footer__main">
          <div className="footer__brand">
            <Brand />
            <p className="muted">{footer.line}</p>
            <OpenStatus withTime />
            <div className="footer__social">
              <a href={general.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram />
              </a>
              <a href={general.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
                <Facebook />
              </a>
            </div>
          </div>

          <nav className="footer__cols" aria-label="Footer">
            <div className="footer__col">
              <h3 className="eyebrow">{h.visit}</h3>
              <address>
                <a href={general.mapLink} target="_blank" rel="noreferrer">
                  {general.address}
                </a>
              </address>
              <a className="footer__link-arrow" href={general.mapLink} target="_blank" rel="noreferrer">
                {buttons.directions} <Arrow />
              </a>
            </div>

            <div className="footer__col">
              <h3 className="eyebrow">{h.hours}</h3>
              <p>{hours.label}</p>
              <p className="footer__hours">
                {hours.open} – {hours.close}
              </p>
            </div>

            <div className="footer__col">
              <h3 className="eyebrow">{h.contact}</h3>
              <ul>
                <li>
                  <a href={telHref(general.phone)}>{general.phone}</a>
                </li>
                <li>
                  <a href={general.instagram} target="_blank" rel="noreferrer">
                    {general.instagramHandle}
                  </a>
                </li>
              </ul>
            </div>

            <div className="footer__col">
              <h3 className="eyebrow">{h.menu}</h3>
              <ul>
                <li>
                  <Link to="/menu/hookah">{menu.hookah.label}</Link>
                </li>
                <li>
                  <Link to="/menu/kitchen">{menu.kitchen.label}</Link>
                </li>
                <li>
                  <Link to="/menu/bar">{menu.bar.label}</Link>
                </li>
              </ul>
            </div>

            <div className="footer__col">
              <h3 className="eyebrow">{h.lounge}</h3>
              <ul>
                <li>
                  <Link to="/">{general.nav.home}</Link>
                </li>
                <li>
                  <Link to="/about">{general.nav.about}</Link>
                </li>
                <li>
                  <Link to="/visit">{general.nav.visit}</Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="footer__bottom">
          <span>{footer.copyright.replace('{year}', year)}</span>
          <span>
            Yerevan {now.text} · {menu.intro}
          </span>
          <button type="button" onClick={() => scrollToTop(true)}>
            {buttons.backToTop}
          </button>
        </div>
      </div>
    </footer>
  );
}
