import { dom, state } from '../state.js';
import { escapeHtml, formatDateTime } from '../utils.js';

export function renderYoutubeHistory() {
  if (!dom.ytHistoryList) return;
  if (!state.youtubeHistory || state.youtubeHistory.length === 0) {
    dom.ytHistoryList.innerHTML =
      '<span class="md-status-chip badge">Sin búsquedas recientes registradas</span>';
    return;
  }

  dom.ytHistoryList.innerHTML = state.youtubeHistory
    .slice(0, 12)
    .map(
      (h) => `
      <button class="history-chip md-state-layer" type="button" data-history-query="${escapeHtml(h.query)}">
        <span class="material-symbols-rounded icon-sm" aria-hidden="true">history</span>
        <span>${escapeHtml(h.query)}</span>
        <span class="md-status-chip badge tabular-nums">${Number(h.results_count) || 0}</span>
      </button>
    `
    )
    .join('');
}

export function renderVideoCards(container, videos) {
  if (!container) return;
  if (!videos || videos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-rounded icon-xl" aria-hidden="true">video_library</span>
        <h3>Sin videos disponibles</h3>
        <p>Ejecuta una búsqueda arriba para consultar YouTube Data API v3.</p>
      </div>
    `;
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
        ? `<a class="md-btn md-btn--outlined md-btn--sm" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">Abrir video</a>`
        : '<span class="md-status-chip md-status-chip--simulated badge badge--simulated">Demo local</span>';

      return `
        <article class="video-card">
          ${thumbHtml}
          <div class="video-card-body">
            <div>
              <h3 class="video-card-title">${escapeHtml(v.title)}</h3>
              <div class="video-card-meta">${escapeHtml(v.channelTitle)} · ${escapeHtml(formatDateTime(v.publishedAt))}</div>
            </div>
            <div class="video-card-actions">
              ${watchLinkHtml}
              <button class="md-btn md-btn--filled md-btn--sm" type="button" data-use-topic="${escapeHtml(v.title)}">
                <span class="material-symbols-rounded icon-sm" aria-hidden="true">auto_awesome</span>
                <span>Usar tema en Roadmap</span>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

export function renderYoutubeCatalog() {
  renderVideoCards(dom.ytVideosGrid, state.youtubeStoredVideos);
}
