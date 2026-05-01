import { connectBLE, disconnectBLE } from './ble-manager.js';
import { isSessionRunning, startSession, stopSession, resetSession, addStrike, getSessionStats, saveSessionToStorage, loadSessionFromStorage, getAllSavedSessions } from './session-manager.js';
import { initChart, updateChart, resetChart, renderHistoricalData } from './chart-manager.js';
import { initTabs, updateConnectionStatus, updateSessionStatus, appendLogEntry, updateStats, clearLogs, openModal, closeModal, renderSavedSessionsList, populateHistoricalLogs, setDisconnectedState, showToast } from './ui-manager.js';

document.addEventListener('DOMContentLoaded', () => {
  initTabs();

  setTimeout(() => initChart(), 100);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.error('Service Worker Registration Failed!', err));
  }

  // Device Controls
  document.getElementById('btn-connect').addEventListener('click', handleConnect);
  document.getElementById('btn-disconnect').addEventListener('click', handleDisconnect);

  // Session Controls
  document.getElementById('btn-start-session').addEventListener('click', handleStartBtnClick);
  document.getElementById('btn-stop-session').addEventListener('click', handleStopSession);

  const btnSave = document.getElementById('btn-save-session');
  if (btnSave) btnSave.addEventListener('click', handleSaveSession);

  // Modal Controls
  document.getElementById('btn-modal-cancel').addEventListener('click', () => closeModal('session-options-modal'));
  document.getElementById('btn-load-cancel').addEventListener('click', () => closeModal('load-sessions-modal'));

  document.getElementById('btn-modal-new-session').addEventListener('click', () => {
    closeModal('session-options-modal');
    startNewSession();
  });

  document.getElementById('btn-modal-load-session').addEventListener('click', () => {
    closeModal('session-options-modal');
    openLoadSessionsModal();
  });
});

async function handleConnect() {
  showToast('Scanning for device…', 'info');
  const success = await connectBLE(onBleData, onBleDisconnect);
  if (success) {
    updateConnectionStatus(true);
    showToast('Sock Connected!', 'success');
  } else {
    showToast('Connection failed.', 'error');
  }
}

function handleDisconnect() {
  disconnectBLE();
  // gattserverdisconnected event → onBleDisconnect
}

function onBleDisconnect() {
  // 1. Force UI to OFFLINE state
  setDisconnectedState();

  // 2. Show toast
  showToast('🧦 Sock Disconnected!', 'error');

  // 3. Auto-save + stop + reset if session was running
  if (isSessionRunning()) {
    console.log("Disconnect detected. Auto-saving session...");
    const saved = saveSessionToStorage();
    stopSession();
    resetSession(); // Clear state so next Start is fresh
    updateSessionStatus(false);
    if (saved) {
      showToast('Session auto-saved.', 'success');
    }
  }
}

function onBleData(data) {
  if (isSessionRunning()) {
    const processedData = addStrike(data);
    if (processedData) {
      updateChart(processedData);
      appendLogEntry(processedData);

      const stats = getSessionStats();
      updateStats(stats.totalStrikes, stats.maxForce);
    }
  }
}

function handleStartBtnClick() {
  openModal('session-options-modal');
}

function startNewSession() {
  startSession();
  resetChart();
  clearLogs();
  updateStats(0, 0);
  updateSessionStatus(true);
  showToast('New session started!', 'success');
}

function openLoadSessionsModal() {
  const sessions = getAllSavedSessions();
  renderSavedSessionsList(sessions, handleSessionSelected);
  openModal('load-sessions-modal');
}

function handleSessionSelected(sessionId) {
  closeModal('load-sessions-modal');
  const session = loadSessionFromStorage(sessionId);
  if (session) {
    renderHistoricalData(session.strikes);
    populateHistoricalLogs(session.strikes);

    const stats = getSessionStats();
    updateStats(stats.totalStrikes, stats.maxForce);

    updateSessionStatus(true);
    showToast('Session loaded!', 'success');
  }
}

function handleSaveSession() {
  if (isSessionRunning()) {
    const saved = saveSessionToStorage();
    if (saved) {
      showToast('💾 Session saved!', 'success');
    } else {
      showToast('Nothing to save.', 'info');
    }
  }
}

function handleStopSession() {
  // Auto-save on stop if there is data
  if (isSessionRunning()) {
    const saved = saveSessionToStorage();
    if (saved) {
      showToast('💾 Session saved!', 'success');
    }
  }
  stopSession();
  resetSession();
  updateSessionStatus(false);
  showToast('Session stopped.', 'info');
}
