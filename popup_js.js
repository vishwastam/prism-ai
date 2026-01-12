/**
 * Prism AI - Popup Script
 */

const CHROME_STORE_URL = 'https://chrome.google.com/webstore/detail/prism-ai/YOUR_EXTENSION_ID'; // Update after publishing
const SHARE_URL = 'https://github.com/vishwastam/prism-ai';
const SHARE_TEXT = "I'm using Prism AI to protect my privacy when chatting with ChatGPT & Claude. It detects sensitive data before you accidentally share it. Check it out:";

const MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  setupEventListeners();
  detectPlatform();
  setupShareButtons();
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
  chrome.storage.local.get(['prismStats', 'lastMilestone'], (result) => {
    const stats = result.prismStats || { critical: 0, sensitive: 0, contextual: 0 };
    updateUI({ ...stats, score: calculateScore(stats) });
    checkMilestone(stats, result.lastMilestone || 0);
  });
}

function calculateScore(stats) {
  const penalty = (stats.critical || 0) * 15 + (stats.sensitive || 0) * 8 + (stats.contextual || 0) * 3;
  return Math.max(0, 100 - penalty);
}

function getTotalProtected(stats) {
  return (stats.critical || 0) + (stats.sensitive || 0) + (stats.contextual || 0);
}

function updateUI(data) {
  const stats = data.sessionStats || data;
  const score = data.score !== undefined ? data.score : calculateScore(stats);
  const totalProtected = getTotalProtected(data);

  // Update total protected count
  document.getElementById('totalCount').textContent = totalProtected.toLocaleString();

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

  // Check for milestones
  chrome.storage.local.get(['lastMilestone'], (result) => {
    checkMilestone(data, result.lastMilestone || 0);
  });
}

function checkMilestone(stats, lastMilestone) {
  const total = getTotalProtected(stats);

  // Find the highest milestone reached
  let currentMilestone = 0;
  for (const milestone of MILESTONES) {
    if (total >= milestone) {
      currentMilestone = milestone;
    }
  }

  // Show banner if new milestone reached
  if (currentMilestone > lastMilestone && currentMilestone > 0) {
    showMilestoneBanner(currentMilestone);
    chrome.storage.local.set({ lastMilestone: currentMilestone });
  }
}

function showMilestoneBanner(milestone) {
  const banner = document.getElementById('milestoneBanner');
  const text = document.getElementById('milestoneText');

  const messages = {
    10: "You've protected 10 items! 🌟",
    25: "25 items protected! You're on a roll! 🔥",
    50: "50 items! You're a privacy pro! 🛡️",
    100: "100 items protected! Amazing! 🎯",
    250: "250 items! Privacy champion! 🏆",
    500: "500 items! You're legendary! 👑",
    1000: "1000 items! Privacy master! 🌟"
  };

  text.textContent = messages[milestone] || `You've protected ${milestone} items!`;
  banner.classList.add('show');
}

function setupEventListeners() {
  document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm('Reset all stats? This cannot be undone.')) return;

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
  chrome.storage.local.set({ prismStats: emptyStats, lastMilestone: 0 }, () => {
    updateUI({ ...emptyStats, score: 100 });
    document.getElementById('milestoneBanner').classList.remove('show');
  });
}

function detectPlatform() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  document.querySelectorAll('.shortcut-keys').forEach(container => {
    const keys = container.querySelectorAll('.key');
    if (keys[0]) {
      keys[0].textContent = modKey;
    }
  });
}

function setupShareButtons() {
  // Twitter/X share button
  const twitterBtn = document.getElementById('shareTwitter');
  const tweetText = encodeURIComponent(SHARE_TEXT);
  const tweetUrl = encodeURIComponent(SHARE_URL);
  twitterBtn.href = `https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`;

  // Copy link button
  const copyBtn = document.getElementById('copyLink');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '✅ Copied!';
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
      }, 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = SHARE_URL;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);

      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '✅ Copied!';
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
      }, 2000);
    }
  });
}
