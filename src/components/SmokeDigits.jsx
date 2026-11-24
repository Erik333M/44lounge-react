import { useEffect, useRef } from 'react';
import { asset } from '../asset.js';

/* The hero "44": two transparent digits, each filled with its own pass of the smoke video
   (the second one offset in time). Outside the digits the screen stays dark, so the numbers
   are drawn only by the smoke moving inside them.

   Drawn on a canvas because browsers can't clip a video to the shape of a text glyph otherwise.
   `state` is shared with the hero's scroll animation: { scale, paused }. */

const FADE = 1.2; // seconds of crossfade between loop passes, so the restart is never visible

// One endlessly looping smoke source made of two copies of the clip that crossfade before the end.
class SmokeSource {
  constructor(src, offset, host) {
    this.offset = offset;
    this.front = 0;
    this.fadeStart = -Infinity;
    this.videos = [0, 1].map(() => {
      const v = document.createElement('video');
      v.src = src;
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.preload = 'auto';
      host.appendChild(v);
      return v;
    });
    const first = this.videos[0];
    const start = () => {
      first.currentTime = Math.min(offset, (first.duration || offset + 1) - FADE - 0.1);
      first.play().catch(() => {});
    };
    if (first.readyState >= 1) start();
    else first.addEventListener('loadedmetadata', start, { once: true });
  }

  update(now) {
    const f = this.videos[this.front];
    const b = this.videos[1 - this.front];
    const d = f.duration;
    if (d && f.currentTime >= d - FADE && b.paused) {
      b.currentTime = 0;
      b.play().catch(() => {});
      this.front = 1 - this.front;
      this.fadeStart = now;
      setTimeout(() => f.pause(), FADE * 1000 + 150);
    }
  }

  // draws the current smoke frame (blending the two passes while they overlap) into rect
  draw(ctx, rect, now) {
    const t = Math.min(1, (now - this.fadeStart) / (FADE * 1000));
    const cur = this.videos[this.front];
    const old = this.videos[1 - this.front];
    if (t < 1) drawCover(ctx, old, rect, 1);
    drawCover(ctx, cur, rect, t < 1 ? t : 1);
  }

  pause() {
    this.videos.forEach((v) => v.pause());
  }

  // width / height of the clip (0 until it is known)
  aspect() {
    const v = this.videos[this.front];
    return v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 0;
  }

  // Asks the front video to play. Phones may refuse or pause it on their own (iPhone Safari won't start a
  // silent video it considers hidden, and pauses videos when the tab is in the background), so this is
  // called every frame and retries about once a second until the video really runs.
  play(now = performance.now()) {
    const v = this.videos[this.front];
    if (!v.paused || now - (this.lastTry || 0) < 900) return;
    this.lastTry = now;
    if (v.ended || (v.duration && v.currentTime >= v.duration - 0.05)) v.currentTime = 0;
    v.play().catch(() => {});
  }

  destroy() {
    this.videos.forEach((v) => {
      v.pause();
      v.removeAttribute('src');
      v.load();
      v.remove();
    });
  }
}

function drawCover(ctx, video, { x, y, w, h }, alpha) {
  if (video.readyState < 2 || !video.videoWidth) return;
  const vr = video.videoWidth / video.videoHeight;
  const rr = w / h;
  let dw = w;
  let dh = h;
  if (vr > rr) dw = h * vr;
  else dh = w / vr;
  ctx.globalAlpha = alpha;
  ctx.drawImage(video, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.globalAlpha = 1;
}

// Where the digits go: side by side on wide screens, stacked on tall phone screens.
function layout(ctx, w, h, family) {
  const portrait = w / h < 0.8;
  ctx.font = `700 100px ${family}`;
  const m = ctx.measureText('4');
  const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const gap = 6; // at size 100
  let size;
  if (portrait) size = Math.min((w * 0.8) / inkW, (h * 0.74) / (inkH * 2 + gap)) * 100;
  else size = Math.min((w * 0.74) / (inkW * 2 + gap), (h * 0.62) / inkH) * 100;
  const k = size / 100;
  const dW = inkW * k;
  const dH = inkH * k;
  const g = gap * k;
  const centers = portrait
    ? [
        [w / 2, h / 2 - (dH + g) / 2],
        [w / 2, h / 2 + (dH + g) / 2],
      ]
    : [
        [w / 2 - (dW + g) / 2, h / 2],
        [w / 2 + (dW + g) / 2, h / 2],
      ];
  return centers.map(([cx, cy]) => ({
    size,
    // fillText position for a glyph whose ink box is centred on (cx, cy)
    x: cx - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) * k / 2,
    y: cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) * k / 2,
    box: { x: cx - dW / 2, y: cy - dH / 2, w: dW, h: dH },
  }));
}

export default function SmokeDigits({ src, state, offsets = [0, 5], className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const off = document.createElement('canvas');
    const octx = off.getContext('2d');
    // phones: the smoke of each digit is mixed here first (two columns), then clipped to the digit
    const mix = document.createElement('canvas');
    const mctx = mix.getContext('2d');
    // The video elements only feed the canvas. They live directly in <body>, fixed on screen and almost
    // transparent: inside the hero they would be hidden together with the 44 while scrolling, and iPhone
    // Safari then refuses to resume them when the 44 comes back (frozen smoke after scrolling up).
    const host = document.createElement('div');
    host.className = 'smoke-sources';
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
    const sources = offsets.map((o) => new SmokeSource(asset(src), o, host));
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'sans-serif';
    let w = 0;
    let h = 0;
    let dpr = 1;
    let digits = [];
    let raf = 0;
    let portrait = false;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      portrait = w / h < 0.8;
      for (const c of [canvas, off, mix]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      digits = layout(ctx, w, h, family);
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      // The videos keep playing while the page is open, even when the 44 is scrolled away: pausing and
      // resuming is what phones (iPhone Safari) get wrong, leaving frozen smoke after scrolling back up.
      // Only the drawing stops while the 44 can't be seen.
      sources.forEach((s) => {
        s.play(now);
        s.update(now);
      });
      if (state.paused) return;

      const sc = state.scale || 1;
      // zoom around the screen centre (the scroll "fly-through"), applied while drawing so edges stay sharp
      const zoom = (c) => {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.translate(w / 2, h / 2);
        c.scale(sc, sc);
        c.translate(-w / 2, -h / 2);
      };
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // nothing to draw while the hero has no size (e.g. inside a hidden admin preview)
      if (!canvas.width || !canvas.height || !off.width || !off.height || !mix.width || !mix.height) return;

      digits.forEach((d, i) => {
        const font = `700 ${d.size}px ${family}`;
        const smoke = sources[i];

        // faint body so the shape is just perceptible between smoke wisps
        zoom(ctx);
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = font;
        ctx.fillStyle = 'rgba(242, 234, 223, 0.07)';
        ctx.fillText('4', d.x, d.y);

        // smoke clipped to the digit (offscreen), then added with "screen" so the video's black stays see-through
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.clearRect(0, 0, off.width, off.height);
        zoom(octx);
        octx.globalCompositeOperation = 'source-over';
        octx.font = font;
        octx.fillStyle = '#fff';
        octx.fillText('4', d.x, d.y);
        octx.globalCompositeOperation = 'source-in';
        octx.filter = 'brightness(1.35) contrast(1.1)';
        if (portrait) {
          // Phones: the video is tall and its smoke is a narrow column, so filling a whole digit from one copy
          // blows the smoke up. Instead two finer columns side by side: this digit's smoke, and the other
          // digit's smoke mirrored (so the two 4s still look different from each other).
          const aspect = smoke.aspect() || 9 / 16;
          const th = d.box.h * 1.6;
          const tw = th * aspect;
          const cx = d.box.x + d.box.w / 2;
          const ty = d.box.y + d.box.h / 2 - th / 2;
          const shift = d.box.w * 0.2;
          mctx.setTransform(1, 0, 0, 1, 0, 0);
          mctx.clearRect(0, 0, mix.width, mix.height);
          zoom(mctx);
          mctx.globalCompositeOperation = 'screen';
          smoke.draw(mctx, { x: cx - shift - tw / 2, y: ty, w: tw, h: th }, now);
          mctx.save();
          mctx.translate(cx + shift, 0);
          mctx.scale(-1, 1);
          sources[1 - i].draw(mctx, { x: -tw / 2, y: ty, w: tw, h: th }, now);
          mctx.restore();
          mctx.globalCompositeOperation = 'source-over';
          octx.setTransform(1, 0, 0, 1, 0, 0);
          octx.drawImage(mix, 0, 0);
        } else {
          // smoke frame enlarged around the digit so the wisps fill more of the shape
          const grow = 0.35;
          smoke.draw(octx, { x: d.box.x - d.box.w * grow, y: d.box.y - d.box.h * grow * 0.4, w: d.box.w * (1 + grow * 2), h: d.box.h * (1 + grow * 0.8) }, now);
        }
        octx.filter = 'none';

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(off, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
      });
    };

    let ro;
    (document.fonts?.load(`700 100px ${family}`) || Promise.resolve()).finally(() => {
      resize();
      ro = new ResizeObserver(resize);
      ro.observe(canvas);
      raf = requestAnimationFrame(frame);
    });

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      sources.forEach((s) => s.destroy());
      host.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
