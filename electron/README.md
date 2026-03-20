# Electron MVP

This directory contains the Phase 1 Electron MVP for the Amazon Music Linux wrapper.

## Planned commands

- `npm install` to install Electron and TypeScript tooling
- `npm run dev` to compile and launch the app locally
- `npm run dev:debug` to launch with Chrome DevTools Protocol on port `9222`
- `npm run build` to compile TypeScript into `dist/`
- `npm run pack` to build Linux artifacts with `electron-builder`
- `npm run dist:ubuntu` to build `AppImage` and `deb`
- `npm run dist:arch` to build `AppImage` and `pacman`
- `npm run dist:linux` to build all configured Linux artifacts

Note: the development command currently starts Electron with `--no-sandbox` on Linux so local runs work without configuring the `chrome-sandbox` helper binary. Keep that as a development-only workaround.

## DRM note

Amazon Music’s web player requires Widevine for protected playback. This project is configured to use the Castlabs Electron distribution instead of stock Electron so the Widevine CDM can be installed and initialized before the main window opens.

## Current MVP scope

- Chromium-based `BrowserWindow`
- persistent Electron session partition for login state
- strict default web preferences
- reload menu actions
- native volume controls from the app menu
- external-link handling

## Audio shortcuts

- `Ctrl+Up` increases volume
- `Ctrl+Down` decreases volume
- `Ctrl+M` toggles mute
- `Ctrl+Shift+V` opens the volume slider window

See `../docs/PHASED_ROADMAP.md` and `../docs/ELECTRON_IMPLEMENTATION_PLAN.md` for scope and architecture.
See `../docs/PACKAGING.md` for Linux packaging targets and commands.
