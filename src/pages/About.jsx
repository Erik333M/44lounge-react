import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useContent, useLanguage } from '../content/ContentContext.jsx';
import { gsap, reveals, useScene } from '../lib/motion.js';
import { Arrow, Img, Split } from '../components/ui.jsx';

export default function About() {
  const { about, hours, menu, buttons } = useContent();
  const { t } = useLanguage();
  const ref = useRef(null);
  const count = (s) => menu[s].categories.reduce((n, c) => n + c.items.length, 0);

  useScene(
    ref,
    ({ motion }) => {
      if (!motion) return;
      reveals(ref.current);
      // photos drift at different speeds inside their frames
      gsap.utils.toArray('.about-collage figure img').forEach((img, i) => {
        gsap.fromTo(
          img,
          { yPercent: -6 - i * 2 },
          { yPercent: 6 + i * 2, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }
        );
      });
    },
    [JSON.stringify(about)]
  );

  return (
    <main ref={ref}>
      <header className="page-head">
        <div className="wrap">
          <h1 className="display page-head__title" data-reveal="rise">
            <Split text={about.title} />
          </h1>
        </div>
      </header>

      <div className="wrap">
        <div className="about-collage">
          {about.images.slice(0, 3).map((src, i) => (
            <figure key={i} data-reveal="media">
              <Img src={src} />
            </figure>
          ))}
        </div>

        <section className="about-story">
          <h2 className="display about-story__heading" data-reveal="rise">
            <Split text={about.heading} />
          </h2>
          <div className="about-story__text" data-reveal="list">
            {about.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p>
              <Link className="btn" to="/menu">
                {buttons.seeMenu} <Arrow />
              </Link>
            </p>
          </div>
        </section>

        <section className="facts" data-reveal="list">
          <div className="fact">
            <span className="eyebrow">{hours.label}</span>
            <p className="display fact__value">
              {hours.open}–{hours.close}
            </p>
          </div>
          <div className="fact">
            <span className="eyebrow">{menu.hookah.label}</span>
            <p className="display fact__value">{menu.hookah.categories[0]?.items.length} {t.plural(menu.hookah.categories[0]?.items.length, 'line', 'lines')}</p>
          </div>
          <div className="fact">
            <span className="eyebrow">
              {menu.kitchen.label} & {menu.bar.label}
            </span>
            <p className="display fact__value">{count('kitchen') + count('bar')} {t.plural(count('kitchen') + count('bar'), 'item', 'items')}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
