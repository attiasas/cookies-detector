# Cookies Detector – Chrome Extension

A Chrome extension that shows which cookies each site you visit is using. Open the popup on any webpage to see:

- **Total cookies** sent to that page  
- **First-party vs third-party** breakdown  
- **Cookie details**: name, domain, expiry, Secure/HttpOnly/SameSite, and value  

## Features

- **Per-site view** – Cookies are shown for the current tab’s URL (what the browser would send to that site).
- **First- vs third-party** – Third-party cookies are highlighted so you can see tracking and cross-site cookies.
- **Search** – Filter the list by cookie name or value.
- **Refresh** – Reload the list after new cookies are set.

## Installation (developer mode)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Choose the `cookies-detector` folder (this project).

The extension icon will appear in the toolbar. Visit any website, then click the extension icon to see that site’s cookies.

## Permissions

- **Cookies** – Read cookies so we can list them.
- **Active tab** – Get the current tab’s URL.
- **Storage** – Optional; for future settings.
- **Host permission &lt;all_urls&gt;** – Needed to read cookies for any site you visit.

No data is sent to any server; everything runs locally in your browser.

## Usage

1. Browse to any site (e.g. `https://example.com`).
2. Click the **Cookies Detector** icon in the Chrome toolbar.
3. View the list of cookies, stats, and use the search box to filter.
4. Use **↻ Refresh** after logging in or changing the page to see updated cookies.

## Notes

- The extension only **reads** cookies; it does not add, change, or delete them.
- On non-http(s) pages (e.g. `chrome://`, New Tab), the popup will show an error because those pages have no web cookies.
