import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { asset } from '../asset.js';
import { useContent, useLanguage } from '../content/ContentContext.jsx';
import { gsap, reveals, useScene } from '../lib/motion.js';
import { Arrow, Img, OpenStatus, Split, Star, telHref, useYerevanClock } from '../components/ui.jsx';
import SmokeDigits from '../components/SmokeDigits.jsx';
import { BookButton } from '../components/Booking.jsx';
import { dishesOfTheDay, serviceDay } from '../lib/dailyDishes.js';

/* Storyboard
   1. Hero (pinned ~150vh): a dark screen, no menu, only a transparent "44" drawn by smoke moving inside
      each digit. Scrolling flies through the digits (they scale up and dissolve), then the lounge photo
      settles in and the headline rises.
   2. Intro: the brand line lights up word by word as you read down.
   3. Marquee: two rows of words + photo chips slide in opposite directions with scroll.
   4. Three menus: cards unmask from the bottom one after another.
   5. Statement (pinned): neon room settles while "Where it feels / like home." rises line by line.
   6. Dishes: rows arrive in reading order; on desktop the dish photo floats after the cursor.
   7. Hours band in the accent color with live open/closed status.
   8. Gallery strip drifts sideways with scroll. */

function Hero() {
  const { general, home, buttons } = useContent();
  const { hero } = home;
  const ref = useRef(null);
  // shared with the canvas: zoom level for the fly-through, and whether the smoke should play
  const smoke = useRef({ scale: 1, paused: false }).current;

  useScene(
    ref,
    ({ motion, mobile }) => {
      if (!motion) {
        smoke.paused = true;
        gsap.set('.hero__digits', { autoAlpha: 0 });
        gsap.set('.hero__img', { autoAlpha: 1, scale: 1 });
        gsap.set(['.hero__copy', '.hero__shade'], { autoAlpha: 1 });
        return;
      }
      smoke.scale = 1;
      gsap.set('.hero__img', { autoAlpha: 0, scale: 1.25 });
      gsap.set('.hero__copy', { autoAlpha: 1 });
      gsap.set('.hero__copy .w > span', { yPercent: 110 });
      gsap.set('.hero__actions', { autoAlpha: 0, y: 20 });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: ref.current,
          start: 'top top',
          end: mobile ? '+=110%' : '+=150%',
          pin: '.hero__stage',
          scrub: 0.8,
          // the smoke only needs to run while it can be seen
          onUpdate: (self) => {
            smoke.paused = self.progress > 0.6;
          },
        },
      });
      // fly through the digits: they grow past the screen and dissolve, then the lounge appears
      tl.to(smoke, { scale: mobile ? 9 : 11, ease: 'power2.in', duration: 1 }, 0)
        .to('.hero__hint', { autoAlpha: 0, duration: 0.15 }, 0)
        .to('.hero__digits', { autoAlpha: 0, duration: 0.22 }, 0.3)
        .to('.hero__img', { autoAlpha: 1, duration: 0.35 }, 0.52)
        .to('.hero__img', { scale: 1, duration: 0.5 }, 0.52)
        .to('.hero__shade', { autoAlpha: 1, duration: 0.4 }, 0.6)
        .to('.hero__copy .w > span', { yPercent: 0, stagger: 0.04, ease: 'power3.out', duration: 0.35 }, 0.78)
        .to('.hero__actions', { autoAlpha: 1, y: 0, duration: 0.25 }, 1.05);

      // first paint: the smoke digits fade up out of the dark. Only at the top of the page: when the scene is
      // rebuilt further down (e.g. after switching language) these would undo what the scroll already hid.
      if (window.scrollY < 10) {
        gsap.from('.hero__digits-in', { autoAlpha: 0, duration: 2.2, ease: 'power2.out' });
        gsap.from('.hero__hint', { autoAlpha: 0, duration: 1, delay: 1.6 });
      }
    },
    [hero.title, hero.image]
  );

  return (
    <section className="hero" ref={ref}>
      <div className="hero__stage">
        <img className="hero__img" src={asset(hero.image)} alt="" />
        {/* the "44": transparent digits, each filled with its own pass of the smoke video (second one 5 s later) */}
        <div className="hero__digits">
          <div className="hero__digits-in">
            {hero.video && <SmokeDigits src={hero.video} state={smoke} offsets={[0, 5]} className="hero__canvas" />}
          </div>
        </div>
        <div className="hero__shade" />

        <span className="eyebrow hero__hint">
          {hero.scrollHint} <i />
        </span>

        <div className="hero__copy">
          <h1 className="display hero__title">
            <Split text={hero.title} />
          </h1>
          <div className="hero__actions">
            <Link className="btn btn--accent" to="/menu">
              {buttons.seeMenu} <Arrow />
            </Link>
            <BookButton />
          </div>
        </div>
      </div>
    </section>
  );
}

function Intro() {
  const { home, general, hours } = useContent();
  const ref = useRef(null);
  const words = String(home.intro).split(/\s+/);

  useScene(
    ref,
    ({ motion }) => {
      if (!motion) return gsap.set('.word', { opacity: 1 });
      gsap.to('.word', {
        opacity: 1,
        stagger: 0.1,
        ease: 'none',
        scrollTrigger: { trigger: '.intro__text', start: 'top 80%', end: 'bottom 45%', scrub: true },
      });
      reveals(ref.current);
    },
    [home.intro]
  );

  return (
    <section className="intro" ref={ref}>
      <div className="wrap">
        <div className="intro__meta" data-reveal="fade">
          <span className="eyebrow eyebrow--accent">{general.tagline}</span>
          <span className="eyebrow">
            {hours.label} · {hours.open} — {hours.close}
          </span>
        </div>
        <p className="intro__text">
          {words.map((w, i) => (
            <span className="word" key={i}>
              {w}{' '}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

function Marquee() {
  const { home } = useContent();
  const { rows, images } = home.marquee;
  const ref = useRef(null);

  useScene(
    ref,
    ({ motion }) => {
      if (!motion) return;
      gsap.utils.toArray('.marquee__row').forEach((row, i) => {
        const dir = i % 2 ? 1 : -1;
        gsap.fromTo(
          row,
          { xPercent: dir < 0 ? 0 : -30 },
          {
            xPercent: dir < 0 ? -30 : 0,
            ease: 'none',
            scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
          }
        );
      });
    },
    [JSON.stringify(home.marquee)]
  );

  let img = 0;
  return (
    <section className="marquee" ref={ref} aria-label={rows.join(', ')}>
      {rows.map((row, r) => {
        const words = row.split('·').map((w) => w.trim()).filter(Boolean);
        const seq = [...words, ...words, ...words];
        return (
          <div className={`marquee__row${r % 2 ? ' marquee__row--outline' : ''}`} key={r} aria-hidden="true">
            {seq.map((w, i) => {
              const src = images.length ? images[img++ % images.length] : '';
              return (
                <span key={i} style={{ display: 'contents' }}>
                  <span className="marquee__word">{w}</span>
                  {i % 2 === r % 2 && src ? (
                    <span className="marquee__chip">
                      <Img src={src} />
                    </span>
                  ) : (
                    <Star className="marquee__star" />
                  )}
                </span>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

function Worlds() {
  const { home } = useContent();
  const { worlds } = home;
  const ref = useRef(null);
  useScene(ref, ({ motion }) => motion && reveals(ref.current), [JSON.stringify(worlds)]);

  return (
    <section className="worlds" ref={ref}>
      <div className="wrap">
        <div className="worlds__head">
          <h2 className="display section-title" data-reveal="rise">
            <Split text={worlds.title} />
          </h2>
          <span className="eyebrow" data-reveal="fade">
            {worlds.eyebrow}
          </span>
        </div>
        <div className="worlds__grid">
          {worlds.items.map((w, i) => (
            <Link to={w.link} className="world" key={i}>
              <div className="world__media" data-reveal="media">
                <Img src={w.image} alt={w.title} />
                <span className="world__index">0{i + 1}</span>
              </div>
              <div data-reveal="fade">
                <h3 className="display world__title">
                  {w.title}
                  <span className="world__arrow">
                    <Arrow />
                  </span>
                </h3>
                <p className="world__text">{w.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Statement() {
  const { home } = useContent();
  const { statement } = home;
  const ref = useRef(null);

  useScene(
    ref,
    ({ motion, mobile }) => {
      if (!motion) return;
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: ref.current, start: 'top top', end: mobile ? '+=80%' : '+=120%', pin: true, scrub: 0.8 },
      });
      tl.fromTo('.statement__img', { scale: 1.25, filter: 'brightness(0.5)' }, { scale: 1, filter: 'brightness(1)', duration: 1 }, 0)
        .from('.statement__line > span', { yPercent: 115, stagger: 0.18, duration: 0.45, ease: 'power3.out' }, 0.15)
        .to('.statement__line > span', { yPercent: 0, duration: 0.2 }, 0.8);
    },
    [JSON.stringify(statement)]
  );

  return (
    <section className="statement" ref={ref}>
      <Img className="statement__img" src={statement.image} />
      <div className="statement__shade" />
      <div className="statement__copy">
        <h2 className="display statement__text">
          {statement.lines.map((l, i) => (
            <span className="statement__line" key={i}>
              <span>{l}</span>
            </span>
          ))}
        </h2>
      </div>
    </section>
  );
}

function Dishes() {
  const { home, buttons, menu } = useContent();
  const { dishes } = home;
  const ref = useRef(null);
  const [active, setActive] = useState(-1);
  useYerevanClock(); // re-renders every few seconds, so the set switches at 06:00 even without a reload
  const day = serviceDay();
  const items = useMemo(() => dishesOfTheDay(menu.kitchen, Number(dishes.count) || 6, day), [menu.kitchen, dishes.count, day]);

  useScene(
    ref,
    ({ motion, mobile }) => {
      if (!motion) return;
      reveals(ref.current);
      if (mobile) return;
      // floating photo follows the cursor over the list
      const float = ref.current.querySelector('.dishes__float');
      const xTo = gsap.quickTo(float, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(float, 'y', { duration: 0.6, ease: 'power3' });
      const list = ref.current.querySelector('.dishes__list');
      const move = (e) => {
        xTo(e.clientX);
        yTo(e.clientY);
      };
      const enter = () => gsap.to(float, { autoAlpha: 1, scale: 1, rotate: -4, duration: 0.5, ease: 'back.out(1.6)' });
      const leave = () => gsap.to(float, { autoAlpha: 0, scale: 0.6, rotate: 0, duration: 0.35 });
      list.addEventListener('pointermove', move);
      list.addEventListener('pointerenter', enter);
      list.addEventListener('pointerleave', leave);
      return () => {
        list.removeEventListener('pointermove', move);
        list.removeEventListener('pointerenter', enter);
        list.removeEventListener('pointerleave', leave);
      };
    },
    [JSON.stringify(items)]
  );

  return (
    <section className="dishes" ref={ref}>
      <div className="wrap">
        <div className="dishes__head">
          <div>
            <p className="eyebrow eyebrow--accent dishes__eyebrow" data-reveal="fade">
              {dishes.eyebrow}
            </p>
            <h2 className="display section-title" data-reveal="rise">
              <Split text={dishes.title} />
            </h2>
          </div>
          <Link className="btn" to="/menu/kitchen" data-reveal="fade">
            {buttons.fullKitchenMenu} <Arrow />
          </Link>
        </div>
        <ul className="dishes__list" data-reveal="list">
          {items.map((d, i) => (
            <li className="dish" key={i} onPointerEnter={() => setActive(i)}>
              <span className="dish__no">{String(i + 1).padStart(2, '0')}</span>
              <Img className="dish__thumb" src={d.image} alt={d.name} />
              <h3 className="dish__name">{d.name}</h3>
              <p className="dish__desc">{d.description || d.category}</p>
              <span className="dish__price">{d.price}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="dishes__float" aria-hidden="true">
        {items.map((d, i) => (
          <Img key={i} src={d.image} className={i === active ? 'is-active' : undefined} />
        ))}
      </div>
    </section>
  );
}

function Hours() {
  const { hours, general } = useContent();
  const ref = useRef(null);
  const now = useYerevanClock();
  const { t } = useLanguage();
  useScene(
    ref,
    ({ motion }) => {
      if (!motion) return;
      reveals(ref.current);
      gsap.fromTo('.hours__time', { xPercent: 6 }, { xPercent: -4, ease: 'none', scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: true } });
    },
    []
  );
  return (
    <section className="hours" ref={ref}>
      <div className="wrap hours__grid">
        <div>
          <span className="eyebrow">{hours.label}</span>
          <p className="display hours__time">
            {hours.open} <span>—</span> {hours.close}
          </p>
        </div>
        <div className="hours__side" data-reveal="fade">
          <OpenStatus />
          <span className="clock">{t('Yerevan')} · {now.text}</span>
          <a className="btn" href={telHref(general.phone)}>
            {general.phone}
          </a>
        </div>
      </div>
    </section>
  );
}

function Gallery() {
  const { home, general } = useContent();
  const { gallery } = home;
  const ref = useRef(null);
  useScene(
    ref,
    ({ motion }) => {
      if (!motion) return;
      reveals(ref.current);
      const track = ref.current.querySelector('.gallery__track');
      gsap.fromTo(
        track,
        { x: () => window.innerWidth * 0.15 },
        {
          x: () => -(track.scrollWidth - window.innerWidth) - window.innerWidth * 0.05,
          ease: 'none',
          scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
        }
      );
    },
    [JSON.stringify(gallery)]
  );
  return (
    <section className="gallery" ref={ref}>
      <div className="wrap gallery__head">
        <h2 className="display section-title" data-reveal="rise">
          <Split text={gallery.title} />
        </h2>
        <a className="btn" href={general.instagram} target="_blank" rel="noreferrer" data-reveal="fade">
          {general.instagramHandle} <Arrow />
        </a>
      </div>
      <div className="gallery__track">
        {gallery.photos.map((p, i) => (
          <div className="gallery__item" key={i}>
            <Img src={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main>
      <Hero />
      <Intro />
      <Marquee />
      <Worlds />
      <Statement />
      <Dishes />
      <Hours />
      <Gallery />
    </main>
  );
}
