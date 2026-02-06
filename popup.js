(function () {
  'use strict';

  const elements = {
    siteDomain: document.getElementById('site-domain'),
    totalCount: document.getElementById('total-count'),
    firstPartyCount: document.getElementById('first-party-count'),
    thirdPartyCount: document.getElementById('third-party-count'),
    statFirst: document.getElementById('stat-first'),
    statThird: document.getElementById('stat-third'),
    cookieList: document.getElementById('cookie-list'),
    emptyState: document.getElementById('empty-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    search: document.getElementById('search'),
    refresh: document.getElementById('refresh'),
    btnSettings: document.getElementById('btn-settings'),
    stats: document.getElementById('stats'),
    headerRight: document.getElementById('header-right'),
    configToggle: document.getElementById('config-toggle'),
    configPanel: document.getElementById('config-panel'),
    configClose: document.getElementById('config-close'),
    mainToolbar: document.getElementById('main-toolbar'),
    mainContent: document.getElementById('main-content'),
    blacklistNameInput: document.getElementById('blacklist-name-input'),
    blacklistNameAdd: document.getElementById('blacklist-name-add'),
    blacklistNames: document.getElementById('blacklist-names'),
    blacklistValueInput: document.getElementById('blacklist-value-input'),
    blacklistValueAdd: document.getElementById('blacklist-value-add'),
    blacklistValues: document.getElementById('blacklist-values'),
    greylistNameInput: document.getElementById('greylist-name-input'),
    greylistNameAdd: document.getElementById('greylist-name-add'),
    greylistNames: document.getElementById('greylist-names'),
    greylistValueInput: document.getElementById('greylist-value-input'),
    greylistValueAdd: document.getElementById('greylist-value-add'),
    greylistValues: document.getElementById('greylist-values'),
  };

  const STORAGE_KEYS = {
    names: 'blacklistNames',
    values: 'blacklistValues',
    greyNames: 'greylistNames',
    greyValues: 'greylistValues',
  };

  let currentOrigin = '';
  let allCookies = [];
  let blacklistNames = [];
  let blacklistValues = [];
  let greylistNames = [];
  let greylistValues = [];
  const expandedKeys = new Set();

  function loadBlacklists() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [STORAGE_KEYS.names, STORAGE_KEYS.values, STORAGE_KEYS.greyNames, STORAGE_KEYS.greyValues],
        (data) => {
          blacklistNames = Array.isArray(data[STORAGE_KEYS.names]) ? data[STORAGE_KEYS.names] : [];
          blacklistValues = Array.isArray(data[STORAGE_KEYS.values]) ? data[STORAGE_KEYS.values] : [];
          greylistNames = Array.isArray(data[STORAGE_KEYS.greyNames]) ? data[STORAGE_KEYS.greyNames] : [];
          greylistValues = Array.isArray(data[STORAGE_KEYS.greyValues]) ? data[STORAGE_KEYS.greyValues] : [];
          resolve();
        }
      );
    });
  }

  function saveBlacklistNames() {
    chrome.storage.local.set({ [STORAGE_KEYS.names]: blacklistNames });
  }
  function saveBlacklistValues() {
    chrome.storage.local.set({ [STORAGE_KEYS.values]: blacklistValues });
  }
  function saveGreylistNames() {
    chrome.storage.local.set({ [STORAGE_KEYS.greyNames]: greylistNames });
  }
  function saveGreylistValues() {
    chrome.storage.local.set({ [STORAGE_KEYS.greyValues]: greylistValues });
  }

  function matchesList(cookie, nameEntries, valueEntries) {
    const name = (cookie.name || '').toLowerCase();
    const value = (cookie.value || '').toLowerCase();
    const nameMatch = nameEntries.some((entry) => name.includes(String(entry).toLowerCase().trim()));
    const valueMatch = valueEntries.some((entry) => value.includes(String(entry).toLowerCase().trim()));
    return nameMatch || valueMatch;
  }

  function isGreylisted(cookie) {
    return matchesList(cookie, greylistNames, greylistValues);
  }

  function isBlacklisted(cookie) {
    return matchesList(cookie, blacklistNames, blacklistValues);
  }

  function showConfig(show) {
    elements.configPanel.classList.toggle('hidden', !show);
    elements.mainToolbar.hidden = show;
    elements.mainContent.hidden = show;
    elements.headerRight.hidden = show;
  }

  function renderBlacklistTags(listEl, items, onRemove) {
    listEl.innerHTML = '';
    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'blacklist-tag';
      const text = document.createTextNode(item);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'blacklist-tag-remove';
      btn.setAttribute('aria-label', 'Remove');
      btn.textContent = '×';
      btn.addEventListener('click', () => onRemove(index));
      li.appendChild(text);
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  function refreshConfigPanelTags() {
    const removeBlackName = (index) => {
      blacklistNames.splice(index, 1);
      saveBlacklistNames();
      refreshConfigPanelTags();
    };
    const removeBlackValue = (index) => {
      blacklistValues.splice(index, 1);
      saveBlacklistValues();
      refreshConfigPanelTags();
    };
    const removeGreyName = (index) => {
      greylistNames.splice(index, 1);
      saveGreylistNames();
      refreshConfigPanelTags();
    };
    const removeGreyValue = (index) => {
      greylistValues.splice(index, 1);
      saveGreylistValues();
      refreshConfigPanelTags();
    };
    renderBlacklistTags(elements.greylistNames, greylistNames, removeGreyName);
    renderBlacklistTags(elements.greylistValues, greylistValues, removeGreyValue);
    renderBlacklistTags(elements.blacklistNames, blacklistNames, removeBlackName);
    renderBlacklistTags(elements.blacklistValues, blacklistValues, removeBlackValue);
  }

  function cookieKey(c) {
    return (c.name || '') + '\0' + (c.domain || '') + '\0' + (c.path || '');
  }

  function getCurrentTabUrl() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        const tab = tabs[0];
        if (!tab || !tab.url) {
          reject(new Error('No active tab or URL'));
          return;
        }
        try {
          const url = new URL(tab.url);
          if (!url.protocol.startsWith('http')) {
            reject(new Error('This page is not a web page (e.g. chrome://)'));
            return;
          }
          resolve({ url: tab.url, origin: url.origin, hostname: url.hostname });
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  /** Get cookies that would be sent in a request to this URL (what the site "uses"). */
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

  function isThirdParty(cookie, siteHostname) {
    const cookieDomain = (cookie.domain || '').replace(/^\./, '');
    if (!cookieDomain) return false;
    return (
      siteHostname !== cookieDomain &&
      !siteHostname.endsWith('.' + cookieDomain)
    );
  }

  function renderCookies(cookies, filter) {
    const list = elements.cookieList;
    list.innerHTML = '';

    const q = (filter || '').toLowerCase().trim();
    let filtered = q
      ? cookies.filter(
          (c) =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.value && c.value.toLowerCase().includes(q))
        )
      : cookies.slice();

    // Sort: greylisted first, then blacklisted, then rest
    filtered.sort((a, b) => {
      const aGrey = isGreylisted(a);
      const bGrey = isGreylisted(b);
      const aBlack = isBlacklisted(a);
      const bBlack = isBlacklisted(b);
      if (aGrey && !bGrey) return -1;
      if (!aGrey && bGrey) return 1;
      if (aBlack && !bBlack) return -1;
      if (!aBlack && bBlack) return 1;
      return 0;
    });

    if (filtered.length === 0) {
      elements.emptyState.hidden = false;
      elements.errorState.hidden = true;
      if (cookies.length === 0) {
        elements.emptyState.querySelector('.empty-hint').textContent =
          'Cookies appear when you visit and interact with a page.';
      } else {
        elements.emptyState.querySelector('p').textContent =
          'No cookies match your filter.';
        elements.emptyState.querySelector('.empty-hint').textContent =
          'Try a different search.';
      }
      return;
    }

    elements.emptyState.hidden = true;
    elements.errorState.hidden = true;

    const siteHostname = new URL(currentOrigin || 'https://x').hostname;
    const hasThirdParty = cookies.some((c) => isThirdParty(c, siteHostname));

    filtered.forEach((c) => {
      const key = cookieKey(c);
      const isExpanded = expandedKeys.has(key);
      const third = isThirdParty(c, siteHostname);
      const greylisted = isGreylisted(c);
      const blacklisted = isBlacklisted(c);
      const li = document.createElement('li');
      li.className = 'cookie-item' + (third ? ' third-party' : '') + (greylisted ? ' greylisted' : '') + (blacklisted ? ' blacklisted' : '') + (isExpanded ? ' is-expanded' : '');
      li.dataset.cookieKey = key;

      const expiryShort = c.expirationDate
        ? new Date(c.expirationDate * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
        : 'Session';
      const domainRaw = c.domain || '—';
      const nameDisplay = escapeHtml(c.name);
      const domainDisplay = escapeHtml(domainRaw);
      const expiryDisplay = escapeHtml(String(expiryShort));

      const secure = c.secure ? 'Secure' : '';
      const httpOnly = c.httpOnly ? 'HttpOnly' : '';
      const sameSite = c.sameSite ? `SameSite=${c.sameSite}` : '';
      const meta = [secure, httpOnly, sameSite].filter(Boolean).join(' · ') || '—';
      const expiryFull = c.expirationDate
        ? new Date(c.expirationDate * 1000).toLocaleString()
        : 'Session';

      const pathSegment = (c.path && c.path !== '/') ? ('<div class="cookie-detail"><span class="cookie-detail-label">Path</span><span class="cookie-detail-value">' + escapeHtml(c.path) + '</span></div>') : '';
      const domainSegment = hasThirdParty ? ('<div class="cookie-detail"><span class="cookie-detail-label">Domain</span><span class="cookie-detail-value">' + escapeHtml(c.domain || '—') + '</span></div>') : '';
      const detailsHtml =
        '<div class="cookie-detail cookie-detail-value-block"><span class="cookie-detail-label">Value</span><pre class="cookie-value">' + escapeHtml(c.value || '') + '</pre></div>' +
        domainSegment +
        pathSegment +
        '<div class="cookie-detail"><span class="cookie-detail-label">Expires</span><span class="cookie-detail-value">' + escapeHtml(String(expiryFull)) + '</span></div>' +
        '<div class="cookie-detail"><span class="cookie-detail-label">Flags</span><span class="cookie-detail-value">' + escapeHtml(meta) + '</span></div>';
      const rowMetaParts = [];
      if (c.path && c.path !== '/') rowMetaParts.push(escapeHtml(c.path));
      if (hasThirdParty) rowMetaParts.push(domainDisplay);
      rowMetaParts.push(expiryDisplay);
      const rowMeta = rowMetaParts.join(' · ');
      const flagBadges = [];
      if (c.httpOnly) flagBadges.push('<span class="cookie-flag" title="HttpOnly">H</span>');
      if (c.secure) flagBadges.push('<span class="cookie-flag" title="Secure">S</span>');
      const flagsRow = flagBadges.length ? '<span class="cookie-flags-row">' + flagBadges.join('') + '</span>' : '';
      li.innerHTML =
        '<button type="button" class="cookie-row" aria-expanded="' + isExpanded + '">' +
        '<span class="cookie-row-name" title="' + nameDisplay + '">' + nameDisplay + '</span>' +
        '<span class="cookie-row-meta">' + rowMeta + '</span>' +
        flagsRow +
        (greylisted ? '<span class="cookie-badge-greylist" title="Matches greylist (watch)">GL</span>' : '') +
        (blacklisted ? '<span class="cookie-badge-blacklist" title="Matches blacklist">BL</span>' : '') +
        (third ? '<span class="cookie-badge">3rd</span>' : '') +
        '<span class="cookie-chevron" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5L6 7.5L9 4.5"/></svg></span>' +
        '</button>' +
        '<div class="cookie-details" hidden>' + detailsHtml + '</div>';
      list.appendChild(li);

      const row = li.querySelector('.cookie-row');
      const details = li.querySelector('.cookie-details');
      row.addEventListener('click', () => {
        if (expandedKeys.has(key)) {
          expandedKeys.delete(key);
          details.hidden = true;
          row.setAttribute('aria-expanded', 'false');
          li.classList.remove('is-expanded');
        } else {
          expandedKeys.add(key);
          details.hidden = false;
          row.setAttribute('aria-expanded', 'true');
          li.classList.add('is-expanded');
        }
      });
      if (isExpanded) {
        details.hidden = false;
      }
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function truncate(s, max) {
    if (!s) return '';
    return s.length <= max ? s : s.slice(0, max) + '…';
  }

  function updateStats(cookies) {
    const siteHostname = new URL(currentOrigin || 'https://x').hostname;
    let first = 0,
      third = 0;
    cookies.forEach((c) => {
      if (isThirdParty(c, siteHostname)) third++;
      else first++;
    });
    elements.totalCount.textContent = String(cookies.length);
    elements.firstPartyCount.textContent = String(first);
    elements.thirdPartyCount.textContent = String(third);
    const showBreakdown = first > 0 && third > 0;
    elements.statFirst.hidden = !showBreakdown;
    elements.statThird.hidden = !showBreakdown;
  }

  function showError(msg) {
    elements.cookieList.innerHTML = '';
    elements.emptyState.hidden = true;
    elements.errorState.hidden = false;
    elements.errorMessage.textContent = msg;
    elements.totalCount.textContent = '0';
    elements.firstPartyCount.textContent = '0';
    elements.thirdPartyCount.textContent = '0';
    elements.statFirst.hidden = true;
    elements.statThird.hidden = true;
  }

  function load() {
    elements.siteDomain.textContent = 'Loading…';
    loadBlacklists()
      .then(() => getCurrentTabUrl())
      .then(({ url, origin, hostname }) => {
        currentOrigin = origin;
        elements.siteDomain.textContent = hostname || origin;
        return getCookiesForUrl(url);
      })
      .then((cookies) => {
        allCookies = cookies;
        updateStats(cookies);
        renderCookies(cookies, elements.search.value);
      })
      .catch((err) => {
        currentOrigin = '';
        elements.siteDomain.textContent = '—';
        showError(err && err.message ? err.message : 'Could not load cookies.');
      });
  }

  elements.search.addEventListener('input', () => {
    renderCookies(allCookies, elements.search.value);
  });

  elements.refresh.addEventListener('click', () => {
    load();
  });

  function openSettings() {
    showConfig(true);
    refreshConfigPanelTags();
  }

  elements.configToggle.addEventListener('click', openSettings);
  elements.btnSettings.addEventListener('click', openSettings);

  elements.configClose.addEventListener('click', () => {
    showConfig(false);
  });

  function addBlacklistName() {
    const raw = (elements.blacklistNameInput.value || '').trim();
    if (!raw || blacklistNames.includes(raw)) return;
    blacklistNames.push(raw);
    saveBlacklistNames();
    elements.blacklistNameInput.value = '';
    refreshConfigPanelTags();
    renderCookies(allCookies, elements.search.value);
  }

  function addBlacklistValue() {
    const raw = (elements.blacklistValueInput.value || '').trim();
    if (!raw || blacklistValues.includes(raw)) return;
    blacklistValues.push(raw);
    saveBlacklistValues();
    elements.blacklistValueInput.value = '';
    refreshConfigPanelTags();
    renderCookies(allCookies, elements.search.value);
  }

  function addGreylistName() {
    const raw = (elements.greylistNameInput.value || '').trim();
    if (!raw || greylistNames.includes(raw)) return;
    greylistNames.push(raw);
    saveGreylistNames();
    elements.greylistNameInput.value = '';
    refreshConfigPanelTags();
    renderCookies(allCookies, elements.search.value);
  }

  function addGreylistValue() {
    const raw = (elements.greylistValueInput.value || '').trim();
    if (!raw || greylistValues.includes(raw)) return;
    greylistValues.push(raw);
    saveGreylistValues();
    elements.greylistValueInput.value = '';
    refreshConfigPanelTags();
    renderCookies(allCookies, elements.search.value);
  }

  elements.blacklistNameAdd.addEventListener('click', addBlacklistName);
  elements.blacklistValueAdd.addEventListener('click', addBlacklistValue);
  elements.greylistNameAdd.addEventListener('click', addGreylistName);
  elements.greylistValueAdd.addEventListener('click', addGreylistValue);
  elements.blacklistNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addBlacklistName(); }
  });
  elements.blacklistValueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addBlacklistValue(); }
  });
  elements.greylistNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addGreylistName(); }
  });
  elements.greylistValueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addGreylistValue(); }
  });

  load();
})();
