import { shell, type WebContents } from "electron";

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function stripForcedReauth(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (
      !url.pathname.includes("/ap/signin") ||
      url.searchParams.get("openid.pape.max_auth_age") !== "0"
    ) {
      return null;
    }
    url.searchParams.delete("openid.pape.max_auth_age");
    return url.toString();
  } catch {
    return null;
  }
}

export function applyNavigationPolicy(webContents: WebContents): void {
  // Network-level intercept: catches all navigation paths (window.open, window.location,
  // redirects, form submissions) regardless of origin.
  webContents.session.webRequest.onBeforeRequest(
    { urls: ["*://*/ap/signin*"] },
    (details, callback) => {
      try {
        const url = new URL(details.url);
        if (url.searchParams.get("openid.pape.max_auth_age") === "0") {
          url.searchParams.delete("openid.pape.max_auth_age");
          callback({ redirectURL: url.toString() });
          return;
        }
      } catch { /* ignore malformed URLs */ }
      callback({});
    }
  );

  webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) {
      const cleaned = stripForcedReauth(url) ?? url;
      void webContents.loadURL(cleaned);
      return { action: "deny" };
    }

    void shell.openExternal(url);
    return { action: "deny" };
  });

  webContents.on("will-navigate", (event, url) => {
    if (!isWebUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
      return;
    }

    const cleaned = stripForcedReauth(url);
    if (cleaned !== null) {
      event.preventDefault();
      void webContents.loadURL(cleaned);
    }
  });
}
