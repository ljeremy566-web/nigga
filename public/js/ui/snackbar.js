import { escapeHtml } from '../utils.js';

let activeDismissTimer = null;

/**
 * Single-slot M3 Snackbar queue inside #toastContainer.
 * Replaces any active snackbar immediately so toasts never stack.
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  if (activeDismissTimer) {
    clearTimeout(activeDismissTimer);
    activeDismissTimer = null;
  }

  // Enforce single-slot M3 Snackbar contract
  container.innerHTML = '';

  const snackbar = document.createElement('div');
  const modifier =
    type === 'success'
      ? 'md-snackbar--success toast--success'
      : type === 'error'
        ? 'md-snackbar--error toast--error'
        : '';
  snackbar.className = `md-snackbar toast ${modifier}`.trim();
  snackbar.setAttribute('role', 'status');
  snackbar.innerHTML = `<span class="md-snackbar__text">${escapeHtml(message)}</span>`;
  container.appendChild(snackbar);

  activeDismissTimer = setTimeout(() => {
    activeDismissTimer = null;
    if (snackbar.parentNode === container) {
      snackbar.remove();
    }
  }, 2600);
}
