import { THEME_STORAGE_KEY } from '../utils.js';
import { setMaterialSymbol } from './icons.js';

function readStoredTheme() {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === 'light' || val === 'dark') return val;
  } catch {
    // Ignore SecurityError when localStorage is blocked
  }
  return null;
}

function writeStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore SecurityError when localStorage is blocked
  }
}

function getSystemTheme() {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(theme, { persist = false } = {}) {
  const validTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = validTheme;
  if (persist) {
    writeStoredTheme(validTheme);
  }

  const iconEl = document.getElementById('themeToggleIcon');
  const toggleBtn = document.getElementById('btnThemeToggle');
  if (iconEl) {
    setMaterialSymbol(iconEl, validTheme === 'dark' ? 'light_mode' : 'dark_mode');
  }
  if (toggleBtn) {
    const label = validTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
    toggleBtn.setAttribute('aria-label', label);
    toggleBtn.setAttribute('title', label);
  }
  return validTheme;
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  return applyTheme(next, { persist: true });
}

export function initTheme() {
  const stored = readStoredTheme();
  const initial = stored || getSystemTheme();
  applyTheme(initial, { persist: false });

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', (e) => {
        if (!readStoredTheme()) {
          applyTheme(e.matches ? 'dark' : 'light', { persist: false });
        }
      });
    }
  }
}
