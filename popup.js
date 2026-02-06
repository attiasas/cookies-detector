(function () {
  'use strict';

  const elements = {
    siteDomain: document.getElementById('site-domain'),
    totalCount: document.getElementById('total-count'),
    firstPartyCount: document.getElementById('first-party-count'),
    thirdPartyCount: document.getElementById('third-party-count'),
    cookieList: document.getElementById('cookie-list'),
    emptyState: document.getElementById('empty-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    search: document.getElementById('search'),
    refresh: document.getElementById('refresh'),
  };

  let currentOrigin = '';
  let allCookies = [];

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

    filtered.forEach((c) => {
      const li = document.createElement('li');
      li.className = 'cookie-item' + (isThirdParty(c, siteHostname) ? ' third-party' : '');
      const secure = c.secure ? 'Secure' : '';
      const httpOnly = c.httpOnly ? 'HttpOnly' : '';
      const sameSite = c.sameSite ? `SameSite=${c.sameSite}` : '';
      const meta = [secure, httpOnly, sameSite].filter(Boolean).join(' · ') || '—';
      const expiry = c.expirationDate
        ? new Date(c.expirationDate * 1000).toLocaleString()
        : 'Session';
      li.innerHTML =
        '<div class="cookie-name" title="' +
        escapeHtml(c.name) +
        '">' +
        escapeHtml(c.name) +
        '</div>' +
        '<div class="cookie-meta">' +
        '<span title="Domain">' +
        escapeHtml(c.domain || '—') +
        '</span>' +
        '<span>Expires: ' +
        escapeHtml(String(expiry)) +
        '</span>' +
        '</div>' +
        '<div class="cookie-meta">' +
        escapeHtml(meta) +
        '</div>' +
        '<div class="cookie-value-wrap"><span class="cookie-value">' +
        escapeHtml(truncate(c.value, 200)) +
        '</span></div>';
      list.appendChild(li);
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
  }

  function showError(msg) {
    elements.cookieList.innerHTML = '';
    elements.emptyState.hidden = true;
    elements.errorState.hidden = false;
    elements.errorMessage.textContent = msg;
    elements.totalCount.textContent = '0';
    elements.firstPartyCount.textContent = '0';
    elements.thirdPartyCount.textContent = '0';
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
