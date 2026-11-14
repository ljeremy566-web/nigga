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
      return;
    }

    if (exec && typeof exec === 'object') {
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
}
