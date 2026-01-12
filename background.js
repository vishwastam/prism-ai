/**
 * Prism AI - Background Service Worker
 */

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      prismStats: { critical: 0, sensitive: 0, contextual: 0 },
      installDate: Date.now()
    });
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStats') {
    chrome.storage.local.get(['prismStats'], (result) => {
      const stats = result.prismStats || { critical: 0, sensitive: 0, contextual: 0 };

      stats.critical += request.stats.critical || 0;
      stats.sensitive += request.stats.sensitive || 0;
      stats.contextual += request.stats.contextual || 0;

      chrome.storage.local.set({ prismStats: stats });
      sendResponse({ success: true });
    });
    return true;
  }
});
