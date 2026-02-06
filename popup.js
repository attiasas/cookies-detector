(function () {
  'use strict';

  const elements = {
    siteDomain: document.getElementById('site-domain'),
    totalCount: document.getElementById('total-count'),
    firstPartyCount: document.getElementById('first-party-count'),
    thirdPartyCount: document.getElementById('third-party-count'),
    statThird: document.getElementById('stat-third'),
    cookieList: document.getElementById('cookie-list'),
    emptyState: document.getElementById('empty-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    search: document.getElementById('search'),
    refresh: document.getElementById('refresh'),
  };

  let currentOrigin = '';
  let allCookies = [];
  const expandedKeys = new Set();

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
    const filtered = q
      ? cookies.filter(
          (c) =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.value && c.value.toLowerCase().includes(q))
        )
      : cookies;

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
      const li = document.createElement('li');
      li.className = 'cookie-item' + (third ? ' third-party' : '') + (isExpanded ? ' is-expanded' : '');
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
      const pathDisplay = c.path || '/';
      rowMetaParts.push(escapeHtml(pathDisplay));
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
        (third ? '<span class="cookie-badge">3rd</span>' : '') +
        '<span class="cookie-chevron" aria-hidden="true"></span>' +
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
    elements.statThird.hidden = third === 0;
  }

  function showError(msg) {
    elements.cookieList.innerHTML = '';
    elements.emptyState.hidden = true;
    elements.errorState.hidden = false;
    elements.errorMessage.textContent = msg;
    elements.totalCount.textContent = '0';
    elements.firstPartyCount.textContent = '0';
    elements.thirdPartyCount.textContent = '0';
    elements.statThird.hidden = true;
  }

  function load() {
    elements.siteDomain.textContent = 'Loading…';
    getCurrentTabUrl()
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

  load();
})();
