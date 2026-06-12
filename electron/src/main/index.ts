import * as electron from "electron";
import fs from "node:fs";
import path from "node:path";

const {
  BrowserWindow,
  Menu,
  app,
  ipcMain,
  nativeTheme,
  session
} = electron;

type ComponentsApi = {
  status: () => unknown;
  whenReady: () => Promise<void>;
};

const components = (electron as typeof electron & {
  components?: ComponentsApi;
}).components;

import { AMAZON_MUSIC_PARTITION, WINDOW_TITLE } from "../shared/config.js";
import {
  createVolumeWindow,
  createMainWindow,
  decreaseVolume,
  getVolumeState,
  increaseVolume,
  setVolume,
  toggleMute
} from "./window.js";

let mainWindow = null as ReturnType<typeof createMainWindow> | null;
let volumeWindow = null as ReturnType<typeof createVolumeWindow> | null;

app.commandLine.appendSwitch("no-zygote");
app.commandLine.appendSwitch("in-process-gpu");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("use-angle", "default");

process.on("SIGINT", () => app.quit());
process.on("SIGTERM", () => app.quit());

function clearStaleLocks(dir: string): void {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        clearStaleLocks(path.join(dir, entry.name));
      } else if (entry.name === "LOCK") {
        try {
          fs.unlinkSync(path.join(dir, entry.name));
        } catch { /* already gone */ }
      }
    }
  } catch { /* dir not yet created */ }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  clearStaleLocks(path.join(app.getPath("userData"), "Partitions", "amazon-music"));
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: "App",
      submenu: [
        {
          label: "About",
          click: () => {
            app.setAboutPanelOptions({
              applicationName: WINDOW_TITLE,
              applicationVersion: app.getVersion()
            });
            app.showAboutPanel();
          }
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow?.webContents.reload()
        },
        {
          label: "Force Reload",
          accelerator: "Shift+CmdOrCtrl+R",
          click: () => mainWindow?.webContents.reloadIgnoringCache()
        },
        ...(app.isPackaged
          ? []
          : [
              { type: "separator" as const },
              { role: "toggleDevTools" as const }
            ])
      ]
    },
    {
      label: "Audio",
      submenu: [
        {
          label: "Volume Up",
          accelerator: "CmdOrCtrl+Up",
          click: () => {
            if (mainWindow) {
              void increaseVolume(mainWindow);
            }
          }
        },
        {
          label: "Volume Down",
          accelerator: "CmdOrCtrl+Down",
          click: () => {
            if (mainWindow) {
              void decreaseVolume(mainWindow);
            }
          }
        },
        {
          label: "Mute",
          accelerator: "CmdOrCtrl+M",
          click: () => {
            if (mainWindow) {
              void toggleMute(mainWindow);
            }
          }
        },
        { type: "separator" },
        {
          label: "Volume Control",
          accelerator: "CmdOrCtrl+Shift+V",
          click: () => {
            if (!mainWindow) {
              return;
            }

            if (volumeWindow) {
              volumeWindow.focus();
              return;
            }

            volumeWindow = createVolumeWindow(mainWindow);
            volumeWindow.on("closed", () => {
              volumeWindow = null;
            });
          }
        }
      ]
    }
  ]);
}

function createAppWindow(): void {
  mainWindow = createMainWindow();
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const cookiesBackupPath = path.join(app.getPath("userData"), "session-cookies.json");

async function saveCookies(musicSession: electron.Session): Promise<void> {
  const cookies = await musicSession.cookies.get({});
  fs.writeFileSync(cookiesBackupPath, JSON.stringify(cookies), "utf8");
}

async function restoreCookies(musicSession: electron.Session): Promise<void> {
  try {
    const cookies = JSON.parse(fs.readFileSync(cookiesBackupPath, "utf8")) as electron.Cookie[];
    for (const cookie of cookies) {
      if (!cookie.domain) continue;
      const host = cookie.domain.replace(/^\./, "");
      try {
        await musicSession.cookies.set({
          url: `https://${host}${cookie.path ?? "/"}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path ?? "/",
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          expirationDate: cookie.expirationDate ?? Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
          sameSite: cookie.sameSite
        });
      } catch { /* skip cookies that fail to restore */ }
    }
  } catch { /* no backup file yet */ }
}

let flushingSession = false;

app.on("before-quit", (event) => {
  if (flushingSession) return;
  event.preventDefault();
  flushingSession = true;

  const musicSession = session.fromPartition(AMAZON_MUSIC_PARTITION);
  void Promise.all([
    saveCookies(musicSession),
    musicSession.cookies.flushStore(),
    musicSession.flushStorageData()
  ]).finally(() => app.quit());
});

app.whenReady().then(async () => {
  if (components?.whenReady) {
    await components.whenReady();
  }

  const musicSession = session.fromPartition(AMAZON_MUSIC_PARTITION);
  await restoreCookies(musicSession);

  nativeTheme.themeSource = "dark";
  Menu.setApplicationMenu(buildMenu());
  createAppWindow();

  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.on("window:refresh", () => {
    mainWindow?.webContents.reload();
  });
  ipcMain.handle("volume:getState", async () => {
    if (!mainWindow) {
      return { muted: false, volume: 1 };
    }

    return getVolumeState(mainWindow);
  });
  ipcMain.handle("volume:set", async (_event, value: number) => {
    if (!mainWindow) {
      return { muted: false, volume: 1 };
    }

    return setVolume(mainWindow, value);
  });
  ipcMain.handle("volume:toggleMute", async () => {
    if (!mainWindow) {
      return { muted: false, volume: 1 };
    }

    await toggleMute(mainWindow);
    return getVolumeState(mainWindow);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createAppWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
