import {
  dom,
  state,
  ensureValidSelectedDay,
  generateClientFallbackRoadmap,
  getSelectedRawItem,
  normalizeRoadmapItem,
  normalizeVideoItem,
} from './state.js';
import {
  DEFAULT_IG_ACCOUNT,
  DEFAULT_NICHE,
  STATUS_OPTIONS,
  padDay,
} from './utils.js';
import { showToast } from './ui/snackbar.js';
import { transitionSwap } from './ui/motion.js';
import {
  renderProgressAndCounters,
  renderRoadmapList,
  renderRoadmapSkeletons,
  setRoadmapLinearProgress,
  updateCardStatusBadge,
  updateSourceNotice,
} from './views/roadmap-list.js';
import {
  renderInspectorNow,
  updateInspectorStatusButtons,
  updatePrevNextButtons,
} from './views/day-inspector.js';
import {
  renderVideoCards,
  renderYoutubeCatalog,
  renderYoutubeHistory,
} from './views/youtube-view.js';
import {
  renderHealthAndOracleBadges,
  renderOracleView,
} from './views/oracle-view.js';

function setButtonBusy(btn, busy, label) {
  if (!btn) return;
  btn.disabled = busy;
  btn.setAttribute('aria-disabled', busy ? 'true' : 'false');
  const textSpan = btn.querySelector('span:not(.material-symbols-rounded)');
  if (label) {
    if (textSpan) {
      textSpan.textContent = label;
    } else {
      btn.textContent = label;
    }
  }
}

export async function fetchHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    if (!res.ok || data.status !== 'ok') throw new Error(`HTTP ${res.status}`);
    state.health = data;
  } catch {
    state.health = null;
  }
  renderHealthAndOracleBadges();
  renderOracleView();
}

export async function fetchOracleStatus() {
  try {
    const res = await fetch('/api/oracle/status');
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(`HTTP ${res.status}`);
    state.oracleStatus = data.lastExecution;
    state.oracleError = false;
  } catch {
    state.oracleStatus = null;
    state.oracleError = true;
  }
  renderHealthAndOracleBadges();
  renderOracleView();
}

export async function fetchStoredVideosQuietly() {
  try {
    const res = await fetch('/api/videos');
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.videos)) {
      state.youtubeStoredVideos = data.videos.map(normalizeVideoItem);
    }
  } catch {
    // Silent during initial boot
  }
}

export async function fetchRoadmap(niche, options = {}) {
  state.loading.roadmap = true;
  const targetNiche = (niche || state.niche || DEFAULT_NICHE).trim() || DEFAULT_NICHE;
  state.niche = targetNiche;
  if (dom.nicheInput && dom.nicheInput.value.trim() !== targetNiche) {
    dom.nicheInput.value = targetNiche;
  }

  if (!options.silent) {
    setRoadmapLinearProgress(true);
    if (state.roadmap.length === 0) {
      renderRoadmapSkeletons();
    }
  }

  try {
    const url = targetNiche
      ? `/api/roadmap?niche=${encodeURIComponent(targetNiche)}`
      : '/api/roadmap';
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || !data.success || !Array.isArray(data.roadmap)) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    state.roadmap = data.roadmap
      .map((item) => normalizeRoadmapItem(item, targetNiche))
      .sort((a, b) => a.day_number - b.day_number);
    state.roadmapIsFallback = false;
    updateSourceNotice();
    if (!options.silent) {
      renderProgressAndCounters();
      renderRoadmapList();
      ensureValidSelectedDay();
      renderInspectorNow(getSelectedRawItem());
    }
  } catch (err) {
    state.roadmap = generateClientFallbackRoadmap(targetNiche);
    state.roadmapIsFallback = true;
    updateSourceNotice(
      `Sin conexión con el servidor (${err.message}): mostrando respaldo local temporal.`
    );
    renderProgressAndCounters();
    renderRoadmapList();
    ensureValidSelectedDay();
    renderInspectorNow(getSelectedRawItem());
    if (!options.silent) {
      showToast('No se pudo cargar el roadmap desde el servidor. Vista local activa.', 'error');
    }
  } finally {
    state.loading.roadmap = false;
    if (!options.silent && !state.loading.generate && !state.loading.oracle) {
      setRoadmapLinearProgress(false);
    }
  }
}

export async function executeGenerateRoadmap(customNiche) {
  if (state.loading.generate) return;
  const niche = (customNiche ?? dom.nicheInput?.value ?? DEFAULT_NICHE).trim() || DEFAULT_NICHE;
  if (dom.nicheInput) dom.nicheInput.value = niche;
  state.niche = niche;
  state.loading.generate = true;
  setRoadmapLinearProgress(true);
  setButtonBusy(dom.btnGenerateRoadmap, true, 'Generando…');

  try {
    const res = await fetch('/api/roadmap/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    await fetchRoadmap(niche, { silent: true });
    if (state.roadmap.length === 0 && Array.isArray(data.roadmap)) {
      state.roadmap = data.roadmap
        .map((item) => normalizeRoadmapItem(item, niche))
        .sort((a, b) => a.day_number - b.day_number);
    }

    state.selectedDay = state.roadmap[0]?.day_number || 1;
    state.isEditingDraft = false;
    renderProgressAndCounters();
    await transitionSwap(dom.roadmapList, () => renderRoadmapList());
    await transitionSwap(dom.dayInspectorContent, () => renderInspectorNow(getSelectedRawItem()));
    showToast(`Roadmap de 30 días generado para "${niche}".`, 'success');
  } catch (err) {
    showToast(`Error generando roadmap: ${err.message}`, 'error');
  } finally {
    state.loading.generate = false;
    setRoadmapLinearProgress(false);
    setButtonBusy(dom.btnGenerateRoadmap, false, 'Generar 30 días');
  }
}

export async function executeOracleRun() {
  if (state.loading.oracle) return;
  const niche = dom.nicheInput?.value.trim() || DEFAULT_NICHE;
  const instagramAccount = dom.igAccountInput?.value.trim() || DEFAULT_IG_ACCOUNT;
  if (dom.nicheInput) dom.nicheInput.value = niche;
  if (dom.igAccountInput) dom.igAccountInput.value = instagramAccount;
  state.niche = niche;
  state.igAccount = instagramAccount;
  state.loading.oracle = true;
  setRoadmapLinearProgress(true);
  setButtonBusy(dom.btnRunOracle, true, 'Ejecutando Oráculo…');
  setButtonBusy(dom.btnOracleTabRun, true, 'Ejecutando ciclo…');

  try {
    const res = await fetch('/api/oracle/run-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, instagramAccount }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.report) {
      state.oracleStatus = data.report;
      state.oracleError = data.report.status === 'error';
    }
    if (!res.ok || !data.success || data.report?.status === 'error') {
      state.oracleError = true;
      throw new Error(data.report?.details || data.error || `HTTP ${res.status}`);
    }

    state.oracleError = false;
    await Promise.allSettled([
      fetchRoadmap(niche, { silent: true }),
      fetchStoredVideosQuietly(),
      fetchHealth(),
    ]);
    state.youtubeTabLoaded = false;
    state.selectedDay = state.roadmap[0]?.day_number || 1;
    state.isEditingDraft = false;

    renderHealthAndOracleBadges();
    renderOracleView();
    renderProgressAndCounters();
    await transitionSwap(dom.roadmapList, () => renderRoadmapList());
    await transitionSwap(dom.dayInspectorContent, () => renderInspectorNow(getSelectedRawItem()));
    showToast('Ciclo del Oráculo completado con YouTube y Gemini AI.', 'success');
  } catch (err) {
    renderHealthAndOracleBadges();
    renderOracleView();
    showToast(`Error en el Oráculo: ${err.message}`, 'error');
  } finally {
    state.loading.oracle = false;
    setRoadmapLinearProgress(false);
    setButtonBusy(dom.btnRunOracle, false, 'Ejecutar Oráculo IA');
    setButtonBusy(dom.btnOracleTabRun, false, 'Ejecutar ciclo del Oráculo ahora');
  }
}

export async function handleStatusChange(dayNumber, newStatus) {
  const item = state.roadmap.find((d) => d.day_number === dayNumber);
  if (!item || !STATUS_OPTIONS.includes(newStatus)) return;
  if (state.statusUpdatingDay === dayNumber || item.status === newStatus) return;

  const previousStatus = item.status;
  state.statusUpdatingDay = dayNumber;

  item.status = newStatus;
  renderProgressAndCounters();
  updateCardStatusBadge(dayNumber, newStatus);
  updateInspectorStatusButtons(newStatus);
  if (state.filters.status !== 'all') {
    renderRoadmapList();
    updatePrevNextButtons();
  }

  try {
    const targetId = encodeURIComponent(item.id || item.day_number);
    const res = await fetch(`/api/roadmap/${targetId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload.success === false) {
      throw new Error(payload.error || `HTTP ${res.status}`);
    }
    showToast(`Día ${padDay(dayNumber)} marcado como "${newStatus}".`, 'success');
  } catch (err) {
    item.status = previousStatus;
    renderProgressAndCounters();
    updateCardStatusBadge(dayNumber, previousStatus);
    updateInspectorStatusButtons(previousStatus);
    if (state.filters.status !== 'all') {
      renderRoadmapList();
      updatePrevNextButtons();
    }
    showToast(`No se pudo guardar el estado: ${err.message}`, 'error');
  } finally {
    state.statusUpdatingDay = null;
  }
}

export async function loadYoutubeTabData(force = false) {
  if (state.youtubeTabLoaded && !force) return;
  try {
    const [videosRes, historyRes] = await Promise.allSettled([
      fetch('/api/videos').then((r) => r.json()),
      fetch('/api/youtube/history').then((r) => r.json()),
    ]);

    if (
      videosRes.status === 'fulfilled' &&
      videosRes.value?.success &&
      Array.isArray(videosRes.value.videos)
    ) {
      state.youtubeStoredVideos = videosRes.value.videos.map(normalizeVideoItem);
    }
    if (
      historyRes.status === 'fulfilled' &&
      historyRes.value?.success &&
      Array.isArray(historyRes.value.history)
    ) {
      state.youtubeHistory = historyRes.value.history;
    }
    state.youtubeTabLoaded = true;
    renderYoutubeHistory();
    renderYoutubeCatalog();
  } catch (err) {
    showToast(`Error cargando datos de YouTube: ${err.message}`, 'error');
  }
}

export async function handleYoutubeSearch(query, maxResults = 6) {
  const q = String(query || '').trim();
  if (!q) {
    showToast('Escribe una temática para buscar en YouTube.', 'error');
    return;
  }
  if (state.loading.youtubeSearch) return;
  state.loading.youtubeSearch = true;
  setButtonBusy(dom.btnYtSearch, true, 'Buscando…');

  try {
    const url = `/api/youtube/search?q=${encodeURIComponent(q)}&maxResults=${encodeURIComponent(
      maxResults
    )}&saveToDb=true`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || !data.success || !Array.isArray(data.videos)) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    state.youtubeSearchResults = data.videos.map(normalizeVideoItem);
    dom.ytResultsSection?.classList.remove('hidden');
    await transitionSwap(dom.ytResultsList, () =>
      renderVideoCards(dom.ytResultsList, state.youtubeSearchResults)
    );
    await loadYoutubeTabData(true);
    showToast(`${state.youtubeSearchResults.length} videos encontrados para "${q}".`, 'success');
  } catch (err) {
    showToast(`Error buscando en YouTube: ${err.message}`, 'error');
  } finally {
    state.loading.youtubeSearch = false;
    setButtonBusy(dom.btnYtSearch, false, 'Buscar en YouTube');
  }
}
