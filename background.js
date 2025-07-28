// Background script for Chrome extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open expanded view when extension is first installed
    chrome.tabs.create({
      url: chrome.runtime.getURL('expanded.html')
    });
  }
});

// Handle messages between popup and expanded views
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SYNC_STATE') {
    // Broadcast state changes to all extension pages
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors if no listeners
    });
  } else if (message.type === 'OPEN_EXPANDED') {
    // Open expanded view
    chrome.tabs.create({
      url: chrome.runtime.getURL('expanded.html')
    });
  }
  
  return true;
});

// Sync storage changes across all extension pages
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Broadcast storage changes to all extension pages
    chrome.runtime.sendMessage({
      type: 'STORAGE_CHANGED',
      changes: changes
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }
});