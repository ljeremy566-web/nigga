import {
  dom,
  state,
  getEffectiveDayItem,
  getFilteredRoadmap,
} from '../state.js';
import {
  escapeHtml,
  formatStatusLabel,
} from '../utils.js';
import {
  buildDayDotsHtml,
  buildRoadmapGroupsHtml,
} from './roadmap-shared.js';

export function setRoadmapLinearProgress(visible) {
  if (!dom.roadmapLinearProgress) return;
  dom.roadmapLinearProgress.classList.toggle('hidden', !visible);
}

export function renderRoadmapSkeletons() {
  if (!dom.roadmapList) return;
  dom.roadmapEmptyState?.classList.add('hidden');
  dom.roadmapList.innerHTML = `
    <div class="skeleton-grid" aria-busy="true" aria-label="Cargando tarjetas del roadmap">
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div></div>
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div></div>
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div></div>
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div></div>
    </div>
  `;
}

export function updateSourceNotice(customWarning) {
  if (!dom.roadmapSourceNotice) return;
  if (customWarning) {
    dom.roadmapSourceNotice.className = 'source-notice md-banner md-banner--warn source-notice--warn fade-in';
    dom.roadmapSourceNotice.innerHTML = `
      <span class="material-symbols-rounded icon-sm" aria-hidden="true">cloud_off</span>
      <span>${escapeHtml(customWarning)}</span>
    `;
    return;
  }
  if (state.roadmapIsFallback) {
    dom.roadmapSourceNotice.className = 'source-notice md-banner md-banner--warn source-notice--warn fade-in';
    dom.roadmapSourceNotice.innerHTML = `
      <span class="material-symbols-rounded icon-sm" aria-hidden="true">cloud_off</span>
      <span>Mostrando vista de respaldo local temporal.</span>
    `;
    return;
  }
  dom.roadmapSourceNotice.className = 'source-notice md-banner hidden';
  dom.roadmapSourceNotice.textContent = '';
}

export function renderDayDotsStrip() {
  if (!dom.dayDotsStrip) return;
  dom.dayDotsStrip.innerHTML = buildDayDotsHtml(
    state.roadmap,
    state.selectedDay,
    'data-dot-day'
  );
}

export function renderProgressAndCounters() {
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
    dom.progressSummaryText.textContent = `${counts.publicado} de ${total} publicados`;
  }
  if (dom.progressFill) {
    dom.progressFill.style.width = `${pct}%`;
  }
  if (dom.planProgressSub) {
    const inProgress = counts.grabado + counts.editado;
    if (counts.publicado === total && total > 0) {
      dom.planProgressSub.textContent = '¡Plan de 30 días completado!';
    } else if (counts.publicado > 0 || inProgress > 0) {
      dom.planProgressSub.textContent = `${inProgress} en producción · ${counts.publicado} publicados.`;
    } else {
      dom.planProgressSub.textContent = 'Todo empieza con el día 1.';
    }
  }
  if (dom.roadmapIdeasCount) {
    dom.roadmapIdeasCount.textContent = `${total} ideas · Sugeridas por IA`;
  }
  if (dom.countTotal) dom.countTotal.textContent = String(total);
  if (dom.countPendiente) dom.countPendiente.textContent = String(counts.pendiente);
  if (dom.countGrabado) dom.countGrabado.textContent = String(counts.grabado);
  if (dom.countEditado) dom.countEditado.textContent = String(counts.editado);
  if (dom.countPublicado) dom.countPublicado.textContent = String(counts.publicado);

  renderDayDotsStrip();
}

export function renderRoadmapList() {
  if (!dom.roadmapList) return;
  dom.roadmapList.className = `roadmap-list ${
    state.viewMode === 'timeline' ? 'roadmap-list--timeline' : 'roadmap-list--grid'
  }`;

  const filtered = getFilteredRoadmap();
  if (filtered.length === 0) {
    dom.roadmapList.innerHTML = '';
    dom.roadmapEmptyState?.classList.remove('hidden');
    return;
  }

  dom.roadmapEmptyState?.classList.add('hidden');

  const hasActiveFilter =
    state.filters.week !== 'all' ||
    state.filters.format !== 'all' ||
    state.filters.status !== 'all' ||
    state.filters.query.trim() !== '';

  dom.roadmapList.innerHTML = buildRoadmapGroupsHtml(filtered, {
    selectedDay: state.selectedDay,
    expandedWeeks: state.expandedWeeks,
    hasActiveFilter,
    getEffectiveItem: getEffectiveDayItem,
    cardClass: 'day-card',
    cardIdPrefix: 'day-card',
    dayAttr: 'data-day',
    statusAttr: 'data-card-status',
    expandAttr: 'data-expand-day',
    toggleWeekAttr: 'data-toggle-week',
  });
}

export function updateCardStatusBadge(dayNumber, status) {
  const badge = dom.roadmapList?.querySelector(`[data-card-status="${dayNumber}"]`);
  if (badge) {
    badge.className = `day-card-status-text md-status-chip--${status}`;
    badge.textContent = formatStatusLabel(status);
  }
  const dot = dom.dayDotsStrip?.querySelector(`[data-dot-day="${dayNumber}"]`);
  if (dot) {
    dot.classList.toggle('is-published', status === 'publicado');
  }
}
