export function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const pill = document.getElementById('nav-pill');

  tabBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');

      // Slide the pill indicator with bouncy easing
      if (pill) {
        const nav = btn.closest('.bottom-nav');
        const btnWidth = nav.offsetWidth / tabBtns.length;
        // Center the pill within each slot (pill is slightly narrower)
        const pillPadding = 8;
        pill.style.width = (btnWidth - pillPadding * 2) + 'px';
        pill.style.transform = `translateX(${index * btnWidth + pillPadding}px)`;
      }
    });
  });

  // Set initial pill position on load
  if (pill) {
    requestAnimationFrame(() => {
      const nav = document.querySelector('.bottom-nav');
      if (nav) {
        const btnWidth = nav.offsetWidth / tabBtns.length;
        pill.style.width = (btnWidth - 16) + 'px';
        pill.style.transform = `translateX(8px)`;
      }
    });
  }
}

export function updateConnectionStatus(isConnected) {
  if (isConnected) {
    const statusEl = document.getElementById('ble-status');
    const btnConnect = document.getElementById('btn-connect');
    const btnDisconnect = document.getElementById('btn-disconnect');
    statusEl.textContent = "Online";
    statusEl.className = "status connected";
    btnConnect.classList.add('hidden');
    btnDisconnect.classList.remove('hidden');
  } else {
    setDisconnectedState();
  }
}

export function setDisconnectedState() {
  const statusEl = document.getElementById('ble-status');
  const btnConnect = document.getElementById('btn-connect');
  const btnDisconnect = document.getElementById('btn-disconnect');

  statusEl.textContent = "Offline";
  statusEl.className = "status disconnected";
  btnConnect.classList.remove('hidden');
  btnDisconnect.classList.add('hidden');
}

export function updateSessionStatus(isActive) {
  const btnStart = document.getElementById('btn-start-session');
  const btnStop = document.getElementById('btn-stop-session');
  const btnSave = document.getElementById('btn-save-session');

  if (isActive) {
    btnStart.classList.add('hidden');
    btnStop.classList.remove('hidden');
    if (btnSave) btnSave.classList.remove('hidden');
  } else {
    btnStart.classList.remove('hidden');
    btnStop.classList.add('hidden');
    if (btnSave) btnSave.classList.add('hidden');
  }
}

export function appendLogEntry(strikeData) {
  const logContainer = document.getElementById('strike-log');
  const li = document.createElement('li');
  li.className = 'log-item';

  const timeStr = new Date(strikeData.timestamp_ms || Date.now())
    .toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit', fractionalSecondDigits: 2 });

  li.innerHTML = `
    <span class="time">${timeStr}</span>
    <span class="event">${strikeData.event}</span>
    <span class="force">${strikeData.force} N</span>
  `;

  logContainer.prepend(li);

  if (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

export function populateHistoricalLogs(strikeArray) {
  clearLogs();
  strikeArray.forEach(strike => {
    appendLogEntry(strike);
  });
}

export function clearLogs() {
  document.getElementById('strike-log').innerHTML = '';
}

export function updateStats(total, max) {
  document.getElementById('total-strikes').textContent = total;
  document.getElementById('max-force').textContent = max;
}

// Modal Functions
export function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

export function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

export function renderSavedSessionsList(sessions, onSessionSelected) {
  const container = document.getElementById('saved-sessions-list');
  container.innerHTML = '';

  if (sessions.length === 0) {
    container.innerHTML = '<p style="color: var(--text-light);">No saved sessions found.</p>';
    return;
  }

  [...sessions].reverse().forEach(session => {
    const div = document.createElement('div');
    div.className = 'session-item';
    div.innerHTML = `
      <h4>${session.date}</h4>
      <p>⚡ ${session.strikes.length} strikes</p>
    `;
    div.addEventListener('click', () => {
      onSessionSelected(session.id);
    });
    container.appendChild(div);
  });
}

// Toast notification system
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3200);
}
