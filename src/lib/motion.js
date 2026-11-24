// Scroll motion: GSAP + ScrollTrigger for animations, Lenis for smooth wheel scrolling.
// Animations are code-only on purpose (not editable in the admin).

import { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
// On phones the browser bar shows and hides while scrolling, which changes the window height. Recalculating
// every scroll animation for that makes the pinned hero jump, so those height-only changes are ignored.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger };

let lenis = null;
let tick = null;

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function startSmoothScroll() {
  if (lenis || prefersReducedMotion()) return;
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
}

export function stopSmoothScroll() {
  if (!lenis) return;
  gsap.ticker.remove(tick);
  lenis.destroy();
  lenis = null;
}

// stop / resume page scrolling (e.g. while a full-screen viewer is open)
export function lockScroll(locked) {
  document.documentElement.style.overflow = locked ? 'hidden' : '';
  if (lenis) locked ? lenis.stop() : lenis.start();
}

export function scrollToTop(smooth = false) {
  if (smooth) {
    if (lenis) lenis.scrollTo(0, { duration: 1.6 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  // jump instantly, and stop any smooth-scroll momentum still carrying over from the last page
  window.scrollTo(0, 0);
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
}

export function scrollToElement(el, offset = 0) {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.2 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: 'smooth' });
}

export function onScroll(fn) {
  if (lenis) {
    lenis.on('scroll', fn);
    return () => lenis?.off('scroll', fn);
  }
  window.addEventListener('scroll', fn, { passive: true });
  return () => window.removeEventListener('scroll', fn);
}

/**
 * Builds GSAP animations scoped to `ref`, rebuilt when `deps` change and reverted on unmount.
 * `build({ motion, reduce, mobile })` receives which media conditions match;
 * selectors inside it only match elements within the ref.
 */
export function useScene(ref, build, deps = []) {
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const mm = gsap.matchMedia(ref.current);
    let alive = true;
    // Built one frame later: on a page change the previous page's scroll triggers are still being
    // torn down in this frame, and creating new ones at the same time corrupts ScrollTrigger's
    // internal list (crash: "Cannot read properties of undefined (reading 'pin')").
    const raf = requestAnimationFrame(() => {
      if (!alive || !ref.current) return;
      mm.add(
        {
          motion: '(prefers-reduced-motion: no-preference)',
          reduce: '(prefers-reduced-motion: reduce)',
          mobile: '(max-width: 767px)',
        },
        (ctx) => build(ctx.conditions, ref.current)
      );
    });
    // images and fonts change heights; recalculate trigger positions once things settle
    const t = setTimeout(() => alive && ScrollTrigger.refresh(), 450);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(t);
      mm.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Standard entrances for elements marked with data-reveal inside `root` (play once, never replay):
 *   data-reveal="rise"   words of a .split heading rise from a mask
 *   data-reveal="fade"   fade + small lift
 *   data-reveal="media"  image unmasks from the bottom while settling from 1.12 to 1
 *   data-reveal="list"   children arrive one after another
 */
export function reveals(root) {
  const q = gsap.utils.selector(root);
  // plays the first time the element comes into view and then stays finished. (Not `once: true`:
  // that removes the trigger mid-setup when a page is built while still scrolled, which crashes ScrollTrigger.)
  const once = (el, start = 'top 85%') => ({ trigger: el, start, toggleActions: 'play none none none' });

  q('[data-reveal="rise"]').forEach((el) => {
    gsap.from(el.querySelectorAll('.w > span'), {
      yPercent: 110,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.06,
      scrollTrigger: once(el, 'top 88%'),
    });
  });
  q('[data-reveal="fade"]').forEach((el) => {
    gsap.from(el, { autoAlpha: 0, y: 28, duration: 1, ease: 'power3.out', scrollTrigger: once(el, 'top 90%') });
  });
  q('[data-reveal="media"]').forEach((el) => {
    const img = el.querySelector('img');
    const tl = gsap.timeline({ scrollTrigger: once(el, 'top 88%') });
    tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out' });
    if (img) tl.from(img, { scale: 1.12, duration: 1.6, ease: 'expo.out' }, 0);
  });
  q('[data-reveal="list"]').forEach((el) => {
    gsap.from(el.children, {
      autoAlpha: 0,
      y: 24,
      duration: 0.8,
      ease: 'power3.out',
      stagger: 0.06,
      scrollTrigger: once(el, 'top 88%'),
    });
  });
}
