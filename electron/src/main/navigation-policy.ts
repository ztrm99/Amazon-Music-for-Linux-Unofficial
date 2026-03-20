import { shell, type WebContents } from "electron";

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function applyNavigationPolicy(webContents: WebContents): void {
  webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) {
      void webContents.loadURL(url);
      return { action: "deny" };
    }

    void shell.openExternal(url);
    return { action: "deny" };
  });

  webContents.on("will-navigate", (event, url) => {
    if (isWebUrl(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });
}
