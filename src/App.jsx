import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import { BookingProvider } from './components/Booking.jsx';
import Home from './pages/Home.jsx';
import Menu from './pages/Menu.jsx';
import About from './pages/About.jsx';
import Visit from './pages/Visit.jsx';
import NotFound from './pages/NotFound.jsx';
import { scrollToTop, ScrollTrigger, startSmoothScroll, stopSmoothScroll } from './lib/motion.js';
import { useContent } from './content/ContentContext.jsx';

// /admin: bookings and the content editor. Loaded only when someone opens /admin (not part of the site's own
// download). On the live site it asks for the password and saves through GitHub.
const Admin = lazy(() => import('./admin/Admin.jsx'));

// page names in the browser tab come from the (translated) navigation labels
const TITLE_KEYS = { '/menu': 'menu', '/about': 'about', '/visit': 'visit' };

function SiteLayout() {
  const { pathname } = useLocation();
  const { general } = useContent();
  const prevPath = useRef(null);

  useEffect(() => {
    // the site decides where a page starts, not the browser's saved position
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    startSmoothScroll();
    return stopSmoothScroll;
  }, []);

  // Every new page starts at the top. Only switching tabs inside the menu (Hookah/Kitchen/Bar)
  // keeps the reader where they are.
  useLayoutEffect(() => {
    const prev = prevPath.current;
    const menuTabSwitch = prev && prev.startsWith('/menu') && pathname.startsWith('/menu');
    if (!menuTabSwitch) scrollToTop();
    prevPath.current = pathname;
    // Removing the previous page's pinned sections (home hero/statement) makes ScrollTrigger put back
    // the old scroll position a moment later — so go to the top again once that has happened.
    const raf = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      if (!menuTabSwitch) scrollToTop();
    });
    const t = setTimeout(() => {
      if (!menuTabSwitch && window.scrollY > 0 && window.scrollY !== 0) scrollToTop();
    }, 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [pathname]);

  useEffect(() => {
    const key = Object.keys(TITLE_KEYS).find((p) => pathname.startsWith(p));
    document.title = key ? `${general.nav[TITLE_KEYS[key]]} · ${general.brand}` : `${general.brand} — ${general.tagline}`;
  }, [pathname, general]);

  return (
    <BookingProvider>
      <Nav />
      <Outlet />
      <Footer />
      <div className="grain" aria-hidden="true" />
    </BookingProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Navigate to="/menu/hookah" replace />} />
        <Route path="/menu/:section" element={<Menu />} />
        <Route path="/about" element={<About />} />
        <Route path="/visit" element={<Visit />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route
        path="/admin"
        element={
          <Suspense fallback={null}>
            <Admin />
          </Suspense>
        }
      />
    </Routes>
  );
}
