import {
  cacheDom,
  deleteDayDraft,
  dom,
  getEffectiveDayItem,
  getFilteredRoadmap,
  getSelectedRawItem,
  saveDayDraft,
  state,
} from './state.js';
import {
  DEFAULT_IG_ACCOUNT,
  DEFAULT_NICHE,
  csvEscape,
  getDesktopMediaQuery,
  isDesktop,
  padDay,
  prefersReducedMotion,
  slugify,
  triggerDownload,
} from './utils.js';
import { initTheme, toggleTheme } from './ui/theme.js';
import { initMaterialSymbolsObserver } from './ui/icons.js';
import { initConfirmDialog, openConfirmDialog } from './ui/dialog.js';
import { showToast } from './ui/snackbar.js';
import { transitionSwap } from './ui/motion.js';
import {
  executeGenerateRoadmap,
  executeOracleRun,
  fetchHealth,
  fetchOracleStatus,
  fetchRoadmap,
  fetchStoredVideosQuietly,
  handleStatusChange,
  handleYoutubeSearch,
  loadYoutubeTabData,
} from './api.js';
import { renderRoadmapList } from './views/roadmap-list.js';
import {
  closeMobileInspector,
  openMobileInspector,
  renderInspectorNow,
  setInspectorExpanded,
  setInspectorTab,
  syncResponsiveInspector,
  updatePrevNextButtons,
} from './views/day-inspector.js';

const VALID_TABS = ['roadmap', 'youtube', 'oracle'];
const BREADCRUMB_TITLES = {
  roadmap: 'Roadmap de contenido',
  youtube: 'YouTube Research',
  oracle: 'Oráculo IA & Fuentes',
};
let searchDebounceTimer = null;

function parseTabFromHash(hashString) {
  const cleaned = String(hashString || '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase();
  return VALID_TABS.includes(cleaned) ? cleaned : null;
}

export async function switchTab(nextTab, { updateHash = true } = {}) {
  const targetTab = VALID_TABS.includes(nextTab) ? nextTab : 'roadmap';

  if (state.isDrawerOpen) {
    closeMobileInspector({ restoreFocus: false });
  }

  document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
    const active = btn.getAttribute('data-tab') === targetTab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  if (dom.btnSidebarMyContents) {
    dom.btnSidebarMyContents.classList.remove('is-active');
  }

  if (dom.breadcrumbCurrent) {
    dom.breadcrumbCurrent.textContent = BREADCRUMB_TITLES[targetTab] || 'Roadmap de contenido';
  }

  VALID_TABS.forEach((tab) => {
    const panel = document.getElementById(`view-${tab}`);
    if (!panel) return;
    if (tab === targetTab) {
      panel.classList.remove('hidden', 'fade-out', 'fade-in');
      if (!prefersReducedMotion() && tab !== 'roadmap') {
        panel.classList.add('fade-in');
      }
    } else {
      panel.classList.add('hidden');
      panel.classList.remove('fade-in', 'fade-out');
    }
  });

  const changed = state.activeTab !== targetTab;
  state.activeTab = targetTab;

  if (updateHash && window.location.hash !== `#${targetTab}`) {
    window.location.hash = `#${targetTab}`;
  }

  if (targetTab === 'youtube') {
    await loadYoutubeTabData(false);
  } else if (targetTab === 'oracle' && changed) {
    fetchHealth();
    fetchOracleStatus();
  }
}

export async function selectDay(dayNumber, options = {}) {
  const item = state.roadmap.find((d) => d.day_number === Number(dayNumber));
  if (!item) return;
  state.selectedDay = item.day_number;
  state.isEditingDraft = false;

  const targetWeek = item.week_number || Math.min(4, Math.ceil(item.day_number / 7));
  if (!state.expandedWeeks.has(targetWeek)) {
    state.expandedWeeks.add(targetWeek);
    const groupEl = document.querySelector(`.week-group[data-week-group="${targetWeek}"]`);
    if (groupEl) {
      groupEl.classList.remove('is-collapsed');
      groupEl.querySelector('.week-header')?.setAttribute('aria-expanded', 'true');
    }
  }

  document.querySelectorAll('.day-card').forEach((card) => {
    const cardDay = Number(card.getAttribute('data-day'));
    const isSelected = cardDay === state.selectedDay;
    card.classList.toggle('day-card--selected', isSelected);
    card.setAttribute('aria-current', isSelected ? 'true' : 'false');
  });

  document.querySelectorAll('[data-dot-day]').forEach((dot) => {
    const dotDay = Number(dot.getAttribute('data-dot-day'));
    dot.classList.toggle('is-active', dotDay === state.selectedDay);
  });

  if (options.expandInspector && isDesktop()) {
    setInspectorExpanded(true);
  }

  if (options.openDrawer && !isDesktop()) {
    openMobileInspector(options.triggerEl);
  }

  if (options.immediate) {
    renderInspectorNow(item);
  } else {
    await transitionSwap(dom.dayInspectorContent, () => renderInspectorNow(item));
  }
}

function stepDay(delta) {
  const filtered = getFilteredRoadmap();
  const list = filtered.length > 0 ? filtered : state.roadmap;
  if (list.length === 0) return;
  const idx = list.findIndex((d) => d.day_number === state.selectedDay);
  const nextIdx = idx === -1 ? 0 : Math.max(0, Math.min(list.length - 1, idx + delta));
  const target = list[nextIdx];
  if (target && target.day_number !== state.selectedDay) {
    selectDay(target.day_number, { immediate: true });
  }
}

async function copyText(text, label) {
  const value = String(text || '');
  if (!value) {
    showToast('No hay contenido para copiar.', 'error');
    return;
  }
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(value);
    } else {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) throw new Error('execCommand copy failed');
    }
    showToast(`${label} copiado al portapapeles.`, 'success');
  } catch {
    showToast(`No se pudo copiar ${label.toLowerCase()}.`, 'error');
  }
}

function downloadCSV() {
  const effectiveItems = state.roadmap.map(getEffectiveDayItem);
  if (effectiveItems.length === 0) {
    showToast('No hay días para exportar.', 'error');
    return;
  }
  const headers = [
    'Día', 'Semana', 'Nicho', 'Pilar', 'Formato', 'Título',
    'Gancho', 'Guion', 'Prompt_Imagen', 'Caption', 'Hashtags',
    'Video_Referencia_YouTube', 'Estado', 'Editado_Localmente',
  ];
  const rows = effectiveItems.map((d) =>
    [
      d.day_number,
      d.week_number,
      d.niche,
      d.content_pillar,
      d.format,
      d.title,
      d.hook,
      d.script,
      d.image_prompt,
      d.caption,
      (d.hashtags || []).join(' '),
      d.reference_video_id || '',
      d.status,
      d.isEditedLocally ? 'Sí' : 'No',
    ]
      .map(csvEscape)
      .join(',')
  );
  const csvContent = '\uFEFF' + [headers.map(csvEscape).join(','), ...rows].join('\r\n');
  triggerDownload(
    csvContent,
    'text/csv;charset=utf-8;',
    `roadmap_30_dias_${slugify(state.niche)}.csv`
  );
  showToast('CSV exportado con éxito.', 'success');
}

function downloadJSON() {
  const effectiveItems = state.roadmap.map(getEffectiveDayItem);
  if (effectiveItems.length === 0) {
    showToast('No hay días para exportar.', 'error');
    return;
  }
  triggerDownload(
    JSON.stringify(effectiveItems, null, 2),
    'application/json;charset=utf-8;',
    `roadmap_30_dias_${slugify(state.niche)}.json`
  );
  showToast('JSON exportado con éxito.', 'success');
}

function resetFilters() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
  state.filters = { week: 'all', format: 'all', status: 'all', query: '' };
  if (dom.searchRoadmapInput) dom.searchRoadmapInput.value = '';
  if (dom.formatFilterSelect) dom.formatFilterSelect.value = 'all';
  if (dom.statusFilterSelect) dom.statusFilterSelect.value = 'all';
  dom.weekFilterGroup?.querySelectorAll('[data-week]').forEach((btn) => {
    const isAll = btn.getAttribute('data-week') === 'all';
    btn.classList.toggle('is-active', isAll);
    btn.setAttribute('aria-pressed', isAll ? 'true' : 'false');
  });
  renderRoadmapList();
  updatePrevNextButtons();
}

async function promptGenerateRoadmap(customNiche) {
  if (state.loading.generate) return;
  const niche = (customNiche ?? dom.nicheInput?.value ?? DEFAULT_NICHE).trim() || DEFAULT_NICHE;
  const confirmed = await openConfirmDialog({
    title: 'Generar nuevo roadmap de 30 días',
    body: `Se generará una nueva planificación de 30 días para "${niche}" reemplazando el estado actual de ese nicho en el servidor.`,
    confirmLabel: 'Generar 30 días',
    cancelLabel: 'Cancelar',
  });
  if (!confirmed) return;
  await executeGenerateRoadmap(niche);
}

async function promptOracleRun() {
  if (state.loading.oracle) return;
  const niche = dom.nicheInput?.value.trim() || DEFAULT_NICHE;
  const ig = dom.igAccountInput?.value.trim() || DEFAULT_IG_ACCOUNT;
  const confirmed = await openConfirmDialog({
    title: 'Ejecutar ciclo del Oráculo IA',
    body: `El Oráculo consultará tendencias reales de YouTube y generará 30 piezas con Gemini AI para "${niche}" (${ig}).`,
    confirmLabel: 'Ejecutar Oráculo',
    cancelLabel: 'Cancelar',
  });
  if (!confirmed) return;
  await executeOracleRun();
}

async function promptResetDraft() {
  const item = getSelectedRawItem();
  if (!item) return;
  const effective = getEffectiveDayItem(item);
  if (!effective.isEditedLocally) return;

  const confirmed = await openConfirmDialog({
    title: `Restaurar Día ${padDay(item.day_number)} al original`,
    body: 'Se eliminarán los cambios guardados localmente en este navegador para este día y se mostrará la versión original.',
    confirmLabel: 'Restaurar original',
    cancelLabel: 'Cancelar',
  });
  if (!confirmed) return;

  deleteDayDraft(item);
  state.isEditingDraft = false;
  renderRoadmapList();
  renderInspectorNow(item);
  showToast(`Día ${padDay(item.day_number)} restaurado al original.`, 'info');
}

async function promptUseTopicInRoadmap(topic) {
  const cleanTopic = String(topic || '').trim();
  if (!cleanTopic) return;
  const confirmed = await openConfirmDialog({
    title: 'Usar tendencia en el Roadmap',
    body: `¿Deseas cambiar el nicho activo a "${cleanTopic}" y generar un nuevo roadmap de 30 días basado en esta tendencia?`,
    confirmLabel: 'Usar tema y generar',
    cancelLabel: 'Cancelar',
  });
  if (!confirmed) return;

  if (dom.nicheInput) dom.nicheInput.value = cleanTopic;
  state.niche = cleanTopic;
  await switchTab('roadmap');
  await executeGenerateRoadmap(cleanTopic);
}

function bindEvents() {
  dom.btnThemeToggle?.addEventListener('click', () => {
    toggleTheme();
  });

  document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  window.addEventListener('hashchange', () => {
    const hashTab = parseTabFromHash(window.location.hash) || 'roadmap';
    switchTab(hashTab, { updateHash: false });
  });

  window.addEventListener('scroll', () => {
    const topbar = document.querySelector('.app-topbar');
    if (topbar) {
      topbar.classList.toggle('is-scrolled', window.scrollY > 8);
    }
  }, { passive: true });

  dom.btnLoadRoadmap?.addEventListener('click', () => {
    fetchRoadmap(dom.nicheInput?.value.trim() || DEFAULT_NICHE);
  });

  dom.nicheInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchRoadmap(dom.nicheInput.value.trim() || DEFAULT_NICHE);
    }
  });

  dom.btnGenerateRoadmap?.addEventListener('click', () => {
    promptGenerateRoadmap();
  });

  dom.btnRunOracle?.addEventListener('click', () => {
    promptOracleRun();
  });

  dom.btnOracleTabRun?.addEventListener('click', () => {
    promptOracleRun();
  });

  dom.btnExportCsv?.addEventListener('click', downloadCSV);
  dom.btnExportJson?.addEventListener('click', downloadJSON);

  dom.weekFilterGroup?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-week]');
    if (!btn) return;
    const weekVal = btn.getAttribute('data-week');
    state.filters.week = weekVal === 'all' ? 'all' : Number(weekVal);
    dom.weekFilterGroup.querySelectorAll('[data-week]').forEach((b) => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    renderRoadmapList();
    updatePrevNextButtons();
  });

  dom.formatFilterSelect?.addEventListener('change', (e) => {
    state.filters.format = e.target.value;
    renderRoadmapList();
    updatePrevNextButtons();
  });

  dom.statusFilterSelect?.addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    renderRoadmapList();
    updatePrevNextButtons();
  });

  const applySearchFilter = (val) => {
    state.filters.query = val;
    renderRoadmapList();
    updatePrevNextButtons();
  };

  dom.searchRoadmapInput?.addEventListener('input', (e) => {
    const val = e.target.value;
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (val === '') {
      applySearchFilter('');
      return;
    }
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null;
      applySearchFilter(val);
    }, 35);
  });

  dom.searchRoadmapInput?.addEventListener('change', (e) => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    applySearchFilter(e.target.value);
  });

  dom.viewModeGrid?.addEventListener('click', () => {
    if (state.viewMode === 'grid') return;
    state.viewMode = 'grid';
    dom.viewModeGrid.classList.add('is-active');
    dom.viewModeGrid.setAttribute('aria-pressed', 'true');
    dom.viewModeTimeline.classList.remove('is-active');
    dom.viewModeTimeline.setAttribute('aria-pressed', 'false');
    renderRoadmapList();
  });

  dom.viewModeTimeline?.addEventListener('click', () => {
    if (state.viewMode === 'timeline') return;
    state.viewMode = 'timeline';
    dom.viewModeTimeline.classList.add('is-active');
    dom.viewModeTimeline.setAttribute('aria-pressed', 'true');
    dom.viewModeGrid.classList.remove('is-active');
    dom.viewModeGrid.setAttribute('aria-pressed', 'false');
    renderRoadmapList();
  });

  dom.btnResetFilters?.addEventListener('click', resetFilters);
  dom.btnEmptyResetFilters?.addEventListener('click', resetFilters);

  dom.dayDotsStrip?.addEventListener('click', (e) => {
    const dot = e.target.closest('[data-dot-day]');
    if (!dot) return;
    const dayNum = Number(dot.getAttribute('data-dot-day'));
    selectDay(dayNum, { openDrawer: true, triggerEl: dot });
  });

  dom.roadmapList?.addEventListener('click', (e) => {
    const weekBtn = e.target.closest('[data-toggle-week]');
    if (weekBtn) {
      const weekNum = Number(weekBtn.getAttribute('data-toggle-week'));
      const groupEl = weekBtn.closest('.week-group');
      if (state.expandedWeeks.has(weekNum)) {
        state.expandedWeeks.delete(weekNum);
        groupEl?.classList.add('is-collapsed');
        weekBtn.setAttribute('aria-expanded', 'false');
      } else {
        state.expandedWeeks.add(weekNum);
        groupEl?.classList.remove('is-collapsed');
        weekBtn.setAttribute('aria-expanded', 'true');
      }
      return;
    }

    const expandTrigger = e.target.closest('[data-expand-day]');
    if (expandTrigger) {
      e.stopPropagation();
      const dayNum = Number(expandTrigger.getAttribute('data-expand-day'));
      selectDay(dayNum, { openDrawer: true, expandInspector: true, triggerEl: expandTrigger });
      return;
    }

    const card = e.target.closest('.day-card[data-day]');
    if (!card) return;
    const dayNum = Number(card.getAttribute('data-day'));
    selectDay(dayNum, { openDrawer: true, triggerEl: card });
  });

  dom.roadmapList?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.day-card[data-day]');
    if (!card || e.target !== card) return;
    e.preventDefault();
    const dayNum = Number(card.getAttribute('data-day'));
    selectDay(dayNum, { openDrawer: true, triggerEl: card });
  });

  dom.btnExpandInspector?.addEventListener('click', () => {
    setInspectorExpanded(!state.isInspectorExpanded);
  });

  dom.inspectorSubtabs?.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-inspector-tab]');
    if (!tabBtn) return;
    setInspectorTab(tabBtn.getAttribute('data-inspector-tab'));
  });

  dom.btnPrevDay?.addEventListener('click', () => stepDay(-1));
  dom.btnNextDay?.addEventListener('click', () => stepDay(1));
  dom.btnCloseDrawer?.addEventListener('click', () => closeMobileInspector({ restoreFocus: true }));
  dom.inspectorBackdrop?.addEventListener('click', () => closeMobileInspector({ restoreFocus: true }));

  dom.inspectorStatusSelect?.addEventListener('change', (e) => {
    handleStatusChange(state.selectedDay, e.target.value);
  });

  dom.inspectorStatusGroup?.addEventListener('click', (e) => {
    const btn = e.target.closest('.status-btn[data-status]');
    if (!btn) return;
    handleStatusChange(state.selectedDay, btn.getAttribute('data-status'));
  });

  dom.btnCopyHook?.addEventListener('click', () =>
    copyText(dom.inspectorHook.textContent, 'Gancho')
  );
  dom.btnCopyPrompt?.addEventListener('click', () =>
    copyText(dom.inspectorImagePrompt.textContent, 'Prompt de imagen')
  );
  dom.btnCopyScript?.addEventListener('click', () =>
    copyText(dom.inspectorScript.textContent, 'Guion')
  );
  dom.btnCopyCaption?.addEventListener('click', () => {
    const tags = Array.from(dom.inspectorHashtags.querySelectorAll('.badge'))
      .map((el) => el.textContent.trim())
      .filter(Boolean)
      .join(' ');
    const captionText = dom.inspectorCaption.textContent.trim();
    const full = tags ? `${captionText}\n\n${tags}` : captionText;
    copyText(full, 'Caption');
  });

  dom.btnOtherSuggestion?.addEventListener('click', () => {
    const list = state.roadmap;
    if (!list || list.length === 0) return;
    const nextDay = (state.selectedDay % list.length) + 1;
    selectDay(nextDay, { immediate: false });
    showToast(`Mostrando sugerencia del Día ${padDay(nextDay)}.`, 'info');
  });

  dom.btnSidebarMyContents?.addEventListener('click', async () => {
    await switchTab('roadmap');
    setInspectorExpanded(false);
    dom.btnSidebarMyContents.classList.add('is-active');
    if (dom.breadcrumbCurrent) {
      dom.breadcrumbCurrent.textContent = 'Mis contenidos';
    }
    if (dom.statusFilterSelect) {
      dom.statusFilterSelect.value = 'publicado';
      state.filters.status = 'publicado';
      renderRoadmapList();
      updatePrevNextButtons();
    }
  });

  dom.btnExploreIdeas?.addEventListener('click', () => switchTab('youtube'));

  dom.btnSidebarHelp?.addEventListener('click', () => {
    showToast('Atajos: ← / → cambia de día · "Ver guion ›" expande el panel derecho · Esc contrae.', 'info');
  });

  dom.btnSidebarSettings?.addEventListener('click', () => {
    toggleTheme();
  });

  dom.btnToggleEditMode?.addEventListener('click', () => {
    const item = getSelectedRawItem();
    if (!item) return;
    state.isEditingDraft = !state.isEditingDraft;
    renderInspectorNow(item);
  });

  dom.btnCancelDraft?.addEventListener('click', () => {
    const item = getSelectedRawItem();
    state.isEditingDraft = false;
    renderInspectorNow(item);
  });

  dom.btnResetDraft?.addEventListener('click', () => {
    promptResetDraft();
  });

  dom.draftEditorForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const item = getSelectedRawItem();
    if (!item) return;
    saveDayDraft(item, {
      hook: dom.editHookInput.value,
      image_prompt: dom.editPromptInput.value,
      script: dom.editScriptInput.value,
      caption: dom.editCaptionInput.value,
    });
    state.isEditingDraft = false;
    renderRoadmapList();
    renderInspectorNow(item);
    showToast(`Borrador local guardado para el Día ${padDay(item.day_number)}.`, 'success');
  });

  dom.ytSearchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleYoutubeSearch(dom.ytSearchInput.value, dom.ytMaxResultsSelect.value);
  });

  dom.ytHistoryList?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-history-query]');
    if (!chip) return;
    const query = chip.getAttribute('data-history-query');
    dom.ytSearchInput.value = query;
    handleYoutubeSearch(query, dom.ytMaxResultsSelect.value);
  });

  const handleUseTopicClick = (e) => {
    const btn = e.target.closest('[data-use-topic]');
    if (!btn) return;
    const topic = btn.getAttribute('data-use-topic');
    promptUseTopicInRoadmap(topic);
  };
  dom.ytResultsList?.addEventListener('click', handleUseTopicClick);
  dom.ytVideosGrid?.addEventListener('click', handleUseTopicClick);

  document.addEventListener('keydown', (e) => {
    if (dom.m3ConfirmDialog && !dom.m3ConfirmDialog.classList.contains('hidden')) {
      return;
    }
    if (e.key === 'Escape') {
      if (state.isDrawerOpen && !isDesktop()) {
        e.preventDefault();
        closeMobileInspector({ restoreFocus: true });
        return;
      }
      if (state.isInspectorExpanded && isDesktop()) {
        e.preventDefault();
        setInspectorExpanded(false);
        return;
      }
    }
    if (state.activeTab !== 'roadmap') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') stepDay(-1);
    if (e.key === 'ArrowRight') stepDay(1);
  });

  const desktopMq = getDesktopMediaQuery();
  if (desktopMq && typeof desktopMq.addEventListener === 'function') {
    desktopMq.addEventListener('change', syncResponsiveInspector);
  }
  window.addEventListener('resize', syncResponsiveInspector);
}

async function boot() {
  cacheDom();
  initMaterialSymbolsObserver();
  initTheme();
  initConfirmDialog();
  bindEvents();
  syncResponsiveInspector();

  const initialHashTab = parseTabFromHash(window.location.hash);
  if (initialHashTab && initialHashTab !== 'roadmap') {
    await switchTab(initialHashTab, { updateHash: false });
  }

  const initialNiche = dom.nicheInput?.value.trim() || DEFAULT_NICHE;
  await Promise.allSettled([
    fetchRoadmap(initialNiche),
    fetchHealth(),
    fetchOracleStatus(),
    fetchStoredVideosQuietly(),
  ]);

  const selected = getSelectedRawItem();
  if (selected) {
    renderInspectorNow(selected);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
