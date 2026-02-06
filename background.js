'use strict';

const STORAGE_KEYS = {
  names: 'blacklistNames',
  values: 'blacklistValues',
  greyNames: 'greylistNames',
  greyValues: 'greylistValues',
};

function loadLists() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [STORAGE_KEYS.names, STORAGE_KEYS.values, STORAGE_KEYS.greyNames, STORAGE_KEYS.greyValues],
      (data) => {
        const blackNames = Array.isArray(data[STORAGE_KEYS.names]) ? data[STORAGE_KEYS.names] : [];
        const blackValues = Array.isArray(data[STORAGE_KEYS.values]) ? data[STORAGE_KEYS.values] : [];
        const greyNames = Array.isArray(data[STORAGE_KEYS.greyNames]) ? data[STORAGE_KEYS.greyNames] : [];
        const greyValues = Array.isArray(data[STORAGE_KEYS.greyValues]) ? data[STORAGE_KEYS.greyValues] : [];
        resolve({ blackNames, blackValues, greyNames, greyValues });
      }
    );
  });
}

function matchesList(cookie, nameEntries, valueEntries) {
  const name = (cookie.name || '').toLowerCase();
  const value = (cookie.value || '').toLowerCase();
  const nameMatch = nameEntries.some((entry) => name.includes(String(entry).toLowerCase().trim()));
  const valueMatch = valueEntries.some((entry) => value.includes(String(entry).toLowerCase().trim()));
  return nameMatch || valueMatch;
}

function isBlacklisted(cookie, blackNames, blackValues) {
  return matchesList(cookie, blackNames, blackValues);
}

function isGreylisted(cookie, greyNames, greyValues) {
  return matchesList(cookie, greyNames, greyValues);
}

function getCookiesForUrl(url) {
  return new Promise((resolve, reject) => {
    chrome.cookies.getAll({ url }, (cookies) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(cookies || []);
    });
  });
}

function isValidHttpUrl(tabUrl) {
  if (!tabUrl) return false;
  try {
    const url = new URL(tabUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function updateBadgeForTab(tabId) {
  if (tabId == null) return;
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  if (!tab?.url || !isValidHttpUrl(tab.url)) {
    await chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const [lists, cookies] = await Promise.all([
    loadLists(),
    getCookiesForUrl(tab.url),
  ]);
  const blackCount = cookies.filter((c) =>
    isBlacklisted(c, lists.blackNames, lists.blackValues)
  ).length;
  const greyCount = cookies.filter((c) =>
    isGreylisted(c, lists.greyNames, lists.greyValues)
  ).length;
  const matchCount = new Set(
    cookies
      .filter((c) => isBlacklisted(c, lists.blackNames, lists.blackValues) || isGreylisted(c, lists.greyNames, lists.greyValues))
      .map((c) => c.name + c.domain + c.path)
  ).size;
  if (matchCount > 0) {
    const text = matchCount > 99 ? '99+' : String(matchCount);
    await chrome.action.setBadgeText({ tabId, text });
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: blackCount > 0 ? '#c2410c' : '#6b6b6b',
    });
  } else {
    await chrome.action.setBadgeText({ tabId, text: '' });
  }
}

async function updateBadgeForActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) await updateBadgeForTab(tab.id);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url && isValidHttpUrl(tab.url)) {
    updateBadgeForTab(tabId);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  updateBadgeForTab(activeInfo.tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  updateBadgeForActiveTab();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const listKeys = [STORAGE_KEYS.names, STORAGE_KEYS.values, STORAGE_KEYS.greyNames, STORAGE_KEYS.greyValues];
  if (listKeys.some((k) => k in changes)) updateBadgeForActiveTab();
});
