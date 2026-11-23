import { useRef } from 'react';
import { useContent } from '../content/ContentContext.jsx';
import { reveals, useScene } from '../lib/motion.js';
import { Arrow, Img, OpenStatus, Split, telHref } from '../components/ui.jsx';
import { BookButton } from '../components/Booking.jsx';

export default function Visit() {
  const { visit, general, hours, buttons } = useContent();
  const ref = useRef(null);
  useScene(ref, ({ motion }) => motion && reveals(ref.current), []);

  return (
    <main ref={ref}>
      <header className="page-head">
        <div className="wrap">
          <div className="page-head__row">
            <h1 className="display page-head__title" data-reveal="rise">
              <Split text={visit.title} />
            </h1>
            <p className="page-head__intro" data-reveal="fade">
              {visit.text}
            </p>
          </div>
        </div>
      </header>

      <div className="wrap visit-grid">
        <div className="visit-info" data-reveal="list">
          <div className="visit-block">
            <span className="eyebrow">{visit.addressLabel}</span>
            <p className="visit-block__value">{general.address}</p>
            <div className="visit-block__links">
              <a className="btn btn--small" href={general.mapLink} target="_blank" rel="noreferrer">
                {buttons.directions} <Arrow />
              </a>
            </div>
          </div>
          <div className="visit-block">
            <span className="eyebrow">{hours.label}</span>
            <p className="visit-block__value">
              {hours.open} — {hours.close}
            </p>
            <OpenStatus withTime />
          </div>
          <div className="visit-block">
            <span className="eyebrow">{visit.bookLabel}</span>
            <p className="visit-block__value">
              <a href={telHref(general.phone)}>{general.phone}</a>
            </p>
            <div className="visit-block__links">
              <BookButton className="btn btn--small">{buttons.bookOnline}</BookButton>
              <a className="btn btn--small" href={telHref(general.phone)}>
                {buttons.callNow}
              </a>
              <a className="btn btn--small" href={general.instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
              <a className="btn btn--small" href={general.facebook} target="_blank" rel="noreferrer">
                Facebook
              </a>
            </div>
          </div>
        </div>

        <div className="visit-map" data-reveal="media">
          <iframe src={visit.mapUrl} title={`${general.brand} on the map`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          <div className="visit-map__pin">
            <Img src={visit.image} />
            <div>
              <p className="display" style={{ fontSize: 18 }}>
                {general.brand}
              </p>
              <p className="eyebrow">{general.coordinates}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
