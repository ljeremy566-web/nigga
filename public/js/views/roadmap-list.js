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

const WEEK_SHORT_META = {
  1: { kicker: 'SEMANA 1', title: 'Atracción y disrupción', short: 'Semana 1 · Atracción', range: 'Días 01–07' },
  2: { kicker: 'SEMANA 02', title: 'Confianza y conexión', short: 'Semana 2 · Confianza', range: 'Días 08–14' },
  3: { kicker: 'SEMANA 03', title: 'Autoridad y valor', short: 'Semana 3 · Autoridad', range: 'Días 15–21' },
  4: { kicker: 'SEMANA 04', title: 'Conversión y comunidad', short: 'Semana 4 · Conversión', range: 'Días 22–30' },
};

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
  const items = state.roadmap;
  if (!items || items.length === 0) {
    dom.dayDotsStrip.innerHTML = '';
    return;
  }

  const weeks = new Map([[1, []], [2, []], [3, []], [4, []]]);
  items.forEach((item) => {
    const w = Math.min(4, Math.max(1, Number(item.week_number) || Math.min(Math.ceil(item.day_number / 7), 4)));
    weeks.get(w).push(item);
  });

  const groupsHtml = [];
  weeks.forEach((days, weekNum) => {
    if (days.length === 0) return;
    const meta = WEEK_SHORT_META[weekNum] || { short: `Semana ${weekNum}` };
    const dotsHtml = days
      .map((d) => {
        const isActive = d.day_number === state.selectedDay;
        const isPub = d.status === 'publicado';
        return `<button class="day-dot-btn ${isActive ? 'is-active' : ''} ${isPub ? 'is-published' : ''}" data-dot-day="${d.day_number}" type="button" title="Día ${padDay(d.day_number)} · ${escapeHtml(d.title)}" aria-label="Ir al día ${d.day_number}">${d.day_number}</button>`;
      })
      .join('');

    groupsHtml.push(`
      <div class="day-dots-group">
        <div class="day-dots-row">${dotsHtml}</div>
        <span class="day-dots-caption">${escapeHtml(meta.short)}</span>
      </div>
    `);
  });

  dom.dayDotsStrip.innerHTML = groupsHtml.join('');
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
      const meta = WEEK_SHORT_META[week] || {
        kicker: `SEMANA ${padDay(week)}`,
        title: WEEK_LABELS[week] || `Semana ${week}`,
        range: '',
      };
      const isExpanded = hasActiveFilter || state.expandedWeeks.has(week);
      const subtitleText = isExpanded
        ? `${days.length} ${days.length === 1 ? 'día' : 'días'}`
        : `${meta.range ? meta.range + ' · ' : ''}${days.length} ideas`;

      htmlParts.push(`<section class="week-group ${isExpanded ? '' : 'is-collapsed'}" data-week-group="${week}" aria-label="${escapeHtml(WEEK_LABELS[week] || meta.title)}">`);
      htmlParts.push(`
        <button class="week-header" data-toggle-week="${week}" type="button" aria-expanded="${isExpanded ? 'true' : 'false'}">
          <span class="week-header-left">
            <span class="week-kicker">${escapeHtml(meta.kicker)}</span>
            <h2 class="week-title">${escapeHtml(meta.title)}</h2>
          </span>
          <span class="week-header-right">
            <span class="week-subtitle tabular-nums">${escapeHtml(subtitleText)}</span>
            <span class="material-symbols-rounded icon-sm week-chevron" aria-hidden="true">expand_more</span>
          </span>
        </button>
        <div class="week-days">
      `);

      days.forEach((item) => {
        const isSelected = item.day_number === state.selectedDay;
        const statusLabel = formatStatusLabel(item.status);
        const draftTag = item.isEditedLocally
          ? '<span class="day-card-draft-dot">· Editado</span>'
          : '';
        htmlParts.push(`
          <div
            id="day-card-${item.day_number}"
            class="day-card ${isSelected ? 'day-card--selected' : ''}"
            data-day="${item.day_number}"
            aria-current="${isSelected ? 'true' : 'false'}"
            role="button"
            tabindex="0"
          >
            <span class="day-card-node tabular-nums" aria-hidden="true">${padDay(item.day_number)}</span>
            <div class="day-card-top">
              <div class="day-card-index-group">
                <span class="day-card-num tabular-nums">DÍA ${padDay(item.day_number)}</span>
                <span>·</span>
                <span class="day-card-format">${escapeHtml(item.format)}</span>
                ${draftTag}
              </div>
              <span class="day-card-status-text md-status-chip--${escapeHtml(item.status)}" data-card-status="${item.day_number}">${escapeHtml(statusLabel)}</span>
            </div>
            <div class="day-card-main">
              <h3 class="day-card-title">${escapeHtml(item.title)}</h3>
              <button class="day-card-cta" data-expand-day="${item.day_number}" type="button" title="Abrir y expandir guion completo">
                <span class="day-card-cta-label">Ver guion</span>
                <span aria-hidden="true">›</span>
              </button>
            </div>
            <p class="day-card-hook">${escapeHtml(item.hook)}</p>
          </div>
        `);
      });

      htmlParts.push('</div></section>');
    });

  dom.roadmapList.innerHTML = htmlParts.join('');
}

export function updateCardStatusBadge(dayNumber, status) {
  const badge = document.querySelector(`[data-card-status="${dayNumber}"]`);
  if (badge) {
    badge.className = `day-card-status-text md-status-chip--${status}`;
    badge.textContent = formatStatusLabel(status);
  }
  const dot = document.querySelector(`[data-dot-day="${dayNumber}"]`);
  if (dot) {
    dot.classList.toggle('is-published', status === 'publicado');
  }
}
