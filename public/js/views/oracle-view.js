import { dom, state } from '../state.js';
import { formatDateTime, formatUptime } from '../utils.js';

export function renderHealthAndOracleBadges() {
  if (dom.statusHealthBadge) {
    if (state.health && state.health.status === 'ok') {
      dom.statusHealthBadge.className = 'md-status-chip md-status-chip--live badge badge--live';
      dom.statusHealthBadge.textContent = 'Servidor OK';
    } else {
      dom.statusHealthBadge.className = 'md-status-chip md-status-chip--error badge badge--error';
      dom.statusHealthBadge.textContent = 'Sin conexión';
    }
  }

  if (dom.statusOracleBadge) {
    if (state.oracleError) {
      dom.statusOracleBadge.className = 'md-status-chip md-status-chip--error badge badge--error';
      dom.statusOracleBadge.textContent = 'Oráculo con error';
    } else if (state.oracleStatus && typeof state.oracleStatus === 'object') {
      if (state.oracleStatus.status === 'error') {
        dom.statusOracleBadge.className = 'md-status-chip md-status-chip--error badge badge--error';
        dom.statusOracleBadge.textContent = 'Oráculo con error';
      } else {
        dom.statusOracleBadge.className = 'md-status-chip md-status-chip--live badge badge--live';
        dom.statusOracleBadge.textContent = 'Oráculo sincronizado';
      }
    } else {
      dom.statusOracleBadge.className = 'md-status-chip badge';
      dom.statusOracleBadge.textContent = 'Oráculo listo';
    }
  }
  if (dom.statusSourceBadge) {
    const igCount = state.igReelsStats?.count || state.igReels?.length || 0;
    if (igCount > 0) {
      dom.statusSourceBadge.className = 'md-status-chip md-status-chip--live badge badge--live';
      dom.statusSourceBadge.textContent = `YT Real · IG ${igCount} Reels`;
      dom.statusSourceBadge.title = `YouTube Data API v3, Gemini AI, Supabase e Instagram Browser Capture (${igCount} Reels reales)`;
    } else {
      dom.statusSourceBadge.className = 'md-status-chip md-status-chip--simulated badge badge--simulated';
      dom.statusSourceBadge.textContent = 'YT Real · IG Sim';
      dom.statusSourceBadge.title = 'YouTube Data API v3, Gemini AI y Supabase son reales; Instagram usa plantilla hasta capturar Reels';
    }
  }
}

export function renderOracleView() {
  if (dom.healthStatusText) {
    if (state.health && state.health.status === 'ok') {
      dom.healthStatusText.className = 'md-status-chip md-status-chip--live badge badge--live';
      dom.healthStatusText.textContent = 'Operativo (ok)';
      dom.healthUptimeText.textContent = formatUptime(state.health.uptime);
    } else {
      dom.healthStatusText.className = 'md-status-chip md-status-chip--error badge badge--error';
      dom.healthStatusText.textContent = 'Sin respuesta';
      dom.healthUptimeText.textContent = '—';
    }
  }

  if (dom.oracleLastStatus) {
    const exec = state.oracleStatus;
    if (state.oracleError && (!exec || typeof exec !== 'object')) {
      dom.oracleLastStatus.className = 'md-status-chip md-status-chip--error badge badge--error';
      dom.oracleLastStatus.textContent = 'Error de estado';
      dom.oracleLastTimestamp.textContent = '—';
      dom.oracleLastDetails.textContent = 'No se pudo consultar el estado del Oráculo.';
    } else if (exec && typeof exec === 'object') {
      const isErr = exec.status === 'error';
      dom.oracleLastStatus.className = `md-status-chip ${
        isErr ? 'md-status-chip--error badge badge--error' : 'md-status-chip--live badge badge--live'
      }`;
      dom.oracleLastStatus.textContent = exec.status || 'completado';
      dom.oracleLastTimestamp.textContent = formatDateTime(exec.triggeredAt || exec.timestamp);
      dom.oracleLastDetails.textContent =
        exec.details || `Nicho: ${exec.niche || '—'} · Videos: ${exec.youtubeVideosFound || 0}`;
    } else {
      dom.oracleLastStatus.className = 'md-status-chip badge';
      dom.oracleLastStatus.textContent = 'Sin ejecución previa';
      dom.oracleLastTimestamp.textContent = '—';
      dom.oracleLastDetails.textContent =
        typeof exec === 'string'
          ? exec
          : 'Aún no se ha ejecutado ningún ciclo. Puedes dispararlo con POST /api/oracle/run-now';
    }
  }

  const igCard = dom['truthCard-instagram'] || document.getElementById('truthCard-instagram');
  if (igCard) {
    const badge = igCard.querySelector('.badge');
    const desc = igCard.querySelector('p');
    const igCount = state.igReelsStats?.count || state.igReels?.length || 0;
    if (igCount > 0) {
      if (badge) {
        badge.className = 'md-status-chip md-status-chip--live badge badge--live';
        badge.textContent = `Real · ${igCount} Reels`;
      }
      if (desc) {
        desc.innerHTML = `Capturados <strong>${igCount} Reels</strong> reales vía Antigravity Browser / CDP local y analizados con Gemini Vision para alimentar el <strong>Roadmap IG</strong> independiente.`;
      }
    } else {
      if (badge) {
        badge.className = 'md-status-chip md-status-chip--simulated badge badge--simulated';
        badge.textContent = 'Listo · Browser';
      }
    }
  }
}
