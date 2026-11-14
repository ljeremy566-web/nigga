import { dom } from '../state.js';

let activeResolver = null;
let previousFocusEl = null;

function getFocusableDialogElements(dialogEl) {
  if (!dialogEl) return [];
  return Array.from(
    dialogEl.querySelectorAll(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  );
}

function closeConfirmDialog(accepted) {
  const backdrop = dom.m3ConfirmDialogBackdrop || document.getElementById('m3ConfirmDialogBackdrop');
  const dialog = dom.m3ConfirmDialog || document.getElementById('m3ConfirmDialog');

  if (backdrop) {
    backdrop.classList.add('hidden');
    backdrop.setAttribute('aria-hidden', 'true');
  }
  if (dialog) {
    dialog.classList.add('hidden');
  }

  document.removeEventListener('keydown', handleDialogKeydown, true);

  const resolver = activeResolver;
  activeResolver = null;

  if (previousFocusEl && typeof previousFocusEl.focus === 'function') {
    try {
      previousFocusEl.focus();
    } catch {
      // Ignore focus errors if element was detached
    }
  }
  previousFocusEl = null;

  if (resolver) {
    resolver(Boolean(accepted));
  }
}

function handleDialogKeydown(e) {
  const dialog = dom.m3ConfirmDialog || document.getElementById('m3ConfirmDialog');
  if (!dialog || dialog.classList.contains('hidden')) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    closeConfirmDialog(false);
    return;
  }

  if (e.key === 'Tab') {
    const focusables = getFocusableDialogElements(dialog);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !dialog.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last || !dialog.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }
}

export function initConfirmDialog() {
  const cancelBtn = dom.m3ConfirmCancel || document.getElementById('m3ConfirmCancel');
  const acceptBtn = dom.m3ConfirmAccept || document.getElementById('m3ConfirmAccept');
  const backdrop = dom.m3ConfirmDialogBackdrop || document.getElementById('m3ConfirmDialogBackdrop');

  cancelBtn?.addEventListener('click', () => closeConfirmDialog(false));
  acceptBtn?.addEventListener('click', () => closeConfirmDialog(true));
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeConfirmDialog(false);
    }
  });
}

export function openConfirmDialog({
  title = 'Confirmar acción',
  body = '¿Deseas continuar con esta operación?',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
} = {}) {
  const backdrop = dom.m3ConfirmDialogBackdrop || document.getElementById('m3ConfirmDialogBackdrop');
  const dialog = dom.m3ConfirmDialog || document.getElementById('m3ConfirmDialog');
  const titleEl = dom.m3ConfirmTitle || document.getElementById('m3ConfirmTitle');
  const bodyEl = dom.m3ConfirmBody || document.getElementById('m3ConfirmBody');
  const cancelBtn = dom.m3ConfirmCancel || document.getElementById('m3ConfirmCancel');
  const acceptBtn = dom.m3ConfirmAccept || document.getElementById('m3ConfirmAccept');

  if (!dialog || !backdrop) {
    return Promise.resolve(true);
  }

  if (activeResolver) {
    closeConfirmDialog(false);
  }

  previousFocusEl = document.activeElement;

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = body;
  if (cancelBtn) cancelBtn.textContent = cancelLabel;
  if (acceptBtn) acceptBtn.textContent = confirmLabel;

  backdrop.classList.remove('hidden');
  backdrop.setAttribute('aria-hidden', 'false');
  dialog.classList.remove('hidden');
  dialog.setAttribute('aria-modal', 'true');

  document.addEventListener('keydown', handleDialogKeydown, true);

  return new Promise((resolve) => {
    activeResolver = resolve;
    acceptBtn?.focus();
  });
}
