import { useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import { useContent } from '../content/ContentContext.jsx';
import { gsap, lockScroll, reveals, scrollToElement, useScene } from '../lib/motion.js';
import { Arrow, Img, Split } from '../components/ui.jsx';

export const MENU_SECTIONS = ['hookah', 'kitchen', 'bar'];

const isCutout = (src) => /\.png$/i.test(src || ''); // dish photos with transparent background sit on the plate as-is

/* Plate carousel: one round plate per category. The centre plate is large and lit,
   neighbours peek in smaller at the sides. Swipe / drag, arrows, keyboard or a tap on a side plate. */
function PlateCarousel({ categories, active, onChange }) {
  const ref = useRef(null);
  const drag = useRef({ x: 0, dx: 0, on: false, moved: false });
  const [dx, setDx] = useState(0);
  const count = categories.length;
  const go = (i) => onChange(Math.max(0, Math.min(count - 1, i)));

  // horizontal trackpad swipe
  useEffect(() => {
    const el = ref.current;
    let lock = false;
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 18) return;
      e.preventDefault();
      if (lock) return;
      lock = true;
      go(active + (e.deltaX > 0 ? 1 : -1));
      setTimeout(() => (lock = false), 450);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, dx: 0, on: true, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.on) return;
    d.dx = e.clientX - d.x;
    if (Math.abs(d.dx) > 6 && !d.moved) {
      d.moved = true;
      ref.current.setPointerCapture?.(d.id);
    }
    if (d.moved) setDx(d.dx);
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d.on) return;
    d.on = false;
    const width = ref.current.offsetWidth;
    const step = Math.max(1, Math.round(Math.abs(d.dx) / (width * 0.28)));
    if (d.moved && Math.abs(d.dx) > 40) go(active + (d.dx < 0 ? step : -step));
    setDx(0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') go(active + 1);
    if (e.key === 'ArrowLeft') go(active - 1);
  };

  const current = categories[active];

  return (
    <div className="plates" aria-roledescription="carousel" aria-label="Menu categories">
      <div
        ref={ref}
        className={`plates__stage${dx ? ' is-dragging' : ''}`}
        style={{ '--drag': `${dx}px` }}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="plates__glow" />
        {categories.map((c, i) => {
          const offset = i - active;
          if (Math.abs(offset) > 2) return null;
          return (
            <button
              type="button"
              key={c.title}
              className={`plate${offset === 0 ? ' is-active' : ''}`}
              style={{ '--o': offset, '--abs': Math.abs(offset) }}
              onClick={() => !drag.current.moved && go(i)}
              aria-label={c.title}
              aria-current={offset === 0}
              tabIndex={-1}
            >
              <span className={`plate__disc${c.image ? (isCutout(c.image) ? ' is-cutout' : ' is-photo') : ''}`}>
                {c.image ? (
                  <Img src={c.image} alt="" draggable="false" />
                ) : (
                  <span className="plate__type">
                    <span className="plate__letter">{c.title.charAt(0)}</span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="plates__caption" aria-live="polite">
        <button type="button" className="plates__arrow" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous category">
          <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}>
            <Arrow />
          </span>
        </button>
        <div className="plates__text" key={current.title}>
          <h2 className="display plates__title">{current.title}</h2>
          <p className="plates__sub">
            <span className="plates__count">{current.items.length}</span> {current.items.length === 1 ? 'item' : 'items'} ·{' '}
            {active + 1} / {count}
          </p>
        </div>
        <button type="button" className="plates__arrow" onClick={() => go(active + 1)} disabled={active === count - 1} aria-label="Next category">
          <Arrow />
        </button>
      </div>

      <div className="plates__dots" aria-hidden="true">
        {categories.map((c, i) => (
          <span key={c.title} className={i === active ? 'is-active' : undefined} />
        ))}
      </div>
    </div>
  );
}

/* Full-screen dish view: big plate, name, description, price. Swipe / arrows / keys between the
   category's photographed dishes; Esc or the backdrop closes it. */
function DishViewer({ items, index, onIndex, onClose }) {
  const it = items[index];
  const drag = useRef({ x: 0, on: false, swiped: false });
  const go = (d) => onIndex((index + d + items.length) % items.length);

  useEffect(() => {
    lockScroll(true);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      lockScroll(false);
      window.removeEventListener('keydown', onKey);
    };
  });

  return (
    <div
      className="dish-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={it.name}
      onClick={(e) => e.target === e.currentTarget && !drag.current.swiped && onClose()}
      onPointerDown={(e) => (drag.current = { x: e.clientX, on: true, swiped: false })}
      onPointerUp={(e) => {
        if (!drag.current.on) return;
        drag.current.on = false;
        const dx = e.clientX - drag.current.x;
        if (Math.abs(dx) > 50) {
          drag.current.swiped = true;
          go(dx < 0 ? 1 : -1);
        }
      }}
    >
      <button type="button" className="dish-viewer__close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="dish-viewer__body" key={it.name}>
        <div className={`dish-viewer__plate${isCutout(it.image) ? ' is-cutout' : ''}`}>
          <Img src={it.image} alt={it.name} draggable="false" />
        </div>
        <h2 className="display dish-viewer__name">{it.name}</h2>
        {it.description && <p className="dish-viewer__desc">{it.description}</p>}
        <p className="dish-viewer__price">{it.price}</p>
      </div>
      {items.length > 1 && (
        <div className="dish-viewer__nav">
          <button type="button" className="plates__arrow" onClick={() => go(-1)} aria-label="Previous dish">
            <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}>
              <Arrow />
            </span>
          </button>
          <span className="eyebrow">
            {index + 1} / {items.length}
          </span>
          <button type="button" className="plates__arrow" onClick={() => go(1)} aria-label="Next dish">
            <Arrow />
          </button>
        </div>
      )}
    </div>
  );
}

function Items({ cat }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(-1);
  const photos = cat.items.filter((i) => i.image);
  const plain = cat.items.filter((i) => !i.image);
  const priced = cat.items.some((i) => i.price);

  useEffect(() => {
    setOpen(-1);
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = ref.current.querySelectorAll('.dish-card, .menu-item, .menu-tags li');
    gsap.fromTo(els, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.03, ease: 'power3.out' });
  }, [cat]);

  if (!priced) {
    return (
      <div ref={ref}>
        <ul className="menu-tags">
          {cat.items.map((it, i) => (
            <li key={i}>{it.name}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div ref={ref}>
      {photos.length > 0 && (
        <ul className="dish-grid">
          {photos.map((it, i) => (
            <li key={it.name}>
              <button type="button" className="dish-card" onClick={() => setOpen(i)}>
                <span className={`dish-card__plate${isCutout(it.image) ? ' is-cutout' : ''}`}>
                  <Img src={it.image} alt="" />
                </span>
                <span className="dish-card__name">{it.name}</span>
                <span className="dish-card__price">{it.price}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {plain.length > 0 && (
        <ul className="menu-list">
          {plain.map((it, i) => (
            <li className="menu-item" key={i}>
              <div className="menu-item__body">
                <div className="menu-item__row">
                  <span className="menu-item__name">{it.name}</span>
                  <span className="menu-item__leader" />
                  <span className="menu-item__price">{it.price}</span>
                </div>
                {it.description && <p className="menu-item__desc">{it.description}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {open >= 0 && <DishViewer items={photos} index={open} onIndex={setOpen} onClose={() => setOpen(-1)} />}
    </div>
  );
}

const slug = (t) =>
  String(t)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Hookah and bar: a clean text menu, names and prices only.
function TextMenu({ cats }) {
  return (
    <div className="text-menu">
      {cats.map((c) => {
        const priced = c.items.some((i) => i.price);
        return (
          <section className="text-menu__cat" id={`cat-${slug(c.title)}`} key={c.title}>
            <div className="text-menu__head">
              <h2 className="display text-menu__title">{c.title}</h2>
              <span className="eyebrow">{c.items.length}</span>
            </div>
            {priced ? (
              <ul className="menu-list">
                {c.items.map((it, i) => (
                  <li className="menu-item" key={i}>
                    <div className="menu-item__row">
                      <span className="menu-item__name">{it.name}</span>
                      <span className="menu-item__leader" />
                      <span className="menu-item__price">{it.price}</span>
                    </div>
                    {it.description && <p className="menu-item__desc">{it.description}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="menu-tags menu-tags--left">
                {c.items.map((it, i) => (
                  <li key={i}>{it.name}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function Menu() {
  const { section = 'hookah' } = useParams();
  const { menu } = useContent();
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  const current = menu[section];

  useEffect(() => setActive(0), [section]);

  // keep the active category chip visible in the chip row
  useEffect(() => {
    const row = ref.current?.querySelector('.menu-chips');
    const chip = row?.children[active];
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' });
  }, [active, section]);
  useScene(ref, ({ motion }) => motion && reveals(ref.current), [section]);

  // text menus: highlight the chip of the category being read
  useEffect(() => {
    if (!current || section === 'kitchen') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(current.categories.findIndex((c) => `cat-${slug(c.title)}` === hit.target.id));
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    ref.current?.querySelectorAll('.text-menu__cat').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [current, section]);

  if (!current) return <Navigate to="/menu" replace />;
  const cats = current.categories;
  const withPhotos = section === 'kitchen';
  const pick = (i) => {
    setActive(i);
    if (!withPhotos) scrollToElement(document.getElementById(`cat-${slug(cats[i].title)}`), -170);
  };
  const cat = cats[Math.min(active, cats.length - 1)];

  return (
    <main ref={ref} className="menu-page">
      <header className="page-head page-head--menu">
        <div className="wrap">
          <div className="page-head__row">
            <h1 className="display page-head__title" data-reveal="rise">
              <Split text={menu.title} />
            </h1>
            <p className="page-head__intro" data-reveal="fade">
              {menu.intro}
            </p>
          </div>
        </div>
      </header>

      <div className="menu-bar">
        <div className="wrap">
          <nav className="menu-tabs" aria-label="Menu sections">
            {MENU_SECTIONS.map((s) => (
              <NavLink key={s} to={`/menu/${s}`} className={s === section ? 'active' : undefined} preventScrollReset>
                {menu[s].label}
                <sup>{menu[s].categories.reduce((n, c) => n + c.items.length, 0)}</sup>
              </NavLink>
            ))}
          </nav>
          {cats.length > 1 && (
            <div className="menu-chips">
              {cats.map((c, i) => (
                <button type="button" key={c.title} className={i === active ? 'active' : undefined} onClick={() => pick(i)}>
                  {c.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="wrap">
        {withPhotos ? (
          <>
            <PlateCarousel key={section} categories={cats} active={Math.min(active, cats.length - 1)} onChange={setActive} />
            <section className="menu-panel" aria-label={cat.title}>
              <Items cat={cat} />
            </section>
          </>
        ) : (
          <TextMenu cats={cats} />
        )}
      </div>
    </main>
  );
}
