import {
  DEFAULT_IG_ACCOUNT,
  DEFAULT_NICHE,
  DRAFT_STORAGE_KEY,
  STATUS_OPTIONS,
  slugify,
  sanitizeHttpUrl,
} from './utils.js';
import { showToast } from './ui/snackbar.js';

export const state = {
  activeTab: 'roadmap',
  niche: DEFAULT_NICHE,
  igAccount: DEFAULT_IG_ACCOUNT,
  roadmap: [],
  roadmapIsFallback: false,
  selectedDay: 1,
  viewMode: 'grid',
  filters: {
    week: 'all',
    format: 'all',
    status: 'all',
    query: '',
  },
  isEditingDraft: false,
  isDrawerOpen: false,
  lastDrawerTrigger: null,
  statusUpdatingDay: null,
  loading: {
    roadmap: false,
    generate: false,
    oracle: false,
    youtubeSearch: false,
  },
  health: null,
  oracleStatus: null,
  oracleError: false,
  youtubeSearchResults: [],
  youtubeStoredVideos: [],
  youtubeHistory: [],
  youtubeTabLoaded: false,
};

export const dom = {};

export function cacheDom() {
  const ids = [
    'tab-roadmap', 'tab-youtube', 'tab-oracle',
    'statusHealthBadge', 'statusOracleBadge', 'statusSourceBadge',
    'btnThemeToggle', 'themeToggleIcon',
    'view-roadmap', 'view-youtube', 'view-oracle',
    'nicheInput', 'igAccountInput', 'btnLoadRoadmap', 'btnGenerateRoadmap', 'btnRunOracle',
    'btnExportCsv', 'btnExportJson', 'roadmapLinearProgress', 'roadmapSourceNotice',
    'progressSummaryText', 'progressFill', 'countTotal', 'countPendiente', 'countGrabado', 'countEditado', 'countPublicado',
    'weekFilterGroup', 'btnWeekAll', 'btnWeek1', 'btnWeek2', 'btnWeek3', 'btnWeek4',
    'formatFilterSelect', 'statusFilterSelect', 'searchRoadmapInput',
    'viewModeGrid', 'viewModeTimeline', 'btnResetFilters', 'btnEmptyResetFilters',
    'roadmapList', 'roadmapEmptyState',
    'inspectorBackdrop', 'dayInspector', 'dayInspectorContent',
    'inspectorDayBadge', 'inspectorWeekBadge', 'inspectorFormatBadge', 'inspectorPillarBadge', 'localDraftBadge',
    'btnPrevDay', 'btnNextDay', 'btnToggleEditMode', 'btnCloseDrawer', 'inspectorStatusGroup',
    'inspectorTitle', 'inspectorHook', 'visualAspectFrame', 'visualFrameDay', 'visualFrameFormat', 'visualFrameHookPreview',
    'visualRatioLabel', 'visualRefThumb', 'visualCompositionTip',
    'inspectorImagePrompt', 'inspectorScript', 'inspectorCaption', 'inspectorHashtags',
    'inspectorYoutubeRef', 'inspectorRefLink',
    'btnCopyHook', 'btnCopyPrompt', 'btnCopyScript', 'btnCopyCaption',
    'draftEditorForm', 'editHookInput', 'editPromptInput', 'editScriptInput', 'editCaptionInput',
    'btnSaveDraft', 'btnResetDraft', 'btnCancelDraft',
    'ytSearchForm', 'ytSearchInput', 'ytMaxResultsSelect', 'btnYtSearch', 'ytHistoryList',
    'ytResultsSection', 'ytResultsList', 'ytVideosGrid',
    'oracleHealthCard', 'healthStatusText', 'healthUptimeText',
    'oracleLastRunCard', 'oracleLastStatus', 'oracleLastTimestamp', 'oracleLastDetails',
    'btnOracleTabRun', 'dataTruthGrid',
    'm3ConfirmDialogBackdrop', 'm3ConfirmDialog', 'm3ConfirmTitle', 'm3ConfirmBody', 'm3ConfirmCancel', 'm3ConfirmAccept',
    'toastContainer',
  ];
  ids.forEach((id) => {
    dom[id] = document.getElementById(id);
  });
}

export function normalizeRoadmapItem(raw, fallbackNiche) {
  const dayNum = Number(raw?.day_number) || 1;
  const weekNum = Number(raw?.week_number) || Math.min(Math.ceil(dayNum / 7), 4);
  const allowedFormats = ['Reel', 'Carrusel', 'Story'];
  const format = allowedFormats.includes(raw?.format) ? raw.format : 'Reel';
  const rawStatus = String(raw?.status || 'pendiente').toLowerCase();
  const status = STATUS_OPTIONS.includes(rawStatus) ? rawStatus : 'pendiente';
  let hashtags = [];
  if (Array.isArray(raw?.hashtags)) {
    hashtags = raw.hashtags.map((h) => String(h).trim()).filter(Boolean);
  } else if (typeof raw?.hashtags === 'string') {
    hashtags = raw.hashtags.split(/[\s,]+/).map((h) => h.trim()).filter(Boolean);
  }

  return {
    id: raw?.id ? String(raw.id) : undefined,
    day_number: dayNum,
    week_number: weekNum,
    content_pillar: String(raw?.content_pillar || 'Educativo'),
    format,
    title: String(raw?.title || `Día ${dayNum}`),
    hook: String(raw?.hook || ''),
    script: String(raw?.script || ''),
    image_prompt: String(raw?.image_prompt || ''),
    caption: String(raw?.caption || ''),
    hashtags,
    status,
    niche: String(raw?.niche || fallbackNiche || DEFAULT_NICHE),
    reference_video_id: raw?.reference_video_id ? String(raw.reference_video_id).trim() : '',
  };
}

export function normalizeVideoItem(raw) {
  const videoId = String(raw?.videoId || raw?.video_id || '').trim();
  return {
    id: raw?.id || videoId,
    videoId,
    title: String(raw?.title || 'Sin título'),
    description: String(raw?.description || ''),
    channelTitle: String(raw?.channelTitle || raw?.channel_title || 'Canal de YouTube'),
    publishedAt: raw?.publishedAt || raw?.published_at || raw?.created_at || '',
    thumbnailUrl: sanitizeHttpUrl(raw?.thumbnailUrl || raw?.thumbnail_url || ''),
    searchQuery: String(raw?.searchQuery || raw?.search_query || ''),
    isDemoMock: videoId.startsWith('demo_yt_'),
  };
}

export function makeDraftKey(niche, dayNumber) {
  return `${String(niche || DEFAULT_NICHE).trim().toLowerCase()}::${Number(dayNumber)}`;
}

export function loadDraftsMap() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDraftsMap(map) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    showToast('No se pudo guardar en localStorage (espacio o modo privado).', 'error');
  }
}

export function getEffectiveDayItem(item) {
  if (!item) return null;
  const drafts = loadDraftsMap();
  const draft = drafts[makeDraftKey(item.niche, item.day_number)];
  if (!draft) {
    return { ...item, isEditedLocally: false };
  }
  return {
    ...item,
    hook: typeof draft.hook === 'string' ? draft.hook : item.hook,
    image_prompt: typeof draft.image_prompt === 'string' ? draft.image_prompt : item.image_prompt,
    script: typeof draft.script === 'string' ? draft.script : item.script,
    caption: typeof draft.caption === 'string' ? draft.caption : item.caption,
    isEditedLocally: true,
  };
}

export function saveDayDraft(item, patch) {
  const drafts = loadDraftsMap();
  const key = makeDraftKey(item.niche, item.day_number);
  const hasDiff =
    patch.hook !== item.hook ||
    patch.image_prompt !== item.image_prompt ||
    patch.script !== item.script ||
    patch.caption !== item.caption;

  if (!hasDiff) {
    delete drafts[key];
  } else {
    drafts[key] = {
      hook: patch.hook,
      image_prompt: patch.image_prompt,
      script: patch.script,
      caption: patch.caption,
      updatedAt: new Date().toISOString(),
    };
  }
  saveDraftsMap(drafts);
}

export function deleteDayDraft(item) {
  const drafts = loadDraftsMap();
  const key = makeDraftKey(item.niche, item.day_number);
  delete drafts[key];
  saveDraftsMap(drafts);
}

export function generateClientFallbackRoadmap(niche) {
  const targetNiche = (niche || DEFAULT_NICHE).trim() || DEFAULT_NICHE;
  const pillars = ['Atracción', 'Educativo', 'Autoridad', 'Comunidad', 'Venta'];
  const formats = ['Reel', 'Reel', 'Carrusel', 'Reel', 'Story', 'Carrusel', 'Reel'];
  const items = [];
  for (let day = 1; day <= 30; day++) {
    const week = Math.min(Math.ceil(day / 7), 4);
    const format = formats[(day - 1) % formats.length];
    const pillar = pillars[(day - 1) % pillars.length];
    const hook = `Si aplicas esta regla de 3 minutos en ${targetNiche}, tus resultados cambian hoy (Día ${day}).`;
    items.push(
      normalizeRoadmapItem(
        {
          day_number: day,
          week_number: week,
          content_pillar: pillar,
          format,
          title: `Día ${day}: Estrategia práctica en ${targetNiche}`,
          hook,
          script: `[0:00 - 0:03] GANCHO: "${hook}"\n[0:03 - 0:18] DESARROLLO: Paso 1, Paso 2 y Paso 3 aplicados a ${targetNiche}.\n[0:18 - 0:30] CTA: Guarda esta pieza y comenta "GUÍA".`,
          image_prompt: `Clean minimalist editorial composition for Instagram Day ${day} about "${targetNiche}", natural daylight studio aesthetic, ${format === 'Carrusel' ? '1:1 square' : '9:16 vertical'}.`,
          caption: `${hook}\n\nGuarda este contenido para aplicarlo esta semana.`,
          hashtags: [`#${slugify(targetNiche).replace(/_/g, '')}`, '#contenido', '#estrategia'],
          status: 'pendiente',
          niche: targetNiche,
          reference_video_id: `demo_yt_0${((day - 1) % 3) + 1}`,
        },
        targetNiche
      )
    );
  }
  return items;
}

export function getFilteredRoadmap() {
  const q = state.filters.query.trim().toLowerCase();
  return state.roadmap.filter((raw) => {
    const item = getEffectiveDayItem(raw);
    if (state.filters.week !== 'all' && item.week_number !== Number(state.filters.week)) {
      return false;
    }
    if (state.filters.format !== 'all' && item.format !== state.filters.format) {
      return false;
    }
    if (state.filters.status !== 'all' && item.status !== state.filters.status) {
      return false;
    }
    if (q) {
      const haystack = [
        item.title,
        item.hook,
        item.script,
        item.image_prompt,
        item.caption,
        item.content_pillar,
        item.format,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function ensureValidSelectedDay() {
  if (state.roadmap.length === 0) return;
  const exists = state.roadmap.some((d) => d.day_number === state.selectedDay);
  if (!exists) {
    state.selectedDay = state.roadmap[0].day_number;
  }
}

export function getSelectedRawItem() {
  return state.roadmap.find((d) => d.day_number === state.selectedDay) || state.roadmap[0] || null;
}
