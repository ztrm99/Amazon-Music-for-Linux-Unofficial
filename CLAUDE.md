# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Unofficial Amazon Music Linux desktop wrapper. Electron shell that loads `https://music.amazon.com` with Widevine DRM support via the Castlabs Electron fork.

All code lives under `electron/`. Run all npm commands from there.

## Commands

```bash
cd electron

npm install              # install deps (uses Castlabs electron, not stock)
npm run build            # tsc + copy-assets → dist/
npm run dev              # build + launch (--no-sandbox, dev only)
npm run dev:debug        # same + DevTools Protocol on port 9222
npm run dist:linux       # AppImage + deb + pacman (requires bsdtar)
npm run dist:ubuntu      # AppImage + deb
npm run dist:arch        # AppImage + pacman (requires bsdtar)
```

`bsdtar` is required for pacman targets. On Ubuntu: `sudo apt install libarchive-tools`. The `dist:linux` and `dist:arch` scripts run `scripts/check-packaging-deps.mjs` to verify this before building.

There are no tests. Manual verification path is in `docs/MVP_VERIFICATION.md`.

## Architecture

```
src/
  main/
    index.ts            ← app entry: IPC handlers, menu, lifecycle
    window.ts           ← BrowserWindow creation, UA spoofing, volume via executeJavaScript
    navigation-policy.ts← allow in-app nav, send external links to system browser
  shared/
    config.ts           ← AMAZON_MUSIC_URL, AMAZON_MUSIC_PARTITION, ALLOWED_HOSTS
  preload/
    index.ts            ← Chrome compat overrides (navigator.*), exposes window.amusiz
    volume.ts           ← exposes window.amusizVolume for the volume popup
  renderer/
    volume.html         ← standalone volume slider window (no framework)
```

**Two-layer UA spoofing**: request headers are rewritten in `onBeforeSendHeaders` (network layer) AND `Navigator.prototype` is overridden via `webFrame.executeJavaScript` in the preload (JS layer). Both are required — Amazon checks both.

**Volume control**: implemented entirely via `executeJavaScript` injected into the main window, targeting `audio`/`video` elements in the DOM. There is no Electron audio API involved.

**Widevine**: `components.whenReady()` is awaited before the main window opens (`index.ts:141`). This is a Castlabs-specific API — stock Electron has no `components` export.

**Session partition** `persist:amazon-music` keeps login state across restarts. Three layers work together:
1. `session.webRequest.onBeforeRequest` (`navigation-policy.ts`) strips `openid.pape.max_auth_age=0` from every `/ap/signin` request at the Chromium network layer. Amazon Music's JS always appends this param when STS tokens in localStorage have expired (~1-hour TTL); without it, Amazon's auth server does a transparent OpenID exchange instead of showing a login form.
2. `saveCookies()`/`restoreCookies()` in `index.ts` back up session cookies to `session-cookies.json` in `userData` on quit and replay them on startup, covering the gap before the persist partition's LevelDB is fully warm.
3. `clearStaleLocks()` in `index.ts` removes leftover LevelDB `LOCK` files from the partition directory on startup to prevent storage-open failures after an unclean shutdown.

**`--no-sandbox`** is a dev-only workaround (passed in `npm run dev`, not baked into packaged builds).

## Key constraints

- Electron version is pinned to a Castlabs release (`castlabs/electron-releases#v37.8.0+wvcus`) for Widevine support. Do not switch to stock Electron.
- `contextIsolation: true` and `nodeIntegration: false` must stay on the main window — Amazon Music is untrusted content.
- Navigation policy must deny `window.open` and redirect non-http(s) URLs to the system browser.
- Phase 2+ features (region switching, window state persistence, tray, MPRIS) are not yet in scope. See `docs/PHASED_ROADMAP.md`.
