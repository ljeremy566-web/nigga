import { prefersReducedMotion } from '../utils.js';

const swapTokens = new WeakMap();

export function transitionSwap(el, renderFn, durationMs = 90) {
  if (!el) return Promise.resolve(false);
  const nextToken = (swapTokens.get(el) || 0) + 1;
  swapTokens.set(el, nextToken);

  if (prefersReducedMotion() || durationMs <= 0) {
    el.classList.remove('fade-out', 'fade-in');
    renderFn(el);
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    renderFn(el);
    if (swapTokens.get(el) !== nextToken) {
      resolve(false);
      return;
    }
    el.classList.remove('fade-out', 'fade-in');
    void el.offsetWidth;
    el.classList.add('fade-in');
    resolve(true);
  });
}
