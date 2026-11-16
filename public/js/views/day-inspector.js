import {
  dom,
  state,
  getEffectiveDayItem,
  getFilteredRoadmap,
} from '../state.js';
import {
  escapeHtml,
  formatStatusLabel,
  isDesktop,
  padDay,
  prefersReducedMotion,
} from '../utils.js';
import { parseScriptSegments } from './roadmap-shared.js';

function getFocusableInspectorElements() {
  if (!dom.dayInspector) return [];
  return Array.from(
    dom.dayInspector.querySelectorAll(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => {
    if (el.closest('.hidden')) return false;
    const cs = window.getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  });
}

function handleMobileInspectorKeydown(e) {
  if (!state.isDrawerOpen || isDesktop() || !dom.dayInspector) return;
  if (e.key !== 'Tab') return;

  const focusables = getFocusableInspectorElements();
  if (focusables.length === 0) {
    e.preventDefault();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (e.shiftKey) {
    if (active === first || !dom.dayInspector.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else if (active === last || !dom.dayInspector.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}

export function setInspectorTab(tabName) {
  const valid = ['script', 'visual', 'caption'];
  const next = valid.includes(tabName) ? tabName : 'script';
  state.inspectorTab = next;

  dom.inspectorSubtabs?.querySelectorAll('[data-inspector-tab]').forEach((btn) => {
    const active = btn.getAttribute('data-inspector-tab') === next;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  dom.dayInspector?.querySelectorAll('[data-inspector-panel]').forEach((panel) => {
    const active = panel.getAttribute('data-inspector-panel') === next;
    panel.classList.toggle('is-active', active);
  });
}

export function setInspectorExpanded(expanded) {
  if (!isDesktop()) {
    state.isInspectorExpanded = false;
    dom.roadmapWorkspace?.classList.remove('is-inspector-expanded');
    dom.dayInspector?.classList.remove('is-expanded');
    return;
  }

  const next = Boolean(expanded);
  const changed = state.isInspectorExpanded !== next;
  state.isInspectorExpanded = next;
  dom.roadmapWorkspace?.classList.toggle('is-inspector-expanded', state.isInspectorExpanded);
  dom.dayInspector?.classList.toggle('is-expanded', state.isInspectorExpanded);

  if (dom.btnExpandInspector) {
    dom.btnExpandInspector.setAttribute('aria-expanded', state.isInspectorExpanded ? 'true' : 'false');
    dom.btnExpandInspector.title = state.isInspectorExpanded
      ? 'Contraer y volver al listado del roadmap'
      : 'Expandir para ver guion, visual y caption cómodamente';
  }
  if (dom.expandInspectorLabel) {
    dom.expandInspectorLabel.textContent = state.isInspectorExpanded ? 'Volver al roadmap' : 'Expandir';
  }
  if (changed && state.isInspectorExpanded && dom.dayInspector) {
    dom.dayInspector.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
}

export function updatePrevNextButtons() {
  if (!dom.btnPrevDay || !dom.btnNextDay) return;
  const filtered = getFilteredRoadmap();
  const list = filtered.length > 0 ? filtered : state.roadmap;
  if (list.length === 0) {
    dom.btnPrevDay.disabled = true;
    dom.btnNextDay.disabled = true;
    return;
  }
  const idx = list.findIndex((d) => d.day_number === state.selectedDay);
  dom.btnPrevDay.disabled = idx <= 0;
  dom.btnNextDay.disabled = idx === -1 || idx >= list.length - 1;
}

export function updateInspectorStatusButtons(activeStatus) {
  if (dom.inspectorStatusSelect) {
    dom.inspectorStatusSelect.value = activeStatus;
  }
  if (dom.inspectorStatusDot) {
    dom.inspectorStatusDot.setAttribute('data-status', activeStatus);
  }
  if (!dom.inspectorStatusGroup) return;
  dom.inspectorStatusGroup.querySelectorAll('.status-btn').forEach((btn) => {
    const btnStatus = btn.getAttribute('data-status');
    const isActive = btnStatus === activeStatus;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    btn.textContent = formatStatusLabel(btnStatus);
  });
}

export function renderInspectorNow(rawItem) {
  if (!dom.inspectorTitle) return;
  if (!rawItem) {
    dom.inspectorTitle.textContent = 'Sin datos de roadmap';
    updatePrevNextButtons();
    return;
  }

  const item = getEffectiveDayItem(rawItem);

  dom.inspectorDayBadge.textContent = `DÍA ${padDay(item.day_number)}`;
  if (dom.inspectorDayTotal) {
    dom.inspectorDayTotal.textContent = `/ ${state.roadmap.length || 30}`;
  }
  dom.inspectorWeekBadge.textContent = `Semana ${item.week_number}`;
  dom.inspectorFormatBadge.textContent = item.format;
  dom.inspectorPillarBadge.textContent = item.content_pillar;
  dom.localDraftBadge.classList.toggle('hidden', !item.isEditedLocally);

  updateInspectorStatusButtons(item.status);
  updatePrevNextButtons();

  dom.inspectorTitle.textContent = item.title;
  dom.inspectorHook.textContent = item.hook;
  dom.inspectorImagePrompt.textContent = item.image_prompt;
  dom.inspectorScript.textContent = item.script;
  dom.inspectorCaption.textContent = item.caption;

  const parsed = parseScriptSegments(item.script, item.title);
  if (dom.inspectorScreenText) {
    dom.inspectorScreenText.textContent = parsed.screenCue;
  }
  if (dom.inspectorDevText) {
    dom.inspectorDevText.textContent = parsed.development;
  }
  if (dom.inspectorCloseText) {
    dom.inspectorCloseText.textContent = parsed.closing;
  }

  const isSquare = item.format === 'Carrusel';
  const ratio = isSquare ? '1:1' : '9:16';
  dom.visualAspectFrame.setAttribute('data-ratio', ratio);
  dom.visualFrameDay.textContent = `Día ${padDay(item.day_number)}`;
  dom.visualFrameFormat.textContent = item.format;
  if (dom.visualFrameHookPreview) {
    dom.visualFrameHookPreview.textContent = item.hook || item.title;
  }
  dom.visualRatioLabel.textContent = isSquare ? '1:1 (1080×1080)' : '9:16 (1080×1920)';
  dom.visualCompositionTip.textContent = isSquare
    ? 'Portada limpia con titular de 5–7 palabras en alto contraste, un único punto focal y margen uniforme.'
    : 'Deja un 15% libre arriba y abajo para la interfaz de Reels/Stories y ubica el titular en el tercio superior.';

  const matchedVideo = item.reference_video_id
    ? state.youtubeStoredVideos.find((v) => v.videoId === item.reference_video_id)
    : null;

  if (matchedVideo && matchedVideo.thumbnailUrl) {
    dom.visualRefThumb.onerror = () => {
      dom.visualRefThumb.classList.add('hidden');
      dom.visualRefThumb.removeAttribute('src');
    };
    dom.visualRefThumb.src = matchedVideo.thumbnailUrl;
    dom.visualRefThumb.classList.remove('hidden');
  } else {
    dom.visualRefThumb.onerror = null;
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
      dom.inspectorRefLink.setAttribute('target', '_blank');
      dom.inspectorRefLink.setAttribute('rel', 'noopener noreferrer');
      dom.inspectorRefLink.textContent = matchedVideo
        ? `${matchedVideo.title} (${matchedVideo.channelTitle})`
        : `Ver en YouTube (${item.reference_video_id})`;
    }
  } else {
    dom.inspectorYoutubeRef.classList.add('hidden');
  }

  if (item.hashtags && item.hashtags.length > 0) {
    dom.inspectorHashtags.innerHTML = item.hashtags
      .map((tag) => `<span class="md-status-chip md-status-chip--plain badge">${escapeHtml(tag)}</span>`)
      .join('');
  } else {
    dom.inspectorHashtags.innerHTML = '';
  }

  dom.btnToggleEditMode.textContent = state.isEditingDraft ? 'Ver detalle' : 'Editar';
  dom.draftEditorForm.classList.toggle('hidden', !state.isEditingDraft);
  if (state.isEditingDraft) {
    dom.editHookInput.value = item.hook;
    dom.editPromptInput.value = item.image_prompt;
    dom.editScriptInput.value = item.script;
    dom.editCaptionInput.value = item.caption;
    dom.btnResetDraft.disabled = !item.isEditedLocally;
  }

  setInspectorTab(state.inspectorTab);
}

export function syncResponsiveInspector() {
  if (!dom.dayInspector || !dom.inspectorBackdrop) return;
  if (isDesktop()) {
    state.isDrawerOpen = false;
    document.removeEventListener('keydown', handleMobileInspectorKeydown, true);
    document.body.classList.remove('is-scroll-locked');
    document.body.style.overflow = '';
    dom.inspectorBackdrop.classList.add('hidden');
    dom.inspectorBackdrop.setAttribute('aria-hidden', 'true');
    dom.dayInspector.classList.remove('hidden', 'fade-out', 'fade-in');
    dom.dayInspector.setAttribute('role', 'region');
    dom.dayInspector.removeAttribute('aria-modal');
    dom.dayInspector.setAttribute('aria-hidden', 'false');
    setInspectorExpanded(state.isInspectorExpanded);
  } else {
    setInspectorExpanded(false);
    if (!state.isDrawerOpen) {
      document.removeEventListener('keydown', handleMobileInspectorKeydown, true);
      document.body.classList.remove('is-scroll-locked');
      document.body.style.overflow = '';
      dom.inspectorBackdrop.classList.add('hidden');
      dom.inspectorBackdrop.setAttribute('aria-hidden', 'true');
      dom.dayInspector.classList.add('hidden');
      dom.dayInspector.setAttribute('role', 'dialog');
      dom.dayInspector.setAttribute('aria-modal', 'true');
      dom.dayInspector.setAttribute('aria-hidden', 'true');
    }
  }
}

export function openMobileInspector(triggerEl) {
  if (isDesktop() || !dom.dayInspector || !dom.inspectorBackdrop) return;
  state.isDrawerOpen = true;
  state.lastDrawerTrigger = triggerEl || document.getElementById(`day-card-${state.selectedDay}`);

  document.body.classList.add('is-scroll-locked');
  document.body.style.overflow = 'hidden';

  dom.inspectorBackdrop.classList.remove('hidden');
  dom.inspectorBackdrop.setAttribute('aria-hidden', 'false');

  dom.dayInspector.classList.remove('hidden', 'fade-out');
  dom.dayInspector.setAttribute('role', 'dialog');
  dom.dayInspector.setAttribute('aria-modal', 'true');
  dom.dayInspector.setAttribute('aria-hidden', 'false');

  if (!prefersReducedMotion()) {
    dom.dayInspector.classList.add('fade-in');
  }

  document.addEventListener('keydown', handleMobileInspectorKeydown, true);
  dom.btnCloseDrawer?.focus();
}

export function closeMobileInspector({ restoreFocus = true } = {}) {
  if (!state.isDrawerOpen) return;
  state.isDrawerOpen = false;
  document.removeEventListener('keydown', handleMobileInspectorKeydown, true);
  document.body.classList.remove('is-scroll-locked');
  document.body.style.overflow = '';

  if (dom.inspectorBackdrop) {
    dom.inspectorBackdrop.classList.add('hidden');
    dom.inspectorBackdrop.setAttribute('aria-hidden', 'true');
  }
  if (dom.dayInspector && !isDesktop()) {
    dom.dayInspector.classList.add('hidden');
    dom.dayInspector.classList.remove('fade-in', 'fade-out');
    dom.dayInspector.setAttribute('aria-hidden', 'true');
  }

  if (restoreFocus) {
    const targetCard =
      document.getElementById(`day-card-${state.selectedDay}`) || state.lastDrawerTrigger;
    targetCard?.focus?.();
  }
  state.lastDrawerTrigger = null;
}
