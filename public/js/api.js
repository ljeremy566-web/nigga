import {
  dom,
  state,
  ensureValidSelectedDay,
  ensureValidSelectedIgDay,
  generateClientFallbackRoadmap,
  getSelectedRawIgItem,
  getSelectedRawItem,
  normalizeIgReelItem,
  normalizeRoadmapItem,
  normalizeVideoItem,
} from './state.js';
import {
  DEFAULT_IG_ACCOUNT,
  DEFAULT_IG_NICHE,
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
import { renderIgReelsGrid } from './views/ig-reels-view.js';
import {
  renderIgInspectorNow,
  renderIgProgressAndCounters,
  renderIgRoadmapList,
  renderIgRoadmapSkeletons,
  setIgRoadmapLinearProgress,
  updateIgCardStatusBadge,
  updateIgInspectorStatusButtons,
  updateIgPrevNextButtons,
  updateIgSourceNotice,
} from './views/ig-roadmap-view.js';

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
  const targetNiche = (niche !== undefined ? String(niche) : state.niche || '').trim();
  state.niche = targetNiche;
  if (dom.nicheInput && targetNiche && dom.nicheInput.value.trim() !== targetNiche) {
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
      .map((item) => normalizeRoadmapItem(item, targetNiche || 'General'))
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
    state.roadmap = generateClientFallbackRoadmap(targetNiche || 'General');
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
  const rawNiche = (customNiche !== undefined ? String(customNiche) : dom.nicheInput?.value || '').trim();
  const niche = rawNiche || 'General';
  if (dom.nicheInput && customNiche && rawNiche) dom.nicheInput.value = rawNiche;
  state.niche = rawNiche;
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
  const rawNiche = dom.nicheInput?.value.trim() || '';
  const niche = rawNiche || 'General';
  const instagramAccount = dom.igAccountInput?.value.trim() || '';
  state.niche = rawNiche;
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

export async function fetchIgStatus() {
  try {
    const res = await fetch('/api/instagram/status');
    const data = await res.json();
    if (res.ok && data.success) {
      state.igReelsStats = {
        count: Number(data.reelsCount) || 0,
        lastCapturedAt: data.lastCapturedAt || null,
      };
      renderHealthAndOracleBadges();
      renderOracleView();
    }
  } catch {
    // Silent during boot
  }
}

export async function fetchIgReels(force = false) {
  if (state.igReelsTabLoaded && !force) {
    renderIgReelsGrid();
    return;
  }
  state.loading.igReels = true;
  try {
    const res = await fetch('/api/instagram/reels');
    const data = await res.json();
    if (!res.ok || !data.success || !Array.isArray(data.reels)) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    state.igReels = data.reels.map(normalizeIgReelItem);
    state.igReelsStats = {
      count: state.igReels.length,
      lastCapturedAt: state.igReels[0]?.createdAt || state.igReelsStats.lastCapturedAt,
    };
    state.igReelsTabLoaded = true;
    renderIgReelsGrid();
    renderHealthAndOracleBadges();
    renderOracleView();
  } catch (err) {
    showToast(`Error cargando Reels de Instagram: ${err.message}`, 'error');
  } finally {
    state.loading.igReels = false;
  }
}

function extractJsonFromPastedText(rawText) {
  let text = String(rawText || '').trim();
  if (!text) return null;

  // Quitar cercos markdown ```json ... ``` o ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
  }

  const tryParse = (candidate) => {
    try {
      return JSON.parse(candidate);
    } catch {
      const noTrailingCommas = candidate.replace(/,\s*([}\]])/g, '$1');
      try {
        return JSON.parse(noTrailingCommas);
      } catch {
        return undefined;
      }
    }
  };

  const direct = tryParse(text);
  if (direct !== undefined) return direct;

  // Extraer el bloque JSON principal entre el primer [ o { y su cierre correspondiente
  const firstBracket = text.search(/[\[{]/);
  if (firstBracket === -1) return undefined;
  const openChar = text[firstBracket];
  const closeChar = openChar === '[' ? ']' : '}';
  const lastBracket = text.lastIndexOf(closeChar);
  if (lastBracket <= firstBracket) return undefined;

  return tryParse(text.slice(firstBracket, lastBracket + 1));
}

export async function captureIgReelsPayload(rawJsonText, sourceQueryOverride) {
  if (state.loading.igCapture) return false;
  if (!String(rawJsonText || '').trim()) {
    showToast('Pega el JSON capturado antes de guardar.', 'error');
    return false;
  }

  const parsed = extractJsonFromPastedText(rawJsonText);
  if (parsed === undefined || parsed === null) {
    showToast('El JSON pegado no es válido. Verifica la estructura.', 'error');
    return false;
  }

  let body;
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      showToast('El arreglo JSON está vacío. Agrega al menos 1 Reel.', 'error');
      return false;
    }
    body = {
      sourceQuery: sourceQueryOverride || 'Antigravity Browser',
      capturedVia: 'manual_json',
      reels: parsed,
    };
  } else if (parsed && typeof parsed === 'object') {
    const nestedArray =
      (Array.isArray(parsed.reels) && parsed.reels) ||
      (Array.isArray(parsed.items) && parsed.items) ||
      (Array.isArray(parsed.posts) && parsed.posts) ||
      (Array.isArray(parsed.data) && parsed.data) ||
      (Array.isArray(parsed.results) && parsed.results) ||
      null;

    body = {
      ...parsed,
      ...(nestedArray ? { reels: nestedArray } : {}),
      sourceQuery: sourceQueryOverride || parsed.sourceQuery || parsed.source_query || parsed.query || 'Antigravity Browser',
      capturedVia: parsed.capturedVia || parsed.captured_via || 'antigravity_browser',
    };
  } else {
    showToast('Formato JSON no compatible.', 'error');
    return false;
  }

  state.loading.igCapture = true;
  setButtonBusy(dom.btnSubmitIgImport, true, 'Analizando con Gemini Vision…');
  try {
    const res = await fetch('/api/instagram/reels/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const rawResp = await res.text();
    let data = {};
    try {
      data = rawResp ? JSON.parse(rawResp) : {};
    } catch {
      throw new Error(`Respuesta inválida del servidor (HTTP ${res.status})`);
    }
    if (!res.ok || !data.success) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    if (Array.isArray(data.reels) && data.reels.length > 0) {
      const incoming = data.reels.map(normalizeIgReelItem);
      const byCode = new Map(state.igReels.map((r) => [r.shortcode, r]));
      incoming.forEach((r) => byCode.set(r.shortcode, r));
      state.igReels = Array.from(byCode.values());
      state.igReelsStats = {
        count: state.igReels.length,
        lastCapturedAt: state.igReels[0]?.createdAt || new Date().toISOString(),
      };
      renderIgReelsGrid();
      renderHealthAndOracleBadges();
      renderOracleView();
    }
    await fetchIgReels(true);
    if (data.supabaseError) {
      showToast(`${data.count} Reels guardados solo en memoria (Supabase: ${data.supabaseError}).`, 'error');
    } else {
      showToast(`${data.count} Reels capturados y analizados con éxito.`, 'success');
    }
    return true;
  } catch (err) {
    showToast(`Error capturando Reels: ${err.message}`, 'error');
    return false;
  } finally {
    state.loading.igCapture = false;
    setButtonBusy(dom.btnSubmitIgImport, false, 'Analizar con Gemini Vision y Guardar');
  }
}

export async function deleteIgReelByShortcode(shortcode) {
  if (!shortcode) return;
  try {
    const res = await fetch(`/api/instagram/reels/${encodeURIComponent(shortcode)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
    state.igReels = state.igReels.filter((r) => r.shortcode !== shortcode);
    state.igReelsStats.count = state.igReels.length;
    renderIgReelsGrid();
    renderHealthAndOracleBadges();
    renderOracleView();
    showToast(`Reel ${shortcode} eliminado.`, 'info');
  } catch (err) {
    showToast(`No se pudo eliminar el Reel: ${err.message}`, 'error');
  }
}

export async function fetchIgRoadmap(niche, options = {}) {
  state.loading.igRoadmap = true;
  const targetNiche = (niche || state.igNiche || DEFAULT_IG_NICHE).trim() || DEFAULT_IG_NICHE;
  state.igNiche = targetNiche;
  if (dom.igRoadmapNicheInput && dom.igRoadmapNicheInput.value.trim() !== targetNiche) {
    dom.igRoadmapNicheInput.value = targetNiche;
  }

  if (!options.silent) {
    setIgRoadmapLinearProgress(true);
    if (state.igRoadmap.length === 0) {
      renderIgRoadmapSkeletons();
    }
  }

  try {
    const res = await fetch(`/api/instagram/roadmap?niche=${encodeURIComponent(targetNiche)}`);
    const data = await res.json();
    if (!res.ok || !data.success || !Array.isArray(data.roadmap)) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    state.igRoadmap = data.roadmap
      .map((item) => normalizeRoadmapItem(item, targetNiche))
      .sort((a, b) => a.day_number - b.day_number);

    if (state.igRoadmap.length === 0) {
      updateIgSourceNotice(
        data.capturedReelsCount > 0
          ? `Tienes ${data.capturedReelsCount} Reels capturados listos. Pulsa "Generar 30 días IG" para crear este roadmap.`
          : 'Aún no hay un Roadmap IG para este nicho. Captura Reels en "IG Reels" o pulsa "Generar 30 días IG".'
      );
    } else {
      updateIgSourceNotice('');
    }

    if (!options.silent) {
      renderIgProgressAndCounters();
      renderIgRoadmapList();
      ensureValidSelectedIgDay();
      renderIgInspectorNow(getSelectedRawIgItem());
    }
  } catch (err) {
    updateIgSourceNotice(`Error cargando Roadmap IG (${err.message}).`, true);
    if (!options.silent) {
      showToast(`No se pudo cargar el Roadmap IG: ${err.message}`, 'error');
    }
  } finally {
    state.loading.igRoadmap = false;
    if (!options.silent && !state.loading.igGenerate) {
      setIgRoadmapLinearProgress(false);
    }
  }
}

export async function executeGenerateIgRoadmap(customNiche, customSourceQuery) {
  if (state.loading.igGenerate) return;
  const niche = (customNiche ?? dom.igRoadmapNicheInput?.value ?? DEFAULT_IG_NICHE).trim() || DEFAULT_IG_NICHE;
  const rawSource = customSourceQuery ?? dom.igRoadmapSourceSelect?.value ?? state.igSourceQueryFilter ?? 'all';
  const sourceQuery = rawSource && rawSource !== 'all' ? rawSource : undefined;

  if (dom.igRoadmapNicheInput) dom.igRoadmapNicheInput.value = niche;
  state.igNiche = niche;
  if (sourceQuery) state.igSourceQueryFilter = sourceQuery;

  state.loading.igGenerate = true;
  setIgRoadmapLinearProgress(true);
  setButtonBusy(dom.btnGenerateIgRoadmap, true, 'Generando…');

  try {
    const res = await fetch('/api/instagram/roadmap/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, sourceQuery }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    await fetchIgReels(true);
    await fetchIgRoadmap(niche, { silent: true });
    if (state.igRoadmap.length === 0 && Array.isArray(data.roadmap)) {
      state.igRoadmap = data.roadmap
        .map((item) => normalizeRoadmapItem(item, niche))
        .sort((a, b) => a.day_number - b.day_number);
    }

    state.igSelectedDay = state.igRoadmap[0]?.day_number || 1;
    state.igIsEditingDraft = false;
    updateIgSourceNotice(
      data.reelsUsed > 0
        ? `Roadmap IG generado con ${data.reelsUsed} Reels capturados de Instagram.`
        : 'Roadmap IG generado con estructura base IG (captura Reels en "IG Reels" para referencias reales).'
    );
    renderIgProgressAndCounters();
    await transitionSwap(dom.igRoadmapList, () => renderIgRoadmapList());
    await transitionSwap(dom.igDayInspectorContent, () => renderIgInspectorNow(getSelectedRawIgItem()));
    showToast(data.message || `Roadmap IG de 30 días generado para "${niche}".`, 'success');
  } catch (err) {
    showToast(`Error generando Roadmap IG: ${err.message}`, 'error');
  } finally {
    state.loading.igGenerate = false;
    setIgRoadmapLinearProgress(false);
    setButtonBusy(dom.btnGenerateIgRoadmap, false, 'Generar 30 días IG');
  }
}

export async function handleIgStatusChange(dayNumber, newStatus) {
  const item = state.igRoadmap.find((d) => d.day_number === dayNumber);
  if (!item || !STATUS_OPTIONS.includes(newStatus)) return;
  if (state.igStatusUpdatingDay === dayNumber || item.status === newStatus) return;

  const previousStatus = item.status;
  state.igStatusUpdatingDay = dayNumber;

  item.status = newStatus;
  renderIgProgressAndCounters();
  updateIgCardStatusBadge(dayNumber, newStatus);
  updateIgInspectorStatusButtons(newStatus);
  if (state.igFilters.status !== 'all') {
    renderIgRoadmapList();
    updateIgPrevNextButtons();
  }

  try {
    const targetId = encodeURIComponent(item.id || item.day_number);
    const res = await fetch(`/api/instagram/roadmap/${targetId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, niche: item.niche }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload.success === false) {
      throw new Error(payload.error || `HTTP ${res.status}`);
    }
    showToast(`Día IG ${padDay(dayNumber)} marcado como "${newStatus}".`, 'success');
  } catch (err) {
    item.status = previousStatus;
    renderIgProgressAndCounters();
    updateIgCardStatusBadge(dayNumber, previousStatus);
    updateIgInspectorStatusButtons(previousStatus);
    if (state.igFilters.status !== 'all') {
      renderIgRoadmapList();
      updateIgPrevNextButtons();
    }
    showToast(`No se pudo guardar el estado IG: ${err.message}`, 'error');
  } finally {
    state.igStatusUpdatingDay = null;
  }
}

