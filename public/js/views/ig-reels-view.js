import { dom, state } from '../state.js';
import { escapeHtml, formatDateTime } from '../utils.js';

function formatCompactNum(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

export function renderIgReelsFilters() {
  if (dom.igReelsAuthorFilter) {
    const current = state.igReelsFilters.author || 'all';
    const authors = Array.from(
      new Set(state.igReels.map((r) => r.authorHandle).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    dom.igReelsAuthorFilter.innerHTML = [
      '<option value="all">Todas las cuentas</option>',
      ...authors.map(
        (a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`
      ),
    ].join('');
    dom.igReelsAuthorFilter.value = authors.includes(current) ? current : 'all';
  }

  if (dom.igRoadmapSourceSelect) {
    const current = state.igSourceQueryFilter || 'all';
    const queries = Array.from(
      new Set(state.igReels.map((r) => r.sourceQuery).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    dom.igRoadmapSourceSelect.innerHTML = [
      `<option value="all">Todos los Reels (${state.igReels.length})</option>`,
      ...queries.map(
        (q) => `<option value="${escapeHtml(q)}">Captura: ${escapeHtml(q)}</option>`
      ),
    ].join('');
    dom.igRoadmapSourceSelect.value = queries.includes(current) ? current : 'all';
  }
}

export function renderIgReelsGrid() {
  renderIgReelsFilters();

  if (dom.igReelsCountBadge) {
    const count = state.igReels.length;
    dom.igReelsCountBadge.textContent =
      count === 1 ? '1 Reel capturado' : `${count} Reels capturados`;
  }

  if (!dom.igReelsGrid) return;

  const q = (state.igReelsFilters.query || '').trim().toLowerCase();
  const author = state.igReelsFilters.author || 'all';

  const filtered = state.igReels.filter((r) => {
    if (author !== 'all' && r.authorHandle !== author) return false;
    if (q) {
      const hay = [
        r.authorHandle,
        r.sourceQuery,
        r.caption,
        r.visualHookText,
        r.visualStyle,
        r.audioName,
        r.shortcode,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    dom.igReelsGrid.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-rounded icon-xl" aria-hidden="true">movie_filter</span>
        <h3>${state.igReels.length === 0 ? 'Sin Reels capturados todavía' : 'Sin coincidencias para este filtro'}</h3>
        <p>${
          state.igReels.length === 0
            ? 'Usa Antigravity Browser (con el skill ig-reels-browser-capture) o importa un lote JSON arriba para analizar Reels reales con Gemini Vision.'
            : 'Ajusta el texto de búsqueda o la cuenta seleccionada.'
        }</p>
      </div>
    `;
    return;
  }

  dom.igReelsGrid.innerHTML = filtered
    .map((r) => {
      const mediaHtml = r.thumbnailDataUrl
        ? `<img class="ig-reel-card__thumb" src="${escapeHtml(r.thumbnailDataUrl)}" alt="Primer frame del Reel ${escapeHtml(r.shortcode)}" loading="lazy">`
        : `<div class="ig-reel-card__placeholder"><span class="material-symbols-rounded icon-sm" aria-hidden="true">photo_camera</span><span>Reel ${escapeHtml(r.shortcode)}</span></div>`;

      const angleHtml = r.detectedAngle
        ? `<span class="ig-reel-card__angle-pill">${escapeHtml(r.detectedAngle)}</span>`
        : '';

      return `
        <article class="ig-reel-card" data-ig-shortcode="${escapeHtml(r.shortcode)}">
          <div class="ig-reel-card__media">
            ${mediaHtml}
            ${angleHtml}
          </div>
          <div class="ig-reel-card__body">
            <div>
              <div class="ig-reel-card__head">
                <span class="ig-reel-card__author">${escapeHtml(r.authorHandle)}</span>
                <span class="md-status-chip md-status-chip--plain badge">${escapeHtml(r.sourceQuery)}</span>
              </div>
              <div class="ig-reel-card__metrics" style="margin-top:6px;">
                <span>${formatCompactNum(r.viewCount)} vistas</span>
                <span>·</span>
                <span>${formatCompactNum(r.likeCount)} likes</span>
                <span>·</span>
                <span>${formatCompactNum(r.commentCount)} com.</span>
              </div>
            </div>

            <div class="ig-reel-card__hook">
              <strong>Gancho visual (0–3s)</strong>
              <span>${escapeHtml(r.visualHookText || 'Sin texto detectado')}</span>
            </div>

            <p class="ig-reel-card__caption">${escapeHtml(r.caption || 'Sin caption registrado.')}</p>
            <p class="ig-reel-card__style">${escapeHtml(r.visualStyle || '')}${r.createdAt ? ` · ${escapeHtml(formatDateTime(r.createdAt))}` : ''}</p>

            <div class="ig-reel-card__actions">
              <div style="display:flex;align-items:center;gap:6px;">
                ${
                  r.reelUrl
                    ? `<a class="md-btn md-btn--outlined md-btn--sm" href="${escapeHtml(r.reelUrl)}" target="_blank" rel="noopener noreferrer">Ver Reel</a>`
                    : ''
                }
                <button class="md-icon-btn md-icon-btn--sm" type="button" data-delete-ig-reel="${escapeHtml(r.shortcode)}" title="Eliminar Reel del catálogo" aria-label="Eliminar Reel ${escapeHtml(r.shortcode)}">
                  <span class="material-symbols-rounded icon-sm" aria-hidden="true">delete</span>
                </button>
              </div>
              <button class="md-btn md-btn--filled md-btn--sm" type="button" data-use-ig-reel-query="${escapeHtml(r.sourceQuery)}" data-use-ig-reel-code="${escapeHtml(r.shortcode)}">
                <span class="material-symbols-rounded icon-sm" aria-hidden="true">auto_awesome</span>
                <span>Usar en Roadmap IG</span>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

export function buildAntigravityBrowserPrompt(baseUrl, nicheHint, mainAccount = '@ssabeaute') {
  const targetUrl = `${baseUrl || window.location.origin}/api/instagram/reels/capture`;
  const topic = (nicheHint || '').trim() || 'Cosmetología y Estética Facial';
  const account = (mainAccount || '').trim() || '@ssabeaute';
  return `Usa el skill ig-reels-browser-capture en Antigravity Browser:
1. Abre https://www.instagram.com/ y confirma sesión activa (si pide login o verificación, detente y avísame).
2. Revisa primero la cuenta principal de cosmetología ${account} (/${account.replace(/^@/, '')}/) para entender su estilo, servicios y tono actual.
3. Busca otros IGs referentes y tendencias de "${topic}" (cuentas de cosmetólogas, estética facial, skincare, limpiezas faciales, #cosmetologia, #cuidadodelapiel) y abre entre 8 y 12 publicaciones destacadas (Reels, imágenes/carruseles y consejos prácticos) que sirvan de inspiración para que ${account} genere 1 mes (30 días) de contenido.
4. Para cada pieza extrae: shortcode, reelUrl, authorHandle, caption, audioName, viewCount, likeCount, commentCount y captura el primer frame o portada JPEG en frameImageBase64.
5. Envía el JSON por POST a ${targetUrl} con { "sourceQuery": "${topic}", "capturedVia": "antigravity_browser", "reels": [...] } (o devuélveme el JSON para importarlo en IG Reels).`;
}
