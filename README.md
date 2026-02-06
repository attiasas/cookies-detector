# Cookies Detector – Chrome Extension

A Chrome extension that shows which cookies each site you visit is using. Open the popup on any webpage to see:

- **Total cookies** sent to that page  
- **First-party vs third-party** breakdown  
- **Cookie details**: name, domain, expiry, Secure/HttpOnly/SameSite, and value  
- **Greylist & blacklist** – Highlight and prioritize cookies that match your watch list or block list  

## Features

- **Per-site view** – Cookies are shown for the current tab’s URL (what the browser would send to that site).
- **First- vs third-party** – Third-party cookies are highlighted so you can see tracking and cross-site cookies.
- **Search** – Filter the list by cookie name or value.
- **Refresh** – Reload the list after new cookies are set.

### Greylist (watch / investigate)

- **Cookie name greylist** and **cookie value greylist** – Add terms that match cookies you want to follow or investigate (e.g. `_ga`, `analytics`). Matching is **case-insensitive** and **substring** (full or partial).
- Cookies that match the greylist are **marked in grey** (grey left border, grey “GL” badge) and **listed first** in the popup.
- Use the greylist to monitor cookies before deciding to add them to the blacklist.

### Blacklist (confirmed unwanted)

- **Cookie name blacklist** and **cookie value blacklist** – Add terms for cookies you consider unwanted. Same matching rules: case-insensitive, substring.
- Matching cookies are **marked in orange** (orange left border, “BL” badge) and **listed after greylisted items** but before normal cookies.

### Order in the list

1. **Greylisted** (grey style) – first  
2. **Blacklisted** (orange style) – second  
3. **Normal** – rest  

### Settings (one place for all config)

- **One settings page** for all lists (and any future extension options). Open it from the main page via the **Settings** button in the toolbar or the **gear icon** in the header. The cookie list is hidden while settings are open so the full space is used for configuration.
- **Settings apply to all sites** – Configure greylist and blacklist once; they are used on every site you visit. You do not need to set anything per site.
- Add or remove entries for greylist and blacklist (names and values). Lists are saved in local storage and persist across sessions.

### Badge notification

- When you **enter a site** (load a page or switch to a tab), the extension icon shows a **badge** if that site has cookies matching your greylist or blacklist:
  - **Number** = count of matching cookies (unique; grey + black).
  - **Orange** badge = at least one blacklist match.
  - **Grey** badge = only greylist matches (no blacklist matches).

So you’re notified at a glance when a site has listed cookies, without opening the popup.

## Installation (developer mode)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Choose the `cookies-detector` folder (this project).

The extension icon will appear in the toolbar. Visit any website, then click the extension icon to see that site’s cookies.

## Permissions

- **Cookies** – Read cookies so we can list them and check greylist/blacklist.
- **Active tab** – Get the current tab’s URL.
- **Storage** – Store your greylist and blacklist settings locally.
- **Host permission &lt;all_urls&gt;** – Needed to read cookies for any site you visit.

No data is sent to any server; everything runs locally in your browser.

## Usage

1. Browse to any site (e.g. `https://example.com`).
2. Click the **Cookies Detector** icon in the Chrome toolbar.
3. View the list of cookies (greylisted first, then blacklisted, then others), stats, and use the search box to filter.
4. Use **↻ Refresh** after logging in or changing the page to see updated cookies.
5. Use **Settings** (toolbar button or gear icon) to manage greylist and blacklist; matching cookies are highlighted on every site and the icon badge shows how many matches the current site has.

## Notes

- The extension only **reads** cookies; it does not add, change, or delete them.
- On non-http(s) pages (e.g. `chrome://`, New Tab), the popup will show an error because those pages have no web cookies.
- Greylist and blacklist are stored in Chrome’s local extension storage and apply globally to all sites; they are not synced across devices unless you use Chrome sync for extension data.
