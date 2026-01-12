/**
 * Prism AI - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  setupEventListeners();
  detectPlatform();
});

async function loadStats() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      loadFromStorage();
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'getStats' }, (response) => {
      if (chrome.runtime.lastError) {
        loadFromStorage();
        return;
      }

      if (response) {
        updateUI(response);
      } else {
        loadFromStorage();
      }
    });
  } catch (error) {
    loadFromStorage();
  }
}

function loadFromStorage() {
  chrome.storage.local.get(['prismStats'], (result) => {
    const stats = result.prismStats || { critical: 0, sensitive: 0, contextual: 0 };
    updateUI({ ...stats, score: calculateScore(stats) });
  });
}

function calculateScore(stats) {
  const penalty = (stats.critical || 0) * 15 + (stats.sensitive || 0) * 8 + (stats.contextual || 0) * 3;
  return Math.max(0, 100 - penalty);
}

function updateUI(data) {
  const stats = data.sessionStats || data;
  const score = data.score !== undefined ? data.score : calculateScore(stats);

  // Update stats
  document.getElementById('criticalCount').textContent = stats.critical || 0;
  document.getElementById('sensitiveCount').textContent = stats.sensitive || 0;
  document.getElementById('contextualCount').textContent = stats.contextual || 0;

  // Update score
  document.getElementById('scoreValue').textContent = score;

  // Update ring
  const ring = document.getElementById('scoreRing');
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;

  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = offset;

  // Color based on score
  let strokeColor;
  if (score >= 80) {
    strokeColor = 'var(--safe)';
  } else if (score >= 50) {
    strokeColor = 'var(--sensitive)';
  } else {
    strokeColor = 'var(--critical)';
  }
  ring.style.stroke = strokeColor;

  // Update status
  const status = document.getElementById('scoreStatus');
  status.className = 'score-status';

  if (score >= 80) {
    status.textContent = 'Protected';
    status.classList.add('safe');
  } else if (score >= 50) {
    status.textContent = 'Caution';
    status.classList.add('caution');
  } else {
    status.textContent = 'At Risk';
    status.classList.add('alert');
  }
}

function setupEventListeners() {
  document.getElementById('resetBtn').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'resetStats' }, (response) => {
          if (chrome.runtime.lastError) {
            resetStorage();
          } else {
            loadStats();
          }
        });
      } else {
        resetStorage();
      }
    } catch (error) {
      resetStorage();
    }
  });
}

function resetStorage() {
  const emptyStats = { critical: 0, sensitive: 0, contextual: 0 };
  chrome.storage.local.set({ prismStats: emptyStats }, () => {
    updateUI({ ...emptyStats, score: 100 });
  });
}

function detectPlatform() {
  // Update shortcut keys based on platform
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  document.querySelectorAll('.shortcut-keys').forEach(container => {
    const keys = container.querySelectorAll('.key');
    if (keys[0]) {
      keys[0].textContent = modKey;
    }
  });
}
