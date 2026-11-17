export const DEFAULT_NICHE = 'Inteligencia Artificial y Productividad';
export const DEFAULT_IG_ACCOUNT = '@creatorshub';
export const DEFAULT_IG_NICHE = 'Cosmetología y Estética Facial';
export const DEFAULT_IG_MAIN_ACCOUNT = '@ssabeaute';
export const DRAFT_STORAGE_KEY = 'content_studio_drafts_v1';
export const IG_DRAFT_STORAGE_KEY = 'content_studio_ig_drafts_v1';
export const THEME_STORAGE_KEY = 'content_studio_theme_v1';
export const STATUS_OPTIONS = ['pendiente', 'grabado', 'editado', 'publicado'];

export const STATUS_LABELS = {
  pendiente: 'Pendiente',
  grabado: 'Grabado',
  editado: 'Editado',
  publicado: 'Publicado',
};

export const WEEK_LABELS = {
  1: 'Semana 1 · Atracción y Disrupción',
  2: 'Semana 2 · Autoridad y Educación',
  3: 'Semana 3 · Comunidad y Confianza',
  4: 'Semana 4 · Conversión y Oferta',
};

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const desktopMq = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(min-width: 1024px)')
  : null;

export function getDesktopMediaQuery() {
  return desktopMq;
}

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

export function sanitizeHttpUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(String(url), window.location.origin);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
  } catch {
    return '';
  }
}

export function isDesktop() {
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= 1024;
}

export function prefersReducedMotion() {
  return Boolean(
    typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function padDay(n) {
  return String(Number(n) || 1).padStart(2, '0');
}

export function formatStatusLabel(status) {
  const key = String(status || 'pendiente').toLowerCase();
  return STATUS_LABELS[key] || STATUS_LABELS.pendiente;
}

export function slugify(value) {
  return (
    String(value || 'roadmap')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'roadmap'
  );
}

export function formatUptime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m ${rem}s`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function triggerDownload(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
