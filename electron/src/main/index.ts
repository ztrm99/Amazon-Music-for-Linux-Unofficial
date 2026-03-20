import * as electron from "electron";

const {
  BrowserWindow,
  Menu,
  app,
  ipcMain,
  nativeTheme
} = electron;

type ComponentsApi = {
  status: () => unknown;
  whenReady: () => Promise<void>;
};

const components = (electron as typeof electron & {
  components?: ComponentsApi;
}).components;

import { WINDOW_TITLE } from "../shared/config.js";
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

app.whenReady().then(async () => {
  if (components?.whenReady) {
    await components.whenReady();
  }

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
