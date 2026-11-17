export const ROUTES = {
  HOME: '/',
  HEALTH: '/health',
  ROADMAP: '/api/roadmap',
  ROADMAP_GENERATE: '/api/roadmap/generate',
  ROADMAP_STATUS: (id) => `/api/roadmap/${encodeURIComponent(id)}/status`,
  YOUTUBE_SEARCH: '/api/youtube/search',
  YOUTUBE_HISTORY: '/api/youtube/history',
  VIDEOS: '/api/videos',
  ORACLE_RUN: '/api/oracle/run-now',
  ORACLE_STATUS: '/api/oracle/status',
};

export const STORAGE_KEYS = {
  THEME: 'content_studio_theme_v1',
  DRAFTS: 'content_studio_drafts_v1',
};

export const VIEWPORTS = {
  DESKTOP: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  TABLET: { width: 900, height: 800, deviceScaleFactor: 1, mobile: false },
  RAIL_MIN: { width: 840, height: 800, deviceScaleFactor: 1, mobile: false },
  BAR_MAX: { width: 839, height: 800, deviceScaleFactor: 1, mobile: false },
  MOBILE: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
  NARROW_MOBILE: { width: 320, height: 568, deviceScaleFactor: 2, mobile: true },
  WIDE_DESKTOP: { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false },
};

export const SELECTORS = {
  // Shell, Theme, Tabs & Badges
  btnThemeToggle: '#btnThemeToggle',
  tabRoadmap: '#tab-roadmap',
  tabYoutube: '#tab-youtube',
  tabOracle: '#tab-oracle',
  viewRoadmap: '#view-roadmap',
  viewYoutube: '#view-youtube',
  viewOracle: '#view-oracle',
  statusHealthBadge: '#statusHealthBadge',
  statusOracleBadge: '#statusOracleBadge',
  statusSourceBadge: '#statusSourceBadge',

  // Roadmap Command & Progress
  nicheInput: '#nicheInput',
  igAccountInput: '#igAccountInput',
  btnLoadRoadmap: '#btnLoadRoadmap',
  btnGenerateRoadmap: '#btnGenerateRoadmap',
  btnRunOracle: '#btnRunOracle',
  btnExportCsv: '#btnExportCsv',
  btnExportJson: '#btnExportJson',
  roadmapSourceNotice: '#roadmapSourceNotice',
  roadmapLinearProgress: '#roadmapLinearProgress',
  progressSummaryText: '#progressSummaryText',
  progressFill: '#progressFill',
  countTotal: '#countTotal',
  countPendiente: '#countPendiente',
  countGrabado: '#countGrabado',
  countEditado: '#countEditado',
  countPublicado: '#countPublicado',

  // Filters & List
  weekFilterGroup: '#weekFilterGroup',
  btnWeekAll: '#btnWeekAll',
  btnWeek1: '#btnWeek1',
  btnWeek2: '#btnWeek2',
  btnWeek3: '#btnWeek3',
  btnWeek4: '#btnWeek4',
  searchRoadmapInput: '#searchRoadmapInput',
  formatFilterSelect: '#formatFilterSelect',
  statusFilterSelect: '#statusFilterSelect',
  viewModeGrid: '#viewModeGrid',
  viewModeTimeline: '#viewModeTimeline',
  btnResetFilters: '#btnResetFilters',
  roadmapList: '#roadmapList',
  roadmapEmptyState: '#roadmapEmptyState',
  btnEmptyResetFilters: '#btnEmptyResetFilters',
  dayCard: '.day-card',
  dayCardByNum: (n) => `#day-card-${n}`,
  cardStatusByNum: (n) => `[data-card-status="${n}"]`,

  // Day Inspector
  dayInspector: '#dayInspector',
  inspectorBackdrop: '#inspectorBackdrop',
  inspectorDayBadge: '#inspectorDayBadge',
  inspectorWeekBadge: '#inspectorWeekBadge',
  inspectorFormatBadge: '#inspectorFormatBadge',
  inspectorPillarBadge: '#inspectorPillarBadge',
  localDraftBadge: '#localDraftBadge',
  btnPrevDay: '#btnPrevDay',
  btnNextDay: '#btnNextDay',
  btnToggleEditMode: '#btnToggleEditMode',
  btnCloseDrawer: '#btnCloseDrawer',
  dayInspectorContent: '#dayInspectorContent',
  inspectorStatusGroup: '#inspectorStatusGroup',
  statusBtn: (s) => `#statusBtn-${s}`,
  inspectorTitle: '#inspectorTitle',
  btnCopyHook: '#btnCopyHook',
  inspectorHook: '#inspectorHook',
  btnCopyPrompt: '#btnCopyPrompt',
  visualAspectFrame: '#visualAspectFrame',
  visualFrameDay: '#visualFrameDay',
  visualFrameFormat: '#visualFrameFormat',
  visualRatioLabel: '#visualRatioLabel',
  visualCompositionTip: '#visualCompositionTip',
  visualRefThumb: '#visualRefThumb',
  inspectorImagePrompt: '#inspectorImagePrompt',
  btnCopyScript: '#btnCopyScript',
  inspectorScript: '#inspectorScript',
  btnCopyCaption: '#btnCopyCaption',
  inspectorCaption: '#inspectorCaption',
  inspectorHashtags: '#inspectorHashtags',
  inspectorYoutubeRef: '#inspectorYoutubeRef',
  inspectorRefLink: '#inspectorRefLink',
  draftEditorForm: '#draftEditorForm',
  editHookInput: '#editHookInput',
  editPromptInput: '#editPromptInput',
  editScriptInput: '#editScriptInput',
  editCaptionInput: '#editCaptionInput',
  btnResetDraft: '#btnResetDraft',
  btnCancelDraft: '#btnCancelDraft',
  btnSaveDraft: '#btnSaveDraft',

  // Dialog & Snackbar
  m3ConfirmDialog: '#m3ConfirmDialog',
  m3ConfirmTitle: '#m3ConfirmTitle',
  m3ConfirmBody: '#m3ConfirmBody',
  m3ConfirmCancel: '#m3ConfirmCancel',
  m3ConfirmAccept: '#m3ConfirmAccept',
  toastContainer: '#toastContainer',

  // YouTube
  ytSearchForm: '#ytSearchForm',
  ytSearchInput: '#ytSearchInput',
  ytMaxResultsSelect: '#ytMaxResultsSelect',
  btnYtSearch: '#btnYtSearch',
  ytHistoryList: '#ytHistoryList',
  ytHistoryChip: '.history-chip[data-history-query]',
  ytResultsSection: '#ytResultsSection',
  ytResultsList: '#ytResultsList',
  ytVideosGrid: '#ytVideosGrid',
  useTopicBtn: '[data-use-topic]',

  // Oracle
  oracleHealthCard: '#oracleHealthCard',
  healthStatusText: '#healthStatusText',
  healthUptimeText: '#healthUptimeText',
  oracleLastRunCard: '#oracleLastRunCard',
  oracleLastStatus: '#oracleLastStatus',
  oracleLastTimestamp: '#oracleLastTimestamp',
  oracleLastDetails: '#oracleLastDetails',
  btnOracleTabRun: '#btnOracleTabRun',
  dataTruthGrid: '#dataTruthGrid',
  truthCardYoutube: '#truthCard-youtube',
  truthCardGemini: '#truthCard-gemini',
  truthCardSupabase: '#truthCard-supabase',
  truthCardInstagram: '#truthCard-instagram',
};

export const VALID_STATUSES = ['pendiente', 'grabado', 'editado', 'publicado'];

export const STATUS_LABELS = {
  pendiente: 'Pendiente',
  grabado: 'Grabado',
  editado: 'Editado',
  publicado: 'Publicado',
};

export const WEEK_LABELS = [
  'Semana 1 · Atracción y Disrupción',
  'Semana 2 · Autoridad y Educación',
  'Semana 3 · Comunidad y Confianza',
  'Semana 4 · Conversión y Oferta',
];

export const CSV_HEADERS_COUNT = 14;
export const DEFAULT_NICHE = 'General';
export const DEFAULT_IG_ACCOUNT = '';

export const M3_TOKENS = {
  colors: [
    '--md-sys-color-primary',
    '--md-sys-color-on-primary',
    '--md-sys-color-primary-container',
    '--md-sys-color-on-primary-container',
    '--md-sys-color-secondary',
    '--md-sys-color-on-secondary',
    '--md-sys-color-secondary-container',
    '--md-sys-color-on-secondary-container',
    '--md-sys-color-tertiary',
    '--md-sys-color-on-tertiary',
    '--md-sys-color-tertiary-container',
    '--md-sys-color-on-tertiary-container',
    '--md-sys-color-error',
    '--md-sys-color-on-error',
    '--md-sys-color-error-container',
    '--md-sys-color-on-error-container',
    '--md-sys-color-surface',
    '--md-sys-color-surface-dim',
    '--md-sys-color-surface-bright',
    '--md-sys-color-surface-container-lowest',
    '--md-sys-color-surface-container-low',
    '--md-sys-color-surface-container',
    '--md-sys-color-surface-container-high',
    '--md-sys-color-surface-container-highest',
    '--md-sys-color-on-surface',
    '--md-sys-color-on-surface-variant',
    '--md-sys-color-outline',
    '--md-sys-color-outline-variant',
    '--md-sys-color-inverse-surface',
    '--md-sys-color-inverse-on-surface',
    '--md-sys-color-inverse-primary',
    '--md-sys-color-scrim',
  ],
  statusColors: [
    '--md-ext-color-status-pendiente-bg',
    '--md-ext-color-status-pendiente-fg',
    '--md-ext-color-status-grabado-bg',
    '--md-ext-color-status-grabado-fg',
    '--md-ext-color-status-editado-bg',
    '--md-ext-color-status-editado-fg',
    '--md-ext-color-status-publicado-bg',
    '--md-ext-color-status-publicado-fg',
  ],
  shapes: [
    '--md-sys-shape-corner-none',
    '--md-sys-shape-corner-extra-small',
    '--md-sys-shape-corner-small',
    '--md-sys-shape-corner-medium',
    '--md-sys-shape-corner-large',
    '--md-sys-shape-corner-extra-large',
    '--md-sys-shape-corner-full',
  ],
  elevations: [
    '--md-sys-elevation-level0',
    '--md-sys-elevation-level1',
    '--md-sys-elevation-level2',
    '--md-sys-elevation-level3',
    '--md-sys-elevation-level4',
    '--md-sys-elevation-level5',
  ],
  motion: [
    '--md-sys-motion-easing-standard',
    '--md-sys-motion-easing-emphasized',
    '--md-sys-motion-easing-emphasized-decelerate',
    '--md-sys-motion-easing-emphasized-accelerate',
    '--md-sys-motion-duration-short1',
    '--md-sys-motion-duration-medium1',
    '--md-sys-motion-duration-long1',
  ],
  state: [
    '--md-sys-state-hover-opacity',
    '--md-sys-state-focus-opacity',
    '--md-sys-state-pressed-opacity',
    '--md-sys-state-dragged-opacity',
  ],
};

/**
 * Strict RFC-4180 CSV parser supporting UTF-8 BOM, quoted fields, escaped `""`, and embedded CRLF/LF.
 */
export function parseRfc4180Csv(bufferOrText) {
  let hasBom = false;
  let text;
  if (Buffer.isBuffer(bufferOrText)) {
    hasBom =
      bufferOrText.length >= 3 &&
      bufferOrText[0] === 0xef &&
      bufferOrText[1] === 0xbb &&
      bufferOrText[2] === 0xbf;
    text = (hasBom ? bufferOrText.subarray(3) : bufferOrText).toString('utf8');
  } else {
    text = String(bufferOrText);
    if (text.startsWith('\uFEFF')) {
      hasBom = true;
      text = text.slice(1);
    }
  }

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (inQuotes) {
    throw new Error('Malformed RFC-4180 CSV: unterminated quoted field');
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return { hasBom, rows };
}

export function parseCssColor(colorStr) {
  if (!colorStr) return null;
  const s = colorStr.trim().toLowerCase();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)/);
  if (!m) return null;
  return {
    r: Math.round(Number(m[1])),
    g: Math.round(Number(m[2])),
    b: Math.round(Number(m[3])),
    a: m[4] !== undefined ? Number(m[4]) : 1,
  };
}

export function relativeLuminance(rgb) {
  if (!rgb) return 0;
  const toLinear = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

export function makeUniqueNiche(prefix = 'E2E Niche') {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeMockRoadmap(niche = DEFAULT_NICHE, overridesByDay = {}) {
  const formats = ['Reel', 'Carrusel', 'Story'];
  const pillars = ['Educación', 'Autoridad', 'Comunidad', 'Conversión'];
  const roadmap = [];

  for (let day = 1; day <= 30; day++) {
    const week = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
    const base = {
      id: `00000000-0000-4000-8000-${String(day).padStart(12, '0')}`,
      day_number: day,
      week_number: week,
      niche,
      content_pillar: pillars[(day - 1) % pillars.length],
      format: formats[(day - 1) % formats.length],
      title: `Contenido Día ${day} sobre ${niche}`,
      hook: `Gancho Día ${day}: descubre cómo dominar ${niche}`,
      script: `Guion completo del Día ${day} para ${niche}. Paso 1, Paso 2, CTA.`,
      image_prompt: `Editorial minimal visual for day ${day} about ${niche}, natural light`,
      caption: `Caption del día ${day} para ${niche}. Guarda este post.`,
      hashtags: ['#ContentStudio', `#Dia${day}`, '#Estrategia'],
      status: 'pendiente',
      reference_video_id: `demo_yt_0${((day - 1) % 3) + 1}`,
    };
    roadmap.push({ ...base, ...(overridesByDay[day] || {}) });
  }
  return roadmap;
}

export function makeMockVideos(count = 6, prefix = 'E2E Video') {
  const videos = [];
  for (let i = 1; i <= count; i++) {
    videos.push({
      videoId: i === 1 ? 'dQw4w9WgXcQ' : `mock_vid_${String(i).padStart(2, '0')}`,
      title: `${prefix} #${i}`,
      channelTitle: `Creator Channel ${i}`,
      publishedAt: '2026-11-10T12:00:00.000Z',
      thumbnailUrl: `https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg`,
      viewCount: 15000 * i,
      description: `Descripción del video ${i} sobre tendencias de contenido.`,
    });
  }
  return videos;
}

export function rectsOverlap(a, b, tolerance = 1) {
  return !(
    a.right <= b.left + tolerance ||
    b.right <= a.left + tolerance ||
    a.bottom <= b.top + tolerance ||
    b.bottom <= a.top + tolerance
  );
}
