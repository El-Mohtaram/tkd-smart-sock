let isSessionActive = false;
let sessionData = [];
let currentSessionId = null;

export function isSessionRunning() {
  return isSessionActive;
}

export function startSession() {
  isSessionActive = true;
  sessionData = [];
  currentSessionId = Date.now().toString();
  console.log("New session started", currentSessionId);
}

export function stopSession() {
  isSessionActive = false;
  console.log("Session stopped");
  return [...sessionData];
}

export function resetSession() {
  isSessionActive = false;
  sessionData = [];
  currentSessionId = null;
  console.log("Session state fully reset");
}

export function getSessionData() {
  return [...sessionData];
}

export function addStrike(data) {
  if (!isSessionActive) return null;
  sessionData.push(data);
  return data;
}

export function getSessionStats() {
  const totalStrikes = sessionData.length;
  const maxForce = sessionData.reduce((max, s) => Math.max(max, s.force), 0);
  return { totalStrikes, maxForce };
}

// ---- Storage Functions ----
// STRICT RULE: Every save creates a NEW unique entry. Never overrides.

export function saveSessionToStorage() {
  if (sessionData.length === 0) {
    console.warn("Empty session — skipping save.");
    return false;
  }

  // Always generate a fresh unique ID for this snapshot
  const uniqueId = Date.now().toString();

  const sessionObj = {
    id: uniqueId,
    date: new Date().toLocaleString(),
    strikes: [...sessionData]
  };

  try {
    const saved = getAllSavedSessions();
    saved.push(sessionObj);

    // Attempt write; handle QuotaExceeded gracefully
    while (true) {
      try {
        localStorage.setItem('tkd_sessions', JSON.stringify(saved));
        break;
      } catch (e) {
        if (e.name === 'QuotaExceededError' && saved.length > 1) {
          console.warn("Storage full. Removing oldest session.");
          saved.shift();
        } else {
          console.error("Storage error:", e);
          return false;
        }
      }
    }

    console.log(`Session saved as NEW entry [${uniqueId}]`);
    return true;
  } catch (err) {
    console.error("Failed to save session:", err);
    return false;
  }
}

export function loadSessionFromStorage(sessionId) {
  const saved = getAllSavedSessions();
  const session = saved.find(s => s.id === sessionId);

  if (session) {
    isSessionActive = true;
    sessionData = [...session.strikes];
    currentSessionId = session.id;
    console.log(`Session ${sessionId} loaded with ${session.strikes.length} strikes.`);
    return session;
  }
  return null;
}

export function getAllSavedSessions() {
  try {
    const data = localStorage.getItem('tkd_sessions');
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Error reading localStorage:", err);
    return [];
  }
}

// Alias for clarity when used by the Rack tab
export function getHistory() {
  return getAllSavedSessions();
}
