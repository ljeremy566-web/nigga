import {
  dom,
  state,
  getEffectiveDayItem,
   getFilteredRoadmap,
} from '../state.js';
import {
  WEEK_LABELS,
  escapeHtml,
  formatStatusLabel,
  padDay,
} from '../utils.js';

export function setRoadmapLinearProgress(visible) {
  if (!dom.roadmapLinearProgress) return;
  dom.roadmapLinearProgress.classList.toggle('hidden', !visible);
}

export function renderRoadmapSkeletons() {
  if (!dom.roadmapList) return;
  dom.roadmapEmptyState?.classList.add('hidden');
  dom.roadmapList.innerHTML = `
    <div class="skeleton-grid" aria-busy="true" aria-label="Cargando tarjetas del roadmap">
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div><div class="md-skeleton md-skeleton--text"></div></div>
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div><div class="md-skeleton md-skeleton--text"></div></div>
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div><div class="md-skeleton md-skeleton--text"></div></div>
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div><div class="md-skeleton md-skeleton--text"></div></div>
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div><div class="md-skeleton md-skeleton--text"></div></div>
      <div class="skeleton-card"><div class="md-skeleton md-skeleton--chip"></div><div class="md-skeleton md-skeleton--title"></div><div class="md-skeleton md-skeleton--text"></div></div>
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
        const statusLabel = formatStatusLabel(item.status);
        const draftTag = item.isEditedLocally
          ? '<span class="md-status-chip md-status-chip--editado badge badge--editado">Borrador</span>'
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
              <span class="md-status-chip md-status-chip--dark badge badge--obsidian tabular-nums">Día ${padDay(item.day_number)}</span>
              <div class="day-card-badges">
                ${draftTag}
                <span class="md-status-chip md-status-chip--${escapeHtml(item.status)} badge badge--${escapeHtml(item.status)}" data-card-status="${item.day_number}">${escapeHtml(statusLabel)}</span>
                <span class="md-status-chip badge">${escapeHtml(item.format)}</span>
              </div>
            </div>
            <div class="day-card-main">
              <div class="day-card-pillar">${escapeHtml(item.content_pillar)}</div>
              <h3 class="day-card-title">${escapeHtml(item.title)}</h3>
              <p class="day-card-hook">${escapeHtml(item.hook)}</p>
            </div>
            <div class="day-card-foot">
              <span>Semana ${item.week_number}</span>
              <span class="day-card-cta">Ver guion e imagen →</span>
            </div>
          </button>
        `);
      });

      htmlParts.push('</div></section>');
    });

  dom.roadmapList.innerHTML = htmlParts.join('');
}

export function updateCardStatusBadge(dayNumber, status) {
  const badge = document.querySelector(`[data-card-status="${dayNumber}"]`);
  if (!badge) return;
  badge.className = `md-status-chip md-status-chip--${status} badge badge--${status}`;
  badge.textContent = formatStatusLabel(status);
}
