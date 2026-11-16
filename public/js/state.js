import {
  DEFAULT_IG_ACCOUNT,
  DEFAULT_NICHE,
  DRAFT_STORAGE_KEY,
  IG_DRAFT_STORAGE_KEY,
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
  viewMode: 'timeline',
  expandedWeeks: new Set([1]),
  inspectorTab: 'script',
  isInspectorExpanded: false,
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
    igReels: false,
    igCapture: false,
    igRoadmap: false,
    igGenerate: false,
  },
  health: null,
  oracleStatus: null,
  oracleError: false,
  youtubeSearchResults: [],
  youtubeStoredVideos: [],
  youtubeHistory: [],
  youtubeTabLoaded: false,
  // Estado independiente para IG Reels + Roadmap IG
  igReels: [],
  igReelsTabLoaded: false,
  igReelsStats: { count: 0, lastCapturedAt: null },
  igReelsFilters: { query: '', author: 'all' },
  igNiche: DEFAULT_NICHE,
  igSourceQueryFilter: 'all',
  igRoadmap: [],
  igSelectedDay: 1,
  igViewMode: 'timeline',
  igExpandedWeeks: new Set([1]),
  igInspectorTab: 'script',
  igIsInspectorExpanded: false,
  igIsEditingDraft: false,
  igIsDrawerOpen: false,
  igLastDrawerTrigger: null,
  igStatusUpdatingDay: null,
  igFilters: {
    week: 'all',
    format: 'all',
    status: 'all',
    query: '',
  },
};

export const dom = {};

export function cacheDom() {
  const ids = [
    'tab-roadmap', 'tab-youtube', 'tab-ig-reels', 'tab-ig-roadmap', 'tab-oracle', 'breadcrumbCurrent',
    'btnSidebarMyContents', 'btnExploreIdeas', 'btnSidebarHelp', 'btnSidebarSettings',
    'statusHealthBadge', 'statusOracleBadge', 'statusSourceBadge',
    'btnThemeToggle', 'themeToggleIcon',
    'view-roadmap', 'view-youtube', 'view-ig-reels', 'view-ig-roadmap', 'view-oracle',
    'nicheInput', 'igAccountInput', 'btnLoadRoadmap', 'btnGenerateRoadmap', 'btnRunOracle',
    'btnExportCsv', 'btnExportJson', 'roadmapLinearProgress', 'roadmapSourceNotice',
    'progressSummaryText', 'progressFill', 'planProgressSub', 'dayDotsStrip', 'roadmapIdeasCount',
    'countTotal', 'countPendiente', 'countGrabado', 'countEditado', 'countPublicado',
    'weekFilterGroup', 'btnWeekAll', 'btnWeek1', 'btnWeek2', 'btnWeek3', 'btnWeek4',
    'formatFilterSelect', 'statusFilterSelect', 'searchRoadmapInput',
    'viewModeGrid', 'viewModeTimeline', 'btnResetFilters', 'btnEmptyResetFilters',
    'roadmapWorkspace', 'roadmapList', 'roadmapEmptyState',
    'inspectorBackdrop', 'dayInspector', 'dayInspectorContent',
    'inspectorDayBadge', 'inspectorDayTotal', 'inspectorWeekBadge', 'inspectorFormatBadge', 'inspectorPillarBadge', 'localDraftBadge',
    'btnPrevDay', 'btnNextDay', 'btnExpandInspector', 'expandInspectorLabel', 'btnToggleEditMode', 'btnCloseDrawer',
    'inspectorStatusGroup', 'inspectorStatusSelect', 'inspectorStatusDot',
    'inspectorSubtabs', 'inspectorTitle', 'inspectorHook', 'inspectorScreenText',
    'inspectorDevBlock', 'inspectorDevText', 'inspectorCloseBlock', 'inspectorCloseText',
    'visualAspectFrame', 'visualFrameDay', 'visualFrameFormat', 'visualFrameHookPreview',
    'visualRatioLabel', 'visualRefThumb', 'visualCompositionTip',
    'inspectorImagePrompt', 'inspectorScript', 'inspectorCaption', 'inspectorHashtags',
    'inspectorYoutubeRef', 'inspectorRefLink',
    'btnCopyHook', 'btnCopyPrompt', 'btnCopyScript', 'btnCopyCaption', 'btnOtherSuggestion',
    'draftEditorForm', 'editHookInput', 'editPromptInput', 'editScriptInput', 'editCaptionInput',
    'btnSaveDraft', 'btnResetDraft', 'btnCancelDraft',
    'ytSearchForm', 'ytSearchInput', 'ytMaxResultsSelect', 'btnYtSearch', 'ytHistoryList',
    'ytResultsSection', 'ytResultsList', 'ytVideosGrid',
    'oracleHealthCard', 'healthStatusText', 'healthUptimeText',
    'oracleLastRunCard', 'oracleLastStatus', 'oracleLastTimestamp', 'oracleLastDetails',
    'btnOracleTabRun', 'dataTruthGrid', 'truthCard-instagram',
    // IG Reels Research DOM
    'igReelsFilterInput', 'igReelsAuthorFilter', 'btnRefreshIgReels', 'btnGoGenerateIgRoadmap',
    'btnCopyBrowserPrompt', 'btnToggleIgImport', 'igImportPanel', 'igImportForm',
    'igImportSourceInput', 'igImportJsonInput', 'btnSubmitIgImport', 'igReelsCountBadge', 'igReelsGrid',
    // Roadmap IG DOM (espejo de Roadmap principal)
    'igRoadmapNicheInput', 'igRoadmapSourceSelect', 'btnLoadIgRoadmap', 'btnGenerateIgRoadmap',
    'btnOpenIgCaptureTab', 'btnExportIgCsv', 'btnExportIgJson',
    'igRoadmapLinearProgress', 'igRoadmapSourceNotice',
    'igProgressSummaryText', 'igProgressFill', 'igPlanProgressSub', 'igDayDotsStrip', 'igRoadmapIdeasCount',
    'igWeekFilterGroup', 'btnIgWeekAll', 'btnIgWeek1', 'btnIgWeek2', 'btnIgWeek3', 'btnIgWeek4',
    'igFormatFilterSelect', 'igStatusFilterSelect', 'searchIgRoadmapInput',
    'igViewModeGrid', 'igViewModeTimeline', 'btnResetIgFilters', 'btnIgEmptyResetFilters',
    'igRoadmapWorkspace', 'igRoadmapList', 'igRoadmapEmptyState', 'btnIgEmptyGenerate',
    'igInspectorBackdrop', 'igDayInspector', 'igDayInspectorContent',
    'igInspectorDayBadge', 'igInspectorDayTotal', 'igInspectorWeekBadge', 'igInspectorFormatBadge', 'igInspectorPillarBadge', 'igLocalDraftBadge',
    'btnIgPrevDay', 'btnIgNextDay', 'btnIgExpandInspector', 'igExpandInspectorLabel', 'btnIgToggleEditMode', 'btnIgCloseDrawer',
    'igInspectorStatusGroup', 'igInspectorStatusSelect', 'igInspectorStatusDot',
    'igInspectorSubtabs', 'igInspectorTitle', 'igInspectorHook', 'igInspectorScreenText',
    'igInspectorDevBlock', 'igInspectorDevText', 'igInspectorCloseBlock', 'igInspectorCloseText',
    'igVisualAspectFrame', 'igVisualFrameDay', 'igVisualFrameFormat', 'igVisualFrameHookPreview',
    'igVisualRatioLabel', 'igVisualRefThumb', 'igVisualCompositionTip',
    'igInspectorImagePrompt', 'igInspectorScript', 'igInspectorCaption', 'igInspectorHashtags',
    'igInspectorReelRef', 'igInspectorReelLink',
    'btnIgCopyHook', 'btnIgCopyPrompt', 'btnIgCopyScript', 'btnIgCopyCaption', 'btnIgOtherSuggestion',
    'igDraftEditorForm', 'igEditHookInput', 'igEditPromptInput', 'igEditScriptInput', 'igEditCaptionInput',
    'btnIgSaveDraft', 'btnIgResetDraft', 'btnIgCancelDraft',
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
    source_query: raw?.source_query ? String(raw.source_query).trim() : '',
    reference_reel_shortcode: raw?.reference_reel_shortcode ? String(raw.reference_reel_shortcode).trim() : '',
    reference_reel_url: raw?.reference_reel_url ? sanitizeHttpUrl(raw.reference_reel_url) : '',
    reference_reel_author: raw?.reference_reel_author ? String(raw.reference_reel_author).trim() : '',
  };
}

export function normalizeIgReelItem(raw) {
  const shortcode = String(raw?.shortcode || '').trim();
  const safeThumb = String(raw?.thumbnail_data_url || raw?.frameImageBase64 || '').trim();
  const thumbnailDataUrl =
    safeThumb.startsWith('data:image/') ? safeThumb : sanitizeHttpUrl(safeThumb);

  return {
    id: raw?.id ? String(raw.id) : shortcode,
    shortcode,
    reelUrl: sanitizeHttpUrl(raw?.reel_url || raw?.reelUrl || (shortcode ? `https://www.instagram.com/reel/${encodeURIComponent(shortcode)}/` : '')),
    authorHandle: String(raw?.author_handle || raw?.authorHandle || '@instagram_creator'),
    sourceQuery: String(raw?.source_query || raw?.sourceQuery || 'General'),
    caption: String(raw?.caption || ''),
    hashtags: Array.isArray(raw?.hashtags) ? raw.hashtags : [],
    audioName: String(raw?.audio_name || raw?.audioName || 'Audio original'),
    viewCount: Number(raw?.view_count ?? raw?.viewCount ?? 0) || 0,
    likeCount: Number(raw?.like_count ?? raw?.likeCount ?? 0) || 0,
    commentCount: Number(raw?.comment_count ?? raw?.commentCount ?? 0) || 0,
    thumbnailDataUrl,
    visualHookText: String(raw?.visual_hook_text || ''),
    visualStyle: String(raw?.visual_style || ''),
    detectedAngle: String(raw?.detected_angle || ''),
    capturedVia: String(raw?.captured_via || 'antigravity_browser'),
    createdAt: raw?.created_at || raw?.posted_at || '',
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

export function loadIgDraftsMap() {
  try {
    const raw = localStorage.getItem(IG_DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveIgDraftsMap(map) {
  try {
    localStorage.setItem(IG_DRAFT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    showToast('No se pudo guardar el borrador IG en localStorage.', 'error');
  }
}

export function getEffectiveIgDayItem(item) {
  if (!item) return null;
  const drafts = loadIgDraftsMap();
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

export function saveIgDayDraft(item, patch) {
  const drafts = loadIgDraftsMap();
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
  saveIgDraftsMap(drafts);
}

export function deleteIgDayDraft(item) {
  const drafts = loadIgDraftsMap();
  const key = makeDraftKey(item.niche, item.day_number);
  delete drafts[key];
  saveIgDraftsMap(drafts);
}

export function getFilteredIgRoadmap() {
  const q = state.igFilters.query.trim().toLowerCase();
  return state.igRoadmap.filter((raw) => {
    const item = getEffectiveIgDayItem(raw);
    if (state.igFilters.week !== 'all' && item.week_number !== Number(state.igFilters.week)) {
      return false;
    }
    if (state.igFilters.format !== 'all' && item.format !== state.igFilters.format) {
      return false;
    }
    if (state.igFilters.status !== 'all' && item.status !== state.igFilters.status) {
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
        item.reference_reel_author,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function ensureValidSelectedIgDay() {
  if (state.igRoadmap.length === 0) return;
  const exists = state.igRoadmap.some((d) => d.day_number === state.igSelectedDay);
  if (!exists) {
    state.igSelectedDay = state.igRoadmap[0].day_number;
  }
}

export function getSelectedRawIgItem() {
  return (
    state.igRoadmap.find((d) => d.day_number === state.igSelectedDay) || state.igRoadmap[0] || null
  );
}

