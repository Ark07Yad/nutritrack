/**
 * Motion primitives.
 *
 * Three ideas, all hand-rolled on requestAnimationFrame and the Web Animations
 * API rather than pulling in a motion library — the rest of this app has no UI
 * dependencies and these are small enough not to start.
 *
 * The governing rule: animate *transitions and rare moments*, keep *routine
 * confirmations* instant. Logging food is repetitive, and a flourish that
 * delights on the first log is an irritation by the twentieth. So numbers
 * tween, lists reflow, and lists stagger on arrival — but tapping "add" still
 * feels immediate.
 *
 * Everything here collapses to a no-op under `prefers-reduced-motion`.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ───────────────────────────── Number tweening ───────────────────────────── */

/** Ease-out cubic: fast start, gentle settle — reads as "landing" on a value. */
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Tween a number toward its target.
 *
 * Retargets mid-flight rather than restarting, so a value that changes twice in
 * quick succession — adding two foods in a row — flows to the new total instead
 * of snapping back and starting again.
 */
export function useCountUp(value, { duration = 550, decimals = 0 } = {}) {
  const target = Number.isFinite(value) ? value : 0;
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const startedAt = useRef(0);
  const raf = useRef(0);
  const current = useRef(target);

  useEffect(() => {
    // requestAnimationFrame is also paused while the document is hidden. Here
    // that only affects what is drawn rather than any stored value, but a tween
    // frozen mid-count would show a stale number the moment you switch back, so
    // snap instead.
    const invisible = typeof document !== 'undefined' && document.visibilityState === 'hidden';

    if (prefersReducedMotion() || duration <= 0 || invisible) {
      current.current = target;
      setShown(target);
      return;
    }

    // A first paint should show the real number, not count up from zero on
    // every page load — that would be theatre, not feedback.
    if (startedAt.current === 0 && current.current === target) {
      setShown(target);
      return;
    }

    from.current = current.current;
    startedAt.current = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - startedAt.current) / duration);
      const v = from.current + (target - from.current) * easeOut(t);
      current.current = v;
      setShown(v);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };

    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  const factor = 10 ** decimals;
  return Math.round(shown * factor) / factor;
}

/* ──────────────────────────────── Stagger ──────────────────────────────── */

/**
 * Inline style for the nth item in an entering list.
 *
 * Capped, because a stagger that keeps growing means the last row of a long
 * list arrives long after you have started reading — the effect should suggest
 * order, not make you wait for it.
 */
export function stagger(index, { step = 40, max = 320 } = {}) {
  if (prefersReducedMotion()) return undefined;
  return { animationDelay: `${Math.min(index * step, max)}ms` };
}

/* ────────────────────────────────── FLIP ────────────────────────────────── */

/**
 * Animate list reflow — First, Last, Invert, Play.
 *
 * Without this, deleting a diary row makes everything below it jump. The rows
 * are measured before and after the update, then animated from where they were
 * to where they now are, which is what makes a list feel like objects rather
 * than a redrawn table.
 *
 * Children opt in with `data-flip-key`. Entering rows fade in; leaving rows are
 * handled by `animateOut` below, because by the time React has removed a node
 * there is nothing left to animate.
 */
export function useFlipList(deps = []) {
  const ref = useRef(null);
  const prev = useRef(new Map());

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const nodes = [...root.querySelectorAll('[data-flip-key]')];
    const next = new Map();
    for (const node of nodes) next.set(node.dataset.flipKey, node.getBoundingClientRect());

    if (!prefersReducedMotion()) {
      for (const node of nodes) {
        const key = node.dataset.flipKey;
        const before = prev.current.get(key);
        const after = next.get(key);

        if (before) {
          const dy = before.top - after.top;
          if (Math.abs(dy) > 1) {
            node.animate(
              [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
              { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            );
          }
        } else if (prev.current.size > 0) {
          // New arrival — but only animate once the list has been seen, so the
          // first render does not flash every row in.
          node.animate(
            [
              { opacity: 0, transform: 'translateY(-6px) scale(0.98)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
          );
        }
      }
    }

    prev.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Collapse a row, then run the removal.
 *
 * React cannot animate an element it has already unmounted, so deletion is
 * inverted: play the animation first, dispatch when it finishes. The height is
 * animated to zero as well as the opacity, otherwise the rows below snap up
 * while this one is still fading.
 */
export function animateOut(node, done, { duration = 220 } = {}) {
  // Run exactly once, whatever happens. `done` mutates state, so a missed call
  // means the row is never actually deleted and a double call could remove the
  // wrong thing later.
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    done();
  };

  // A hidden document does not advance animations at all: playState stays
  // "running", currentTime stays 0, and onfinish never fires. Gating a delete
  // on that callback would silently drop the delete for anyone whose tab was
  // backgrounded. There is also nothing to look at, so skip straight to it.
  const invisible = typeof document !== 'undefined' && document.visibilityState === 'hidden';

  if (!node || invisible || prefersReducedMotion()) {
    finish();
    return;
  }

  const { height } = node.getBoundingClientRect();
  const anim = node.animate(
    [
      { height: `${height}px`, opacity: 1, transform: 'none' },
      { height: '0px', opacity: 0, transform: 'translateX(-12px)' },
    ],
    { duration, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }
  );

  node.style.overflow = 'hidden';
  anim.onfinish = finish;
  anim.oncancel = finish;

  // Belt and braces: if the tab is hidden mid-animation, or the browser
  // throttles it, the timer still lands. The animation stays decorative — it
  // never decides whether the delete happens.
  setTimeout(finish, duration + 80);
}

/* ───────────────────────────── Pointer spotlight ─────────────────────────────
 *
 * One listener for the whole app, not one per card. It finds the card under
 * the pointer and hands its coordinates to CSS as --mx/--my; the gradient
 * itself is drawn by the `spotlight` utility in index.css.
 *
 * Skipped entirely on devices that cannot hover and when motion is reduced —
 * there the utility's ::before simply never becomes visible.
 */
export function installSpotlight() {
  if (typeof window === 'undefined') return () => {};
  if (!window.matchMedia('(hover: hover)').matches || prefersReducedMotion()) return () => {};

  let frame = 0;
  let last = null;

  const paint = () => {
    frame = 0;
    if (!last) return;
    const card = last.target instanceof Element ? last.target.closest('.spotlight') : null;
    if (!card) return;
    const box = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${last.x - box.left}px`);
    card.style.setProperty('--my', `${last.y - box.top}px`);
  };

  // At most one write per frame however fast the pointer moves.
  const onMove = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    last = { target: e.target, x: e.clientX, y: e.clientY };
    if (!frame) frame = requestAnimationFrame(paint);
  };

  document.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    document.removeEventListener('pointermove', onMove);
    if (frame) cancelAnimationFrame(frame);
  };
}

/* ───────────────────────────────── Haptics ─────────────────────────────────
 *
 * A short tick when something is confirmed — a food logged, a milestone hit.
 * Reserved for confirmations: a phone that buzzes on every tap is worse than
 * one that never does. Not available on iOS Safari, where this is a no-op.
 */
export function haptic(pattern = 8) {
  try {
    if (prefersReducedMotion()) return;
    // Browsers refuse to vibrate before the first tap and log a warning each
    // time they do. A confirmation that arrives without one — a milestone
    // noticed on launch — simply goes without.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(pattern);
  } catch {
    /* blocked without a user gesture, or unsupported — nothing to do */
  }
}

/* ──────────────────────────── Whole-page transition ────────────────────────────
 *
 * Runs `update` inside a view transition where the browser has them, so a
 * theme switch cross-fades rather than snapping.
 *
 * `update` always runs, exactly once, whatever the transition does. The API
 * is allowed to skip, reject or never start — a hidden tab is one way — and a
 * theme that failed to change because an animation did not play would be a
 * far worse bug than a theme that changed without one.
 */
export function withViewTransition(update) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    update();
  };

  const supported =
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function' &&
    document.visibilityState === 'visible' &&
    !prefersReducedMotion();

  if (!supported) return run();

  try {
    const transition = document.startViewTransition(run);
    transition.ready?.catch(() => {});
    transition.finished?.catch(() => {});
  } catch {
    /* fall through to the guard below */
  }
  // The callback is normally invoked within a frame. If it has not been, do
  // the work anyway.
  setTimeout(run, 250);
}
