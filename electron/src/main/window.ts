import { BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AMAZON_MUSIC_PARTITION,
  AMAZON_MUSIC_URL,
  LINUX_X64_PLATFORM,
  WINDOW_TITLE
} from "../shared/config.js";
import { applyNavigationPolicy } from "./navigation-policy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const preloadPath = path.join(__dirname, "..", "preload", "index.js");
const volumePreloadPath = path.join(__dirname, "..", "preload", "volume.js");

type VolumeAction = "up" | "down" | "mute";
type VolumeState = {
  muted: boolean;
  volume: number;
};

function buildChromeUserAgent(): string {
  const chromeVersion = process.versions.chrome;

  return [
    "Mozilla/5.0",
    `(${LINUX_X64_PLATFORM})`,
    "AppleWebKit/537.36",
    "(KHTML, like Gecko)",
    `Chrome/${chromeVersion}`,
    "Safari/537.36"
  ].join(" ");
}

function buildSecChUa(): string {
  const majorVersion = process.versions.chrome.split(".")[0] ?? "137";

  return [
    `"Google Chrome";v="${majorVersion}"`,
    `"Chromium";v="${majorVersion}"`,
    '"Not/A)Brand";v="24"'
  ].join(", ");
}

function configureAmazonRequestHeaders(window: BrowserWindow): void {
  const chromeUserAgent = buildChromeUserAgent();
  const session = window.webContents.session;

  session.webRequest.onBeforeSendHeaders(
    {
      urls: [
        "*://amazon.com/*",
        "*://*.amazon.com/*",
        "*://amazon.it/*",
        "*://*.amazon.it/*",
        "*://amazon.fr/*",
        "*://*.amazon.fr/*",
        "*://amazon.de/*",
        "*://*.amazon.de/*",
        "*://amazon.es/*",
        "*://*.amazon.es/*",
        "*://*.media-amazon.com/*",
        "*://*.amazonaws.com/*"
      ]
    },
    (details, callback) => {
      details.requestHeaders["User-Agent"] = chromeUserAgent;
      details.requestHeaders["sec-ch-ua"] = buildSecChUa();
      details.requestHeaders["sec-ch-ua-mobile"] = "?0";
      details.requestHeaders["sec-ch-ua-platform"] = '"Linux"';
      callback({ requestHeaders: details.requestHeaders });
    }
  );
}

function runVolumeScript(window: BrowserWindow, action: VolumeAction): Promise<void> {
  const script = `
    (() => {
      const STEP = 0.1;
      const mediaElements = Array.from(document.querySelectorAll("audio, video"));

      if (mediaElements.length === 0) {
        return;
      }

      const activeElement =
        mediaElements.find((element) => !element.paused) ??
        mediaElements[0];

      if (!activeElement) {
        return;
      }

      if (${JSON.stringify(action)} === "mute") {
        activeElement.muted = !activeElement.muted;
        return;
      }

      activeElement.muted = false;

      if (${JSON.stringify(action)} === "up") {
        activeElement.volume = Math.min(1, activeElement.volume + STEP);
        return;
      }

      activeElement.volume = Math.max(0, activeElement.volume - STEP);
    })();
  `;

  return window.webContents.executeJavaScript(script, true).then(() => undefined);
}

function readVolumeScript(window: BrowserWindow): Promise<VolumeState> {
  const script = `
    (() => {
      const mediaElements = Array.from(document.querySelectorAll("audio, video"));
      const activeElement =
        mediaElements.find((element) => !element.paused) ??
        mediaElements[0];

      if (!activeElement) {
        return { muted: false, volume: 1 };
      }

      return {
        muted: Boolean(activeElement.muted),
        volume: Number(activeElement.volume ?? 1)
      };
    })();
  `;

  return window.webContents.executeJavaScript(script, true) as Promise<VolumeState>;
}

function setVolumeScript(window: BrowserWindow, volume: number): Promise<VolumeState> {
  const script = `
    (() => {
      const nextVolume = Math.min(1, Math.max(0, ${JSON.stringify(volume)}));
      const mediaElements = Array.from(document.querySelectorAll("audio, video"));
      const activeElement =
        mediaElements.find((element) => !element.paused) ??
        mediaElements[0];

      if (!activeElement) {
        return { muted: false, volume: nextVolume };
      }

      activeElement.muted = false;
      activeElement.volume = nextVolume;

      return {
        muted: Boolean(activeElement.muted),
        volume: Number(activeElement.volume ?? nextVolume)
      };
    })();
  `;

  return window.webContents.executeJavaScript(script, true) as Promise<VolumeState>;
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: WINDOW_TITLE,
    backgroundColor: "#111111",
    autoHideMenuBar: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      partition: AMAZON_MUSIC_PARTITION,
      spellcheck: false,
      autoplayPolicy: "no-user-gesture-required"
    }
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.setUserAgent(buildChromeUserAgent());
  configureAmazonRequestHeaders(window);
  applyNavigationPolicy(window.webContents);
  void window.loadURL(AMAZON_MUSIC_URL);

  return window;
}

export function createVolumeWindow(parent: BrowserWindow): BrowserWindow {
  const window = new BrowserWindow({
    width: 360,
    height: 180,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: "Volume",
    backgroundColor: "#161616",
    autoHideMenuBar: true,
    parent,
    webPreferences: {
      preload: volumePreloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  void window.loadFile(path.join(__dirname, "..", "renderer", "volume.html"));

  return window;
}

export function increaseVolume(window: BrowserWindow): Promise<void> {
  return runVolumeScript(window, "up");
}

export function decreaseVolume(window: BrowserWindow): Promise<void> {
  return runVolumeScript(window, "down");
}

export function toggleMute(window: BrowserWindow): Promise<void> {
  return runVolumeScript(window, "mute");
}

export function getVolumeState(window: BrowserWindow): Promise<VolumeState> {
  return readVolumeScript(window);
}

export function setVolume(window: BrowserWindow, volume: number): Promise<VolumeState> {
  return setVolumeScript(window, volume);
}
