(() => {
  'use strict';

  const DEFAULT_NICHE = 'Inteligencia Artificial y Productividad';
  const DEFAULT_IG_ACCOUNT = '@creatorshub';
  const DRAFT_STORAGE_KEY = 'content_studio_drafts_v1';
  const STATUS_OPTIONS = ['pendiente', 'grabado', 'editado', 'publicado'];
  const WEEK_LABELS = {
    1: 'Semana 1 · Atracción y Disrupción',
    2: 'Semana 2 · Autoridad y Educación',
    3: 'Semana 3 · Comunidad y Confianza',
    4: 'Semana 4 · Conversión y Oferta',
  };

  const state = {
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
    statusUpdatingDay: null,
    loading: {
      roadmap: false,
      generate: false,
      oracle: false,
      youtubeSearch: false,
    },
    health: null,
    oracleStatus: null,
    youtubeSearchResults: [],
    youtubeStoredVideos: [],
    youtubeHistory: [],
    youtubeTabLoaded: false,
  };

  const dom = {};
  const swapTokens = new WeakMap();
  const desktopMq = window.matchMedia ? window.matchMedia('(min-width: 1024px)') : null;

  const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
  }

  function sanitizeHttpUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(String(url), window.location.origin);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch {
      return '';
    }
  }

  function isDesktop() {
    return desktopMq ? desktopMq.matches : window.innerWidth >= 1024;
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function padDay(n) {
    return String(Number(n) || 1).padStart(2, '0');
  }

  function slugify(value) {
    return String(value || 'roadmap')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'roadmap';
  }

  function formatUptime(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (h > 0) return `${h}h ${m}m ${rem}s`;
    if (m > 0) return `${m}m ${rem}s`;
    return `${rem}s`;
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  /* =========================================================
     Smooth Fade-In / Fade-Out Motion Controller
     ========================================================= */
  function transitionSwap(el, renderFn, durationMs = 150) {
    if (!el) return Promise.resolve(false);
    const nextToken = (swapTokens.get(el) || 0) + 1;
    swapTokens.set(el, nextToken);

    if (prefersReducedMotion()) {
      el.classList.remove('fade-out', 'fade-in');
      renderFn(el);
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      el.classList.remove('fade-in');
      el.classList.add('fade-out');

      setTimeout(() => {
        if (swapTokens.get(el) !== nextToken) {
          resolve(false);
          return;
        }
        renderFn(el);
        el.classList.remove('fade-out');
        void el.offsetWidth;
        el.classList.add('fade-in');
        resolve(true);
      }, durationMs);
    });
  }

  function showToast(message, type = 'info') {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    const typeClass = type === 'success' ? 'toast--success' : (type === 'error' ? 'toast--error' : '');
    toast.className = `toast fade-in ${typeClass}`.trim();
    toast.setAttribute('role', 'status');
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (!toast.parentNode) return;
      if (prefersReducedMotion()) {
        toast.remove();
        return;
      }
      toast.classList.remove('fade-in');
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 160);
    }, 3200);
  }

  /* =========================================================
     Normalizers & LocalStorage Draft Persistence
     ========================================================= */
  function normalizeRoadmapItem(raw, fallbackNiche) {
    const dayNum = Number(raw?.day_number) || 1;
    const weekNum = Number(raw?.week_number) || Math.min(Math.ceil(dayNum / 7), 4);
    const allowedFormats = ['Reel', 'Carrusel', 'Story'];
    const format = allowedFormats.includes(raw?.format) ? raw.format : 'Reel';
    const status = STATUS_OPTIONS.includes(raw?.status) ? raw.status : 'pendiente';
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

  function normalizeVideoItem(raw) {
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

  function makeDraftKey(niche, dayNumber) {
    return `${String(niche || DEFAULT_NICHE).trim().toLowerCase()}::${Number(dayNumber)}`;
  }

  function loadDraftsMap() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveDraftsMap(map) {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(map));
    } catch {
      showToast('No se pudo guardar en localStorage (espacio o modo privado).', 'error');
    }
  }

  function getEffectiveDayItem(item) {
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

  function saveDayDraft(item, patch) {
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

  function restoreDayDraft(item) {
    const drafts = loadDraftsMap();
    const key = makeDraftKey(item.niche, item.day_number);
    delete drafts[key];
    saveDraftsMap(drafts);
    state.isEditingDraft = false;
    renderRoadmapList();
    transitionSwap(dom.dayInspectorContent, () => renderInspectorNow(item));
    showToast(`Día ${padDay(item.day_number)} restaurado al original.`, 'info');
  }

  function generateClientFallbackRoadmap(niche) {
    const targetNiche = niche || DEFAULT_NICHE;
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
          },
          targetNiche
        )
      );
    }
    return items;
  }

  /* =========================================================
     API Client
     ========================================================= */
  async function fetchHealth() {
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

  async function fetchOracleStatus() {
    try {
      const res = await fetch('/api/oracle/status');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(`HTTP ${res.status}`);
      state.oracleStatus = data.lastExecution;
    } catch {
      state.oracleStatus = null;
    }
    renderHealthAndOracleBadges();
    renderOracleView();
  }

  async function fetchStoredVideosQuietly() {
    try {
      const res = await fetch('/api/videos');
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.videos)) {
        state.youtubeStoredVideos = data.videos.map(normalizeVideoItem);
      }
    } catch {
      // Silencioso en arranque; la pestaña YouTube muestra errores explícitos si falla al abrirla
    }
  }

  async function fetchRoadmap(niche, options = {}) {
    state.loading.roadmap = true;
    const targetNiche = (niche || state.niche || DEFAULT_NICHE).trim();
    state.niche = targetNiche;

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
      updateSourceNotice(`Sin conexión con el servidor (${err.message}): mostrando respaldo local temporal.`);
      renderProgressAndCounters();
      renderRoadmapList();
      ensureValidSelectedDay();
      renderInspectorNow(getSelectedRawItem());
      if (!options.silent) {
        showToast('No se pudo cargar el roadmap desde el servidor. Vista local activa.', 'error');
      }
    } finally {
      state.loading.roadmap = false;
    }
  }

  async function handleGenerateRoadmap() {
    if (state.loading.generate) return;
    const niche = dom.nicheInput.value.trim() || DEFAULT_NICHE;
    dom.nicheInput.value = niche;
    state.niche = niche;
    state.loading.generate = true;
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

      // Hidratar UUIDs reales desde GET /api/roadmap?niche=...
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
      setButtonBusy(dom.btnGenerateRoadmap, false, 'Generar 30 días');
    }
  }

  async function handleOracleRun() {
    if (state.loading.oracle) return;
    const niche = dom.nicheInput.value.trim() || DEFAULT_NICHE;
    const instagramAccount = dom.igAccountInput.value.trim() || DEFAULT_IG_ACCOUNT;
    state.niche = niche;
    state.igAccount = instagramAccount;
    state.loading.oracle = true;
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
      }
      if (!res.ok || !data.success || data.report?.status === 'error') {
        throw new Error(data.report?.details || data.error || `HTTP ${res.status}`);
      }

      await fetchRoadmap(niche, { silent: true });
      await fetchStoredVideosQuietly();
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
      setButtonBusy(dom.btnRunOracle, false, 'Ejecutar Oráculo IA');
      setButtonBusy(dom.btnOracleTabRun, false, 'Ejecutar ciclo del Oráculo ahora');
    }
  }

  async function handleStatusChange(dayNumber, newStatus) {
    const item = state.roadmap.find((d) => d.day_number === dayNumber);
    if (!item || !STATUS_OPTIONS.includes(newStatus)) return;
    if (state.statusUpdatingDay === dayNumber || item.status === newStatus) return;

    const previousStatus = item.status;
    state.statusUpdatingDay = dayNumber;

    // Actualización optimista
    item.status = newStatus;
    renderProgressAndCounters();
    updateCardStatusBadge(dayNumber, newStatus);
    updateInspectorStatusButtons(newStatus);

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
      // Reversión completa si falla el servidor
      item.status = previousStatus;
      renderProgressAndCounters();
      updateCardStatusBadge(dayNumber, previousStatus);
      updateInspectorStatusButtons(previousStatus);
      showToast(`No se pudo guardar el estado: ${err.message}`, 'error');
    } finally {
      state.statusUpdatingDay = null;
    }
  }

  async function loadYoutubeTabData(force = false) {
    if (state.youtubeTabLoaded && !force) return;
    try {
      const [videosRes, historyRes] = await Promise.allSettled([
        fetch('/api/videos').then((r) => r.json()),
        fetch('/api/youtube/history').then((r) => r.json()),
      ]);

      if (videosRes.status === 'fulfilled' && videosRes.value?.success && Array.isArray(videosRes.value.videos)) {
        state.youtubeStoredVideos = videosRes.value.videos.map(normalizeVideoItem);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value?.success && Array.isArray(historyRes.value.history)) {
        state.youtubeHistory = historyRes.value.history;
      }
      state.youtubeTabLoaded = true;
      renderYoutubeHistory();
      renderYoutubeCatalog();
    } catch (err) {
      showToast(`Error cargando datos de YouTube: ${err.message}`, 'error');
    }
  }

  async function handleYoutubeSearch(query, maxResults = 6) {
    const q = String(query || '').trim();
    if (!q) {
      showToast('Escribe una temática para buscar en YouTube.', 'error');
      return;
    }
    state.loading.youtubeSearch = true;
    setButtonBusy(dom.btnYtSearch, true, 'Buscando…');

    try {
      const url = `/api/youtube/search?q=${encodeURIComponent(q)}&maxResults=${encodeURIComponent(maxResults)}&saveToDb=true`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.videos)) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      state.youtubeSearchResults = data.videos.map(normalizeVideoItem);
      dom.ytResultsSection.classList.remove('hidden');
      await transitionSwap(dom.ytResultsList, () => renderVideoCards(dom.ytResultsList, state.youtubeSearchResults));
      await loadYoutubeTabData(true);
      showToast(`${state.youtubeSearchResults.length} videos encontrados para "${q}".`, 'success');
    } catch (err) {
      showToast(`Error buscando en YouTube: ${err.message}`, 'error');
    } finally {
      state.loading.youtubeSearch = false;
      setButtonBusy(dom.btnYtSearch, false, 'Buscar en YouTube');
    }
  }

  /* =========================================================
     Filtering & Selection
     ========================================================= */
  function getFilteredRoadmap() {
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

  function ensureValidSelectedDay() {
    if (state.roadmap.length === 0) return;
    const exists = state.roadmap.some((d) => d.day_number === state.selectedDay);
    if (!exists) {
      state.selectedDay = state.roadmap[0].day_number;
    }
  }

  function getSelectedRawItem() {
    return state.roadmap.find((d) => d.day_number === state.selectedDay) || state.roadmap[0] || null;
  }

  async function selectDay(dayNumber, options = {}) {
    const item = state.roadmap.find((d) => d.day_number === Number(dayNumber));
    if (!item) return;
    state.selectedDay = item.day_number;
    state.isEditingDraft = false;

    document.querySelectorAll('.day-card').forEach((card) => {
      const cardDay = Number(card.getAttribute('data-day'));
      const isSelected = cardDay === state.selectedDay;
      card.classList.toggle('day-card--selected', isSelected);
      card.setAttribute('aria-current', isSelected ? 'true' : 'false');
    });

    if (options.openDrawer && !isDesktop()) {
      openMobileInspector();
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
      selectDay(target.day_number);
    }
  }

  /* =========================================================
     Renderers
     ========================================================= */
  function setButtonBusy(btn, busy, label) {
    if (!btn) return;
    btn.disabled = busy;
    if (label) btn.textContent = label;
  }

  function updateSourceNotice(customWarning) {
    if (!dom.roadmapSourceNotice) return;
    if (customWarning) {
      dom.roadmapSourceNotice.className = 'source-notice source-notice--warn fade-in';
      dom.roadmapSourceNotice.innerHTML = `<span>${escapeHtml(customWarning)}</span>`;
      return;
    }
    if (state.roadmapIsFallback) {
      dom.roadmapSourceNotice.className = 'source-notice source-notice--warn fade-in';
      dom.roadmapSourceNotice.textContent = 'Mostrando vista de respaldo local temporal.';
      return;
    }
    dom.roadmapSourceNotice.className = 'source-notice hidden';
    dom.roadmapSourceNotice.textContent = '';
  }

  function renderHealthAndOracleBadges() {
    if (dom.statusHealthBadge) {
      if (state.health && state.health.status === 'ok') {
        dom.statusHealthBadge.className = 'badge badge--live';
        dom.statusHealthBadge.textContent = 'Servidor OK';
      } else {
        dom.statusHealthBadge.className = 'badge badge--error';
        dom.statusHealthBadge.textContent = 'Sin conexión';
      }
    }

    if (dom.statusOracleBadge) {
      if (state.oracleStatus && typeof state.oracleStatus === 'object') {
        if (state.oracleStatus.status === 'error') {
          dom.statusOracleBadge.className = 'badge badge--error';
          dom.statusOracleBadge.textContent = 'Oráculo con error';
        } else {
          dom.statusOracleBadge.className = 'badge badge--live';
          dom.statusOracleBadge.textContent = 'Oráculo sincronizado';
        }
      } else {
        dom.statusOracleBadge.className = 'badge';
        dom.statusOracleBadge.textContent = 'Oráculo listo';
      }
    }
  }

  function renderProgressAndCounters() {
    const total = state.roadmap.length;
    const counts = {
      pendiente: 0,
      grabado: 0,
      editado: 0,
      publicado: 0,
    };
    state.roadmap.forEach((d) => {
      if (counts[d.status] !== undefined) counts[d.status] += 1;
    });

    const pct = total > 0 ? Math.round((counts.publicado / total) * 100) : 0;
    if (dom.progressSummaryText) {
      dom.progressSummaryText.textContent = `${counts.publicado} / ${total} publicados · ${pct}%`;
    }
    if (dom.progressFill) {
      dom.progressFill.style.width = `${pct}%`;
    }
    if (dom.countTotal) dom.countTotal.textContent = String(total);
    if (dom.countPendiente) dom.countPendiente.textContent = String(counts.pendiente);
    if (dom.countGrabado) dom.countGrabado.textContent = String(counts.grabado);
    if (dom.countEditado) dom.countEditado.textContent = String(counts.editado);
    if (dom.countPublicado) dom.countPublicado.textContent = String(counts.publicado);
  }

  function renderRoadmapList() {
    if (!dom.roadmapList) return;
    dom.roadmapList.className = `roadmap-list ${state.viewMode === 'timeline' ? 'roadmap-list--timeline' : 'roadmap-list--grid'}`;

    const filtered = getFilteredRoadmap();
    if (filtered.length === 0) {
      dom.roadmapList.innerHTML = '';
      dom.roadmapEmptyState.classList.remove('hidden');
      return;
    }

    dom.roadmapEmptyState.classList.add('hidden');

    const grouped = new Map();
    filtered.forEach((raw) => {
      const week = raw.week_number || 1;
      if (!grouped.has(week)) grouped.set(week, []);
      grouped.get(week).push(getEffectiveDayItem(raw));
    });

    const htmlParts = [];
    Array.from(grouped.keys())
      .sort((a, b) => a - b)
      .forEach((week) => {
        const days = grouped.get(week);
        const weekLabel = WEEK_LABELS[week] || `Semana ${week}`;
        htmlParts.push(`<section class="week-group" aria-label="${escapeHtml(weekLabel)}">`);
        htmlParts.push(`
          <div class="week-header">
            <h2 class="week-title">${escapeHtml(weekLabel)}</h2>
            <span class="week-subtitle tabular-nums">${days.length} ${days.length === 1 ? 'día' : 'días'}</span>
          </div>
          <div class="week-days">
        `);

        days.forEach((item) => {
          const isSelected = item.day_number === state.selectedDay;
          const draftTag = item.isEditedLocally
            ? '<span class="badge badge--editado">Borrador</span>'
            : '';
          htmlParts.push(`
            <button
              id="day-card-${item.day_number}"
              class="day-card ${isSelected ? 'day-card--selected' : ''}"
              data-day="${item.day_number}"
              aria-current="${isSelected ? 'true' : 'false'}"
              type="button"
            >
              <div class="day-card-top">
                <span class="badge badge--obsidian tabular-nums">Día ${padDay(item.day_number)}</span>
                <div class="day-card-badges">
                  ${draftTag}
                  <span class="badge badge--${escapeHtml(item.status)}" data-card-status="${item.day_number}">${escapeHtml(item.status)}</span>
                  <span class="badge">${escapeHtml(item.format)}</span>
                </div>
              </div>
              <div class="day-card-main">
                <div class="day-card-pillar">${escapeHtml(item.content_pillar)}</div>
                <h3 class="day-card-title">${escapeHtml(item.title)}</h3>
                <p class="day-card-hook">${escapeHtml(item.hook)}</p>
              </div>
              <div class="day-card-foot">
                <span>Semana ${item.week_number}</span>
                <span>Ver guion e imagen →</span>
              </div>
            </button>
          `);
        });

        htmlParts.push('</div></section>');
      });

    dom.roadmapList.innerHTML = htmlParts.join('');
  }

  function updateCardStatusBadge(dayNumber, status) {
    const badge = document.querySelector(`[data-card-status="${dayNumber}"]`);
    if (!badge) return;
    badge.className = `badge badge--${status}`;
    badge.textContent = status;
  }

  function updateInspectorStatusButtons(activeStatus) {
    if (!dom.inspectorStatusGroup) return;
    dom.inspectorStatusGroup.querySelectorAll('.status-btn').forEach((btn) => {
      const btnStatus = btn.getAttribute('data-status');
      btn.setAttribute('aria-pressed', btnStatus === activeStatus ? 'true' : 'false');
    });
  }

  function renderInspectorNow(rawItem) {
    if (!rawItem) {
      dom.inspectorTitle.textContent = 'Sin datos de roadmap';
      return;
    }

    const item = getEffectiveDayItem(rawItem);

    // Header badges (synchronized with body)
    dom.inspectorDayBadge.textContent = `Día ${padDay(item.day_number)}`;
    dom.inspectorWeekBadge.textContent = `Semana ${item.week_number}`;
    dom.inspectorFormatBadge.textContent = item.format;
    dom.inspectorPillarBadge.textContent = item.content_pillar;
    dom.localDraftBadge.classList.toggle('hidden', !item.isEditedLocally);

    // Status buttons
    updateInspectorStatusButtons(item.status);

    // Title, hook, prompt, script, caption
    dom.inspectorTitle.textContent = item.title;
    dom.inspectorHook.textContent = item.hook;
    dom.inspectorImagePrompt.textContent = item.image_prompt;
    dom.inspectorScript.textContent = item.script;
    dom.inspectorCaption.textContent = item.caption;

    // Visual aspect suggestion frame
    const isSquare = item.format === 'Carrusel';
    const ratio = isSquare ? '1:1' : '9:16';
    dom.visualAspectFrame.setAttribute('data-ratio', ratio);
    dom.visualFrameDay.textContent = `Día ${padDay(item.day_number)}`;
    dom.visualFrameFormat.textContent = item.format;
    dom.visualRatioLabel.textContent = isSquare
      ? 'Cuadrado 1:1 (1080×1080)'
      : 'Vertical 9:16 (1080×1920)';
    dom.visualCompositionTip.textContent = isSquare
      ? 'Portada limpia con titular de 5–7 palabras en alto contraste, un único punto focal y margen uniforme.'
      : 'Deja un 15% libre arriba y abajo para la interfaz de Reels/Stories y ubica el titular en el tercio superior.';

    // Reference video thumbnail + link
    const matchedVideo = item.reference_video_id
      ? state.youtubeStoredVideos.find((v) => v.videoId === item.reference_video_id)
      : null;

    if (matchedVideo && matchedVideo.thumbnailUrl) {
      dom.visualRefThumb.src = matchedVideo.thumbnailUrl;
      dom.visualRefThumb.classList.remove('hidden');
    } else {
      dom.visualRefThumb.removeAttribute('src');
      dom.visualRefThumb.classList.add('hidden');
    }

    if (item.reference_video_id) {
      dom.inspectorYoutubeRef.classList.remove('hidden');
      if (item.reference_video_id.startsWith('demo_yt_')) {
        dom.inspectorRefLink.textContent = `Referencia demo (${item.reference_video_id})`;
        dom.inspectorRefLink.removeAttribute('href');
      } else {
        dom.inspectorRefLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(item.reference_video_id)}`;
        dom.inspectorRefLink.textContent = matchedVideo
          ? `${matchedVideo.title} (${matchedVideo.channelTitle})`
          : `Ver en YouTube (${item.reference_video_id})`;
      }
    } else {
      dom.inspectorYoutubeRef.classList.add('hidden');
    }

    // Hashtags
    if (item.hashtags && item.hashtags.length > 0) {
      dom.inspectorHashtags.innerHTML = item.hashtags
        .map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`)
        .join('');
    } else {
      dom.inspectorHashtags.innerHTML = '';
    }

    // Edit mode state
    dom.btnToggleEditMode.textContent = state.isEditingDraft ? 'Ver detalle' : 'Editar';
    dom.draftEditorForm.classList.toggle('hidden', !state.isEditingDraft);
    if (state.isEditingDraft) {
      dom.editHookInput.value = item.hook;
      dom.editPromptInput.value = item.image_prompt;
      dom.editScriptInput.value = item.script;
      dom.editCaptionInput.value = item.caption;
      dom.btnResetDraft.disabled = !item.isEditedLocally;
    }
  }

  function renderYoutubeHistory() {
    if (!dom.ytHistoryList) return;
    if (!state.youtubeHistory || state.youtubeHistory.length === 0) {
      dom.ytHistoryList.innerHTML = '<span class="badge">Sin búsquedas recientes registradas</span>';
      return;
    }

    dom.ytHistoryList.innerHTML = state.youtubeHistory
      .slice(0, 12)
      .map(
        (h) => `
        <button class="history-chip" type="button" data-history-query="${escapeHtml(h.query)}">
          <span>${escapeHtml(h.query)}</span>
          <span class="badge tabular-nums">${Number(h.results_count) || 0}</span>
        </button>
      `
      )
      .join('');
  }

  function renderYoutubeCatalog() {
    renderVideoCards(dom.ytVideosGrid, state.youtubeStoredVideos);
  }

  function renderVideoCards(container, videos) {
    if (!container) return;
    if (!videos || videos.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>Sin videos disponibles</h3><p>Ejecuta una búsqueda arriba para consultar YouTube Data API v3.</p></div>';
      return;
    }

    container.innerHTML = videos
      .map((v) => {
        const watchUrl = v.isDemoMock
          ? ''
          : `https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`;
        const thumbHtml = v.thumbnailUrl
          ? `<img class="video-thumb" src="${escapeHtml(v.thumbnailUrl)}" alt="${escapeHtml(v.title)}" loading="lazy">`
          : '';
        const watchLinkHtml = watchUrl
          ? `<a class="btn btn-subtle btn-sm" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">Abrir video</a>`
          : '<span class="badge badge--simulated">Demo local</span>';

        return `
          <article class="video-card">
            ${thumbHtml}
            <div class="video-card-body">
              <h3 class="video-card-title">${escapeHtml(v.title)}</h3>
              <div class="video-card-meta">${escapeHtml(v.channelTitle)} · ${escapeHtml(formatDateTime(v.publishedAt))}</div>
              <div class="video-card-actions">
                ${watchLinkHtml}
                <button class="btn btn-primary btn-sm" type="button" data-use-topic="${escapeHtml(v.title)}">Usar tema en Roadmap</button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function renderOracleView() {
    if (dom.healthStatusText) {
      if (state.health && state.health.status === 'ok') {
        dom.healthStatusText.className = 'badge badge--live';
        dom.healthStatusText.textContent = 'Operativo (ok)';
        dom.healthUptimeText.textContent = formatUptime(state.health.uptime);
      } else {
        dom.healthStatusText.className = 'badge badge--error';
        dom.healthStatusText.textContent = 'Sin respuesta';
        dom.healthUptimeText.textContent = '—';
      }
    }

    if (dom.oracleLastStatus) {
      const exec = state.oracleStatus;
      if (exec && typeof exec === 'object') {
        const isErr = exec.status === 'error';
        dom.oracleLastStatus.className = `badge ${isErr ? 'badge--error' : 'badge--live'}`;
        dom.oracleLastStatus.textContent = exec.status || 'completado';
        dom.oracleLastTimestamp.textContent = formatDateTime(exec.triggeredAt);
        dom.oracleLastDetails.textContent = exec.details || `Nicho: ${exec.niche || '—'} · Videos: ${exec.youtubeVideosFound || 0}`;
      } else {
        dom.oracleLastStatus.className = 'badge';
        dom.oracleLastStatus.textContent = 'Sin ejecución previa';
        dom.oracleLastTimestamp.textContent = '—';
        dom.oracleLastDetails.textContent = typeof exec === 'string'
          ? exec
          : 'Aún no se ha disparado un ciclo en esta sesión.';
      }
    }
  }

  /* =========================================================
     Tab Switching & Responsive Mobile Drawer
     ========================================================= */
  async function switchTab(nextTab) {
    if (!['roadmap', 'youtube', 'oracle'].includes(nextTab) || state.activeTab === nextTab) return;
    const prevView = document.getElementById(`view-${state.activeTab}`);
    const nextView = document.getElementById(`view-${nextTab}`);
    state.activeTab = nextTab;

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      const active = btn.getAttribute('data-tab') === nextTab;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (prevView && nextView) {
      if (!prefersReducedMotion()) {
        prevView.classList.remove('fade-in');
        prevView.classList.add('fade-out');
        await new Promise((r) => setTimeout(r, 150));
        prevView.classList.remove('fade-out');
      }
      prevView.classList.add('hidden');
      nextView.classList.remove('hidden', 'fade-out');
      void nextView.offsetWidth;
      nextView.classList.add('fade-in');
    }

    if (nextTab === 'youtube') {
      loadYoutubeTabData(false);
    } else if (nextTab === 'oracle') {
      fetchHealth();
      fetchOracleStatus();
    }
  }

  function syncResponsiveInspector() {
    if (!dom.dayInspector || !dom.inspectorBackdrop) return;
    if (isDesktop()) {
      state.isDrawerOpen = false;
      dom.inspectorBackdrop.classList.add('hidden');
      dom.inspectorBackdrop.classList.remove('backdrop-fade-in', 'backdrop-fade-out');
      dom.dayInspector.classList.remove('hidden', 'fade-out', 'fade-in');
      dom.dayInspector.setAttribute('aria-hidden', 'false');
    } else if (!state.isDrawerOpen) {
      dom.inspectorBackdrop.classList.add('hidden');
      dom.dayInspector.classList.add('hidden');
      dom.dayInspector.setAttribute('aria-hidden', 'true');
    }
  }

  function openMobileInspector() {
    if (isDesktop() || !dom.dayInspector || !dom.inspectorBackdrop) return;
    state.isDrawerOpen = true;
    dom.inspectorBackdrop.classList.remove('hidden', 'backdrop-fade-out');
    dom.dayInspector.classList.remove('hidden', 'fade-out');
    void dom.dayInspector.offsetWidth;
    if (!prefersReducedMotion()) {
      dom.inspectorBackdrop.classList.add('backdrop-fade-in');
      dom.dayInspector.classList.add('fade-in');
    }
    dom.dayInspector.setAttribute('aria-hidden', 'false');
    dom.btnCloseDrawer?.focus();
  }

  function closeMobileInspector() {
    if (!state.isDrawerOpen || isDesktop()) return;
    state.isDrawerOpen = false;
    if (prefersReducedMotion()) {
      dom.inspectorBackdrop.classList.add('hidden');
      dom.dayInspector.classList.add('hidden');
      dom.dayInspector.setAttribute('aria-hidden', 'true');
      return;
    }
    dom.inspectorBackdrop.classList.remove('backdrop-fade-in');
    dom.inspectorBackdrop.classList.add('backdrop-fade-out');
    dom.dayInspector.classList.remove('fade-in');
    dom.dayInspector.classList.add('fade-out');
    setTimeout(() => {
      if (state.isDrawerOpen || isDesktop()) return;
      dom.inspectorBackdrop.classList.add('hidden');
      dom.inspectorBackdrop.classList.remove('backdrop-fade-out');
      dom.dayInspector.classList.add('hidden');
      dom.dayInspector.classList.remove('fade-out');
      dom.dayInspector.setAttribute('aria-hidden', 'true');
    }, 160);
  }

  /* =========================================================
     Clipboard & RFC-4180 CSV / JSON Export
     ========================================================= */
  async function copyText(text, label) {
    const value = String(text || '');
    if (!value) {
      showToast('No hay contenido para copiar.', 'error');
      return;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      showToast(`${label} copiado al portapapeles.`, 'success');
    } catch {
      showToast(`No se pudo copiar ${label.toLowerCase()}.`, 'error');
    }
  }

  function csvEscape(value) {
    const str = value === null || value === undefined ? '' : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  }

  function triggerDownload(content, mimeType, filename) {
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
    triggerDownload(csvContent, 'text/csv;charset=utf-8;', `roadmap_30_dias_${slugify(state.niche)}.csv`);
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

  /* =========================================================
     DOM Cache & Event Binding
     ========================================================= */
  function cacheDom() {
    const ids = [
      'tab-roadmap', 'tab-youtube', 'tab-oracle',
      'statusHealthBadge', 'statusOracleBadge', 'statusSourceBadge',
      'view-roadmap', 'view-youtube', 'view-oracle',
      'nicheInput', 'igAccountInput', 'btnLoadRoadmap', 'btnGenerateRoadmap', 'btnRunOracle',
      'btnExportCsv', 'btnExportJson', 'roadmapSourceNotice',
      'progressSummaryText', 'progressFill', 'countTotal', 'countPendiente', 'countGrabado', 'countEditado', 'countPublicado',
      'weekFilterGroup', 'formatFilterSelect', 'statusFilterSelect', 'searchRoadmapInput',
      'viewModeGrid', 'viewModeTimeline', 'btnResetFilters', 'btnEmptyResetFilters',
      'roadmapList', 'roadmapEmptyState',
      'inspectorBackdrop', 'dayInspector', 'dayInspectorContent',
      'inspectorDayBadge', 'inspectorWeekBadge', 'inspectorFormatBadge', 'inspectorPillarBadge', 'localDraftBadge',
      'btnPrevDay', 'btnNextDay', 'btnToggleEditMode', 'btnCloseDrawer', 'inspectorStatusGroup',
      'inspectorTitle', 'inspectorHook', 'visualAspectFrame', 'visualFrameDay', 'visualFrameFormat',
      'visualRatioLabel', 'visualRefThumb', 'visualCompositionTip',
      'inspectorImagePrompt', 'inspectorScript', 'inspectorCaption', 'inspectorHashtags',
      'inspectorYoutubeRef', 'inspectorRefLink',
      'btnCopyHook', 'btnCopyPrompt', 'btnCopyScript', 'btnCopyCaption',
      'draftEditorForm', 'editHookInput', 'editPromptInput', 'editScriptInput', 'editCaptionInput',
      'btnSaveDraft', 'btnResetDraft', 'btnCancelDraft',
      'ytSearchForm', 'ytSearchInput', 'ytMaxResultsSelect', 'btnYtSearch', 'ytHistoryList',
      'ytResultsSection', 'ytResultsList', 'ytVideosGrid',
      'healthStatusText', 'healthUptimeText', 'oracleLastStatus', 'oracleLastTimestamp', 'oracleLastDetails',
      'btnOracleTabRun', 'toastContainer',
    ];
    ids.forEach((id) => {
      dom[id] = document.getElementById(id);
    });
  }

  function resetFilters() {
    state.filters = { week: 'all', format: 'all', status: 'all', query: '' };
    dom.searchRoadmapInput.value = '';
    dom.formatFilterSelect.value = 'all';
    dom.statusFilterSelect.value = 'all';
    dom.weekFilterGroup.querySelectorAll('[data-week]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-week') === 'all');
    });
    transitionSwap(dom.roadmapList, () => renderRoadmapList());
  }

  function bindEvents() {
    document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    dom.btnLoadRoadmap?.addEventListener('click', () => {
      fetchRoadmap(dom.nicheInput.value.trim() || DEFAULT_NICHE);
    });
    dom.nicheInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fetchRoadmap(dom.nicheInput.value.trim() || DEFAULT_NICHE);
      }
    });

    dom.btnGenerateRoadmap?.addEventListener('click', handleGenerateRoadmap);
    dom.btnRunOracle?.addEventListener('click', handleOracleRun);
    dom.btnOracleTabRun?.addEventListener('click', handleOracleRun);
    dom.btnExportCsv?.addEventListener('click', downloadCSV);
    dom.btnExportJson?.addEventListener('click', downloadJSON);

    dom.weekFilterGroup?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-week]');
      if (!btn) return;
      const weekVal = btn.getAttribute('data-week');
      state.filters.week = weekVal === 'all' ? 'all' : Number(weekVal);
      dom.weekFilterGroup.querySelectorAll('[data-week]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      transitionSwap(dom.roadmapList, () => renderRoadmapList());
    });

    dom.formatFilterSelect?.addEventListener('change', (e) => {
      state.filters.format = e.target.value;
      transitionSwap(dom.roadmapList, () => renderRoadmapList());
    });

    dom.statusFilterSelect?.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      transitionSwap(dom.roadmapList, () => renderRoadmapList());
    });

    dom.searchRoadmapInput?.addEventListener('input', (e) => {
      state.filters.query = e.target.value;
      transitionSwap(dom.roadmapList, () => renderRoadmapList(), 120);
    });

    dom.viewModeGrid?.addEventListener('click', () => {
      if (state.viewMode === 'grid') return;
      state.viewMode = 'grid';
      dom.viewModeGrid.classList.add('is-active');
      dom.viewModeTimeline.classList.remove('is-active');
      transitionSwap(dom.roadmapList, () => renderRoadmapList());
    });

    dom.viewModeTimeline?.addEventListener('click', () => {
      if (state.viewMode === 'timeline') return;
      state.viewMode = 'timeline';
      dom.viewModeTimeline.classList.add('is-active');
      dom.viewModeGrid.classList.remove('is-active');
      transitionSwap(dom.roadmapList, () => renderRoadmapList());
    });

    dom.btnResetFilters?.addEventListener('click', resetFilters);
    dom.btnEmptyResetFilters?.addEventListener('click', resetFilters);

    dom.roadmapList?.addEventListener('click', (e) => {
      const card = e.target.closest('.day-card[data-day]');
      if (!card) return;
      const dayNum = Number(card.getAttribute('data-day'));
      selectDay(dayNum, { openDrawer: true });
    });

    dom.btnPrevDay?.addEventListener('click', () => stepDay(-1));
    dom.btnNextDay?.addEventListener('click', () => stepDay(1));
    dom.btnCloseDrawer?.addEventListener('click', closeMobileInspector);
    dom.inspectorBackdrop?.addEventListener('click', closeMobileInspector);

    dom.inspectorStatusGroup?.addEventListener('click', (e) => {
      const btn = e.target.closest('.status-btn[data-status]');
      if (!btn) return;
      handleStatusChange(state.selectedDay, btn.getAttribute('data-status'));
    });

    dom.btnCopyHook?.addEventListener('click', () => copyText(dom.inspectorHook.textContent, 'Gancho'));
    dom.btnCopyPrompt?.addEventListener('click', () => copyText(dom.inspectorImagePrompt.textContent, 'Prompt de imagen'));
    dom.btnCopyScript?.addEventListener('click', () => copyText(dom.inspectorScript.textContent, 'Guion'));
    dom.btnCopyCaption?.addEventListener('click', () => {
      const tags = Array.from(dom.inspectorHashtags.querySelectorAll('.badge')).map((el) => el.textContent).join(' ');
      const full = tags ? `${dom.inspectorCaption.textContent}\n\n${tags}` : dom.inspectorCaption.textContent;
      copyText(full, 'Caption');
    });

    dom.btnToggleEditMode?.addEventListener('click', () => {
      const item = getSelectedRawItem();
      if (!item) return;
      state.isEditingDraft = !state.isEditingDraft;
      transitionSwap(dom.dayInspectorContent, () => renderInspectorNow(item));
    });

    dom.btnCancelDraft?.addEventListener('click', () => {
      const item = getSelectedRawItem();
      state.isEditingDraft = false;
      transitionSwap(dom.dayInspectorContent, () => renderInspectorNow(item));
    });

    dom.btnResetDraft?.addEventListener('click', () => {
      const item = getSelectedRawItem();
      if (item) restoreDayDraft(item);
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
      transitionSwap(dom.dayInspectorContent, () => renderInspectorNow(item));
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
      dom.nicheInput.value = topic;
      state.niche = topic;
      switchTab('roadmap').then(() => handleGenerateRoadmap());
    };
    dom.ytResultsList?.addEventListener('click', handleUseTopicClick);
    dom.ytVideosGrid?.addEventListener('click', handleUseTopicClick);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isDrawerOpen && !isDesktop()) {
        closeMobileInspector();
        return;
      }
      if (state.activeTab !== 'roadmap') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') stepDay(-1);
      if (e.key === 'ArrowRight') stepDay(1);
    });

    if (desktopMq && typeof desktopMq.addEventListener === 'function') {
      desktopMq.addEventListener('change', syncResponsiveInspector);
    } else {
      window.addEventListener('resize', syncResponsiveInspector);
    }
  }

  /* =========================================================
     Boot Sequence
     ========================================================= */
  document.addEventListener('DOMContentLoaded', async () => {
    cacheDom();
    bindEvents();
    syncResponsiveInspector();

    const initialNiche = dom.nicheInput?.value.trim() || DEFAULT_NICHE;
    await Promise.allSettled([
      fetchRoadmap(initialNiche),
      fetchHealth(),
      fetchOracleStatus(),
      fetchStoredVideosQuietly(),
    ]);

    // Refrescar inspector si los videos llegaron después del roadmap
    const selected = getSelectedRawItem();
    if (selected) {
      renderInspectorNow(selected);
    }
  });
})();
