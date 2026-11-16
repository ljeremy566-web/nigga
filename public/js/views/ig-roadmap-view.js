import {
  dom,
  state,
  getEffectiveIgDayItem,
  getFilteredIgRoadmap,
} from '../state.js';
import {
  escapeHtml,
  formatStatusLabel,
  isDesktop,
  padDay,
  prefersReducedMotion,
} from '../utils.js';
import {
  buildDayDotsHtml,
  buildRoadmapGroupsHtml,
  parseScriptSegments,
} from './roadmap-shared.js';

export function setIgRoadmapLinearProgress(visible) {
  if (!dom.igRoadmapLinearProgress) return;
  dom.igRoadmapLinearProgress.classList.toggle('hidden', !visible);
}

export function renderIgRoadmapSkeletons() {
  if (!dom.igRoadmapList) return;
  dom.igRoadmapEmptyState?.classList.add('hidden');
  dom.igRoadmapList.innerHTML = `
    <div class="skeleton-grid" aria-busy="true" aria-label="Cargando tarjetas del Roadmap IG">
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div></div>
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div></div>
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div></div>
    </div>
  `;
}

export function updateIgSourceNotice(message, isWarn = false) {
  if (!dom.igRoadmapSourceNotice) return;
  if (!message) {
    dom.igRoadmapSourceNotice.className = 'source-notice md-banner hidden';
    dom.igRoadmapSourceNotice.textContent = '';
    return;
  }
  dom.igRoadmapSourceNotice.className = `source-notice md-banner ${
    isWarn ? 'md-banner--warn source-notice--warn' : ''
  } fade-in`;
  dom.igRoadmapSourceNotice.innerHTML = `
    <span class="material-symbols-rounded icon-sm" aria-hidden="true">${isWarn ? 'cloud_off' : 'movie_filter'}</span>
    <span>${escapeHtml(message)}</span>
  `;
}

export function renderIgDayDotsStrip() {
  if (!dom.igDayDotsStrip) return;
  dom.igDayDotsStrip.innerHTML = buildDayDotsHtml(
    state.igRoadmap,
    state.igSelectedDay,
    'data-ig-dot-day'
  );
}

export function renderIgProgressAndCounters() {
  const total = state.igRoadmap.length;
  const counts = { pendiente: 0, grabado: 0, editado: 0, publicado: 0 };
  state.igRoadmap.forEach((d) => {
    if (counts[d.status] !== undefined) counts[d.status] += 1;
  });

  const pct = total > 0 ? Math.round((counts.publicado / total) * 100) : 0;
  if (dom.igProgressSummaryText) {
    dom.igProgressSummaryText.textContent = `${counts.publicado} de ${total} publicados`;
  }
  if (dom.igProgressFill) {
    dom.igProgressFill.style.width = `${pct}%`;
  }
  if (dom.igPlanProgressSub) {
    const inProgress = counts.grabado + counts.editado;
    if (total === 0) {
      dom.igPlanProgressSub.textContent = 'Captura Reels de IG y genera tu plan aparte.';
    } else if (counts.publicado === total) {
      dom.igPlanProgressSub.textContent = '¡Plan IG de 30 días completado!';
    } else if (counts.publicado > 0 || inProgress > 0) {
      dom.igPlanProgressSub.textContent = `${inProgress} en producción · ${counts.publicado} publicados.`;
    } else {
      dom.igPlanProgressSub.textContent = 'Alimentado con contenido extraído de Instagram.';
    }
  }
  if (dom.igRoadmapIdeasCount) {
    dom.igRoadmapIdeasCount.textContent =
      total > 0
        ? `${total} ideas · Basadas en IG Reels`
        : 'Sin roadmap IG generado aún';
  }

  renderIgDayDotsStrip();
}

export function renderIgRoadmapList() {
  if (!dom.igRoadmapList) return;
  dom.igRoadmapList.className = `roadmap-list ${
    state.igViewMode === 'timeline' ? 'roadmap-list--timeline' : 'roadmap-list--grid'
  }`;

  const filtered = getFilteredIgRoadmap();
  if (filtered.length === 0) {
    dom.igRoadmapList.innerHTML = '';
    dom.igRoadmapEmptyState?.classList.remove('hidden');
    return;
  }

  dom.igRoadmapEmptyState?.classList.add('hidden');

  const hasActiveFilter =
    state.igFilters.week !== 'all' ||
    state.igFilters.format !== 'all' ||
    state.igFilters.status !== 'all' ||
    state.igFilters.query.trim() !== '';

  dom.igRoadmapList.innerHTML = buildRoadmapGroupsHtml(filtered, {
    selectedDay: state.igSelectedDay,
    expandedWeeks: state.igExpandedWeeks,
    hasActiveFilter,
    getEffectiveItem: getEffectiveIgDayItem,
    cardClass: 'ig-day-card',
    cardIdPrefix: 'ig-day-card',
    dayAttr: 'data-ig-day',
    statusAttr: 'data-ig-card-status',
    expandAttr: 'data-ig-expand-day',
    toggleWeekAttr: 'data-ig-toggle-week',
  });
}

export function updateIgCardStatusBadge(dayNumber, status) {
  const badge = dom.igRoadmapList?.querySelector(`[data-ig-card-status="${dayNumber}"]`);
  if (badge) {
    badge.className = `day-card-status-text md-status-chip--${status}`;
    badge.textContent = formatStatusLabel(status);
  }
  const dot = dom.igDayDotsStrip?.querySelector(`[data-ig-dot-day="${dayNumber}"]`);
  if (dot) {
    dot.classList.toggle('is-published', status === 'publicado');
  }
}

export function setIgInspectorTab(tabName) {
  const valid = ['script', 'visual', 'caption'];
  const next = valid.includes(tabName) ? tabName : 'script';
  state.igInspectorTab = next;

  dom.igInspectorSubtabs?.querySelectorAll('[data-ig-inspector-tab]').forEach((btn) => {
    const active = btn.getAttribute('data-ig-inspector-tab') === next;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  dom.igDayInspector?.querySelectorAll('[data-ig-inspector-panel]').forEach((panel) => {
    const active = panel.getAttribute('data-ig-inspector-panel') === next;
    panel.classList.toggle('is-active', active);
  });
}

export function setIgInspectorExpanded(expanded) {
  if (!isDesktop()) {
    state.igIsInspectorExpanded = false;
    dom.igRoadmapWorkspace?.classList.remove('is-inspector-expanded');
    dom.igDayInspector?.classList.remove('is-expanded');
    return;
  }

  const next = Boolean(expanded);
  const changed = state.igIsInspectorExpanded !== next;
  state.igIsInspectorExpanded = next;
  dom.igRoadmapWorkspace?.classList.toggle('is-inspector-expanded', state.igIsInspectorExpanded);
  dom.igDayInspector?.classList.toggle('is-expanded', state.igIsInspectorExpanded);

  if (dom.btnIgExpandInspector) {
    dom.btnIgExpandInspector.setAttribute('aria-expanded', state.igIsInspectorExpanded ? 'true' : 'false');
  }
  if (dom.igExpandInspectorLabel) {
    dom.igExpandInspectorLabel.textContent = state.igIsInspectorExpanded ? 'Volver al roadmap' : 'Expandir';
  }
  if (changed && state.igIsInspectorExpanded && dom.igDayInspector) {
    dom.igDayInspector.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  }
}

export function updateIgPrevNextButtons() {
  if (!dom.btnIgPrevDay || !dom.btnIgNextDay) return;
  const filtered = getFilteredIgRoadmap();
  const list = filtered.length > 0 ? filtered : state.igRoadmap;
  if (list.length === 0) {
    dom.btnIgPrevDay.disabled = true;
    dom.btnIgNextDay.disabled = true;
    return;
  }
  const idx = list.findIndex((d) => d.day_number === state.igSelectedDay);
  dom.btnIgPrevDay.disabled = idx <= 0;
  dom.btnIgNextDay.disabled = idx === -1 || idx >= list.length - 1;
}

export function updateIgInspectorStatusButtons(activeStatus) {
  if (dom.igInspectorStatusSelect) {
    dom.igInspectorStatusSelect.value = activeStatus;
  }
  if (dom.igInspectorStatusDot) {
    dom.igInspectorStatusDot.setAttribute('data-status', activeStatus);
  }
  if (!dom.igInspectorStatusGroup) return;
  dom.igInspectorStatusGroup.querySelectorAll('.status-btn').forEach((btn) => {
    const btnStatus = btn.getAttribute('data-status');
    const isActive = btnStatus === activeStatus;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    btn.textContent = formatStatusLabel(btnStatus);
  });
}

export function renderIgInspectorNow(rawItem) {
  if (!dom.igInspectorTitle) return;
  if (!rawItem) {
    dom.igInspectorDayBadge.textContent = 'DÍA —';
    if (dom.igInspectorDayTotal) dom.igInspectorDayTotal.textContent = '/ 30';
    dom.igInspectorTitle.textContent = 'Genera tu Roadmap IG para ver cada día';
    dom.igInspectorHook.textContent = 'Captura Reels en "IG Reels" o pulsa "Generar 30 días IG".';
    dom.igInspectorImagePrompt.textContent = '—';
    dom.igInspectorScript.textContent = '—';
    dom.igInspectorCaption.textContent = '—';
    if (dom.igInspectorDevText) dom.igInspectorDevText.textContent = '—';
    if (dom.igInspectorCloseText) dom.igInspectorCloseText.textContent = '—';
    if (dom.igInspectorHashtags) dom.igInspectorHashtags.innerHTML = '';
    dom.igInspectorReelRef?.classList.add('hidden');
    dom.igVisualRefThumb?.classList.add('hidden');
    dom.igDraftEditorForm?.classList.add('hidden');
    updateIgPrevNextButtons();
    return;
  }

  const item = getEffectiveIgDayItem(rawItem);

  dom.igInspectorDayBadge.textContent = `DÍA ${padDay(item.day_number)}`;
  if (dom.igInspectorDayTotal) {
    dom.igInspectorDayTotal.textContent = `/ ${state.igRoadmap.length || 30}`;
  }
  dom.igInspectorWeekBadge.textContent = `Semana ${item.week_number}`;
  dom.igInspectorFormatBadge.textContent = item.format;
  dom.igInspectorPillarBadge.textContent = item.content_pillar;
  dom.igLocalDraftBadge.classList.toggle('hidden', !item.isEditedLocally);

  updateIgInspectorStatusButtons(item.status);
  updateIgPrevNextButtons();

  dom.igInspectorTitle.textContent = item.title;
  dom.igInspectorHook.textContent = item.hook;
  dom.igInspectorImagePrompt.textContent = item.image_prompt;
  dom.igInspectorScript.textContent = item.script;
  dom.igInspectorCaption.textContent = item.caption;

  const parsed = parseScriptSegments(item.script, item.title);
  if (dom.igInspectorScreenText) dom.igInspectorScreenText.textContent = parsed.screenCue;
  if (dom.igInspectorDevText) dom.igInspectorDevText.textContent = parsed.development;
  if (dom.igInspectorCloseText) dom.igInspectorCloseText.textContent = parsed.closing;

  const isSquare = item.format === 'Carrusel';
  const ratio = isSquare ? '1:1' : '9:16';
  dom.igVisualAspectFrame.setAttribute('data-ratio', ratio);
  dom.igVisualFrameDay.textContent = `Día ${padDay(item.day_number)}`;
  dom.igVisualFrameFormat.textContent = item.format;
  if (dom.igVisualFrameHookPreview) {
    dom.igVisualFrameHookPreview.textContent = item.hook || item.title;
  }
  dom.igVisualRatioLabel.textContent = isSquare ? '1:1 (1080×1080)' : '9:16 (1080×1920)';
  dom.igVisualCompositionTip.textContent = isSquare
    ? 'Portada limpia con titular de 5–7 palabras en alto contraste, un único punto focal y margen uniforme.'
    : 'Deja un 15% libre arriba y abajo para la interfaz de Reels/Stories y ubica el titular en el tercio superior.';

  const matchedReel = item.reference_reel_shortcode
    ? state.igReels.find((r) => r.shortcode === item.reference_reel_shortcode)
    : null;

  if (matchedReel && matchedReel.thumbnailDataUrl) {
    dom.igVisualRefThumb.src = matchedReel.thumbnailDataUrl;
    dom.igVisualRefThumb.classList.remove('hidden');
  } else {
    dom.igVisualRefThumb.removeAttribute('src');
    dom.igVisualRefThumb.classList.add('hidden');
  }

  if (item.reference_reel_url || item.reference_reel_shortcode) {
    dom.igInspectorReelRef.classList.remove('hidden');
    const url =
      item.reference_reel_url ||
      `https://www.instagram.com/reel/${encodeURIComponent(item.reference_reel_shortcode)}/`;
    dom.igInspectorReelLink.href = url;
    dom.igInspectorReelLink.textContent = matchedReel
      ? `${matchedReel.authorHandle} · Reel ${matchedReel.shortcode}`
      : `${item.reference_reel_author || '@instagram'} · Reel ${item.reference_reel_shortcode || ''}`;
  } else {
    dom.igInspectorReelRef.classList.add('hidden');
  }

  if (item.hashtags && item.hashtags.length > 0) {
    dom.igInspectorHashtags.innerHTML = item.hashtags
      .map((tag) => `<span class="md-status-chip md-status-chip--plain badge">${escapeHtml(tag)}</span>`)
      .join('');
  } else {
    dom.igInspectorHashtags.innerHTML = '';
  }

  dom.btnIgToggleEditMode.textContent = state.igIsEditingDraft ? 'Ver detalle' : 'Editar';
  dom.igDraftEditorForm.classList.toggle('hidden', !state.igIsEditingDraft);
  if (state.igIsEditingDraft) {
    dom.igEditHookInput.value = item.hook;
    dom.igEditPromptInput.value = item.image_prompt;
    dom.igEditScriptInput.value = item.script;
    dom.igEditCaptionInput.value = item.caption;
    dom.btnIgResetDraft.disabled = !item.isEditedLocally;
  }

  setIgInspectorTab(state.igInspectorTab);
}

export function syncResponsiveIgInspector() {
  if (!dom.igDayInspector || !dom.igInspectorBackdrop) return;
  if (isDesktop()) {
    state.igIsDrawerOpen = false;
    dom.igInspectorBackdrop.classList.add('hidden');
    dom.igInspectorBackdrop.setAttribute('aria-hidden', 'true');
    dom.igDayInspector.classList.remove('hidden', 'fade-out', 'fade-in');
    dom.igDayInspector.setAttribute('role', 'region');
    dom.igDayInspector.removeAttribute('aria-modal');
    dom.igDayInspector.setAttribute('aria-hidden', 'false');
    setIgInspectorExpanded(state.igIsInspectorExpanded);
  } else {
    setIgInspectorExpanded(false);
    if (!state.igIsDrawerOpen) {
      dom.igInspectorBackdrop.classList.add('hidden');
      dom.igInspectorBackdrop.setAttribute('aria-hidden', 'true');
      dom.igDayInspector.classList.add('hidden');
      dom.igDayInspector.setAttribute('role', 'dialog');
      dom.igDayInspector.setAttribute('aria-modal', 'true');
      dom.igDayInspector.setAttribute('aria-hidden', 'true');
    }
  }
}

export function openMobileIgInspector(triggerEl) {
  if (isDesktop() || !dom.igDayInspector || !dom.igInspectorBackdrop) return;
  state.igIsDrawerOpen = true;
  state.igLastDrawerTrigger = triggerEl || document.getElementById(`ig-day-card-${state.igSelectedDay}`);
  document.body.classList.add('is-scroll-locked');
  document.body.style.overflow = 'hidden';
  dom.igInspectorBackdrop.classList.remove('hidden');
  dom.igInspectorBackdrop.setAttribute('aria-hidden', 'false');
  dom.igDayInspector.classList.remove('hidden', 'fade-out');
  dom.igDayInspector.setAttribute('role', 'dialog');
  dom.igDayInspector.setAttribute('aria-modal', 'true');
  dom.igDayInspector.setAttribute('aria-hidden', 'false');
  dom.btnIgCloseDrawer?.focus();
}

export function closeMobileIgInspector({ restoreFocus = true } = {}) {
  if (!state.igIsDrawerOpen) return;
  state.igIsDrawerOpen = false;
  document.body.classList.remove('is-scroll-locked');
  document.body.style.overflow = '';
  dom.igInspectorBackdrop?.classList.add('hidden');
  dom.igInspectorBackdrop?.setAttribute('aria-hidden', 'true');
  if (dom.igDayInspector && !isDesktop()) {
    dom.igDayInspector.classList.add('hidden');
    dom.igDayInspector.setAttribute('aria-hidden', 'true');
  }
  if (restoreFocus) {
    const targetCard =
      document.getElementById(`ig-day-card-${state.igSelectedDay}`) || state.igLastDrawerTrigger;
    targetCard?.focus?.();
  }
  state.igLastDrawerTrigger = null;
}
