import {
  WEEK_LABELS,
  escapeHtml,
  formatStatusLabel,
  padDay,
} from '../utils.js';

export const WEEK_SHORT_META = {
  1: { kicker: 'SEMANA 1', title: 'Atracción y disrupción', short: 'Semana 1 · Atracción', range: 'Días 01–07' },
  2: { kicker: 'SEMANA 02', title: 'Confianza y conexión', short: 'Semana 2 · Confianza', range: 'Días 08–14' },
  3: { kicker: 'SEMANA 03', title: 'Autoridad y valor', short: 'Semana 3 · Autoridad', range: 'Días 15–21' },
  4: { kicker: 'SEMANA 04', title: 'Conversión y comunidad', short: 'Semana 4 · Conversión', range: 'Días 22–30' },
};

export function parseScriptSegments(rawScript, title) {
  const script = String(rawScript || '').trim();
  if (!script) {
    return {
      screenCue: title ? `Texto en pantalla: "${title}"` : '',
      development: '—',
      closing: '—',
    };
  }

  const lines = script.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const devLines = [];
  const closeLines = [];
  let bucket = 'dev';

  lines.forEach((line, idx) => {
    const cleanLine = line.replace(/^\[[^\]]+\]\s*/i, '').trim();
    const isHookTimestamp = /^\[?0:00/i.test(line) || /\bgancho\b/i.test(line);
    const isClosingMarker =
      /^\[?(0:2[5-9]|0:3\d|cierre|cta)\b/i.test(line) ||
      /\b(comenta|guarda|sígueme|escribe|dm)\b/i.test(line);
    const isDevMarker =
      /^\[?0:0[3-9]|^\[?0:1\d|^\[?0:2[0-4]|\b(desarrollo|cuerpo|valor)\b/i.test(line);

    if (idx === 0 && isHookTimestamp && lines.length > 1) {
      bucket = 'hook';
      return;
    }
    if (isClosingMarker) {
      bucket = 'close';
      const stripped = cleanLine.replace(/^(cierre|cta)\s*:\s*/i, '').trim();
      if (stripped) closeLines.push(stripped);
      return;
    }
    if (isDevMarker || bucket === 'hook') {
      bucket = 'dev';
      const stripped = cleanLine.replace(/^(desarrollo|cuerpo)\s*:\s*/i, '').trim();
      if (stripped) devLines.push(stripped);
      return;
    }
    if (cleanLine) {
      if (bucket === 'close') closeLines.push(cleanLine);
      else devLines.push(cleanLine);
    }
  });

  const shortTitle = String(title || '').split(/[.,:]/)[0].trim();
  const screenCue = shortTitle ? `Texto en pantalla: "${shortTitle}"` : '';

  return {
    screenCue,
    development: devLines.length > 0 ? devLines.join('\n') : script,
    closing:
      closeLines.length > 0
        ? closeLines.join('\n')
        : 'Guarda esta pieza y cuéntame qué paso aplicarás hoy.',
  };
}

export function buildDayDotsHtml(items, selectedDay, dotAttr = 'data-dot-day') {
  if (!items || items.length === 0) return '';

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
        const isActive = d.day_number === selectedDay;
        const isPub = d.status === 'publicado';
        return `<button class="day-dot-btn ${isActive ? 'is-active' : ''} ${isPub ? 'is-published' : ''}" ${dotAttr}="${d.day_number}" type="button" title="Día ${padDay(d.day_number)} · ${escapeHtml(d.title)}" aria-label="Ir al día ${d.day_number}">${d.day_number}</button>`;
      })
      .join('');

    groupsHtml.push(`
      <div class="day-dots-group">
        <div class="day-dots-row">${dotsHtml}</div>
        <span class="day-dots-caption">${escapeHtml(meta.short)}</span>
      </div>
    `);
  });

  return groupsHtml.join('');
}

export function buildRoadmapGroupsHtml(filteredItems, options) {
  const {
    selectedDay,
    expandedWeeks,
    hasActiveFilter,
    getEffectiveItem,
    cardClass = 'day-card',
    cardIdPrefix = 'day-card',
    dayAttr = 'data-day',
    statusAttr = 'data-card-status',
    expandAttr = 'data-expand-day',
    toggleWeekAttr = 'data-toggle-week',
  } = options;

  const grouped = new Map();
  filteredItems.forEach((raw) => {
    const week = raw.week_number || 1;
    if (!grouped.has(week)) grouped.set(week, []);
    grouped.get(week).push(getEffectiveItem(raw));
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
      const isExpanded = hasActiveFilter || expandedWeeks.has(week);
      const subtitleText = isExpanded
        ? `${days.length} ${days.length === 1 ? 'día' : 'días'}`
        : `${meta.range ? meta.range + ' · ' : ''}${days.length} ideas`;

      htmlParts.push(`<section class="week-group ${isExpanded ? '' : 'is-collapsed'}" data-week-group="${week}" aria-label="${escapeHtml(WEEK_LABELS[week] || meta.title)}">`);
      htmlParts.push(`
        <button class="week-header" ${toggleWeekAttr}="${week}" type="button" aria-expanded="${isExpanded ? 'true' : 'false'}">
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
        const isSelected = item.day_number === selectedDay;
        const statusLabel = formatStatusLabel(item.status);
        const draftTag = item.isEditedLocally
          ? '<span class="day-card-draft-dot">· Editado</span>'
          : '';
        htmlParts.push(`
          <div
            id="${cardIdPrefix}-${item.day_number}"
            class="${cardClass} ${isSelected ? `${cardClass}--selected` : ''}"
            ${dayAttr}="${item.day_number}"
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
              <span class="day-card-status-text md-status-chip--${escapeHtml(item.status)}" ${statusAttr}="${item.day_number}">${escapeHtml(statusLabel)}</span>
            </div>
            <div class="day-card-main">
              <h3 class="day-card-title">${escapeHtml(item.title)}</h3>
              <button class="day-card-cta" ${expandAttr}="${item.day_number}" type="button" title="Abrir y expandir guion completo">
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

  return htmlParts.join('');
}
