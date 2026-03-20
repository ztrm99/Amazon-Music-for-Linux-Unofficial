import { contextBridge, ipcRenderer, webFrame } from "electron";

function buildCompatScript(): string {
  const chromeVersion = process.versions.chrome;
  const chromeMajorVersion = chromeVersion.split(".")[0] ?? "137";
  const userAgent = [
    "Mozilla/5.0",
    "(X11; Linux x86_64)",
    "AppleWebKit/537.36",
    "(KHTML, like Gecko)",
    `Chrome/${chromeVersion}`,
    "Safari/537.36"
  ].join(" ");

  return `
    (() => {
      const override = (target, key, value) => {
        Object.defineProperty(target, key, {
          configurable: true,
          get: () => value
        });
      };

      override(Navigator.prototype, "userAgent", ${JSON.stringify(userAgent)});
      override(Navigator.prototype, "appVersion", ${JSON.stringify(userAgent)});
      override(Navigator.prototype, "vendor", "Google Inc.");
      override(Navigator.prototype, "platform", "Linux x86_64");
      override(Navigator.prototype, "productSub", "20030107");

      const brands = [
        { brand: "Google Chrome", version: ${JSON.stringify(chromeMajorVersion)} },
        { brand: "Chromium", version: ${JSON.stringify(chromeMajorVersion)} },
        { brand: "Not/A)Brand", version: "24" }
      ];

      override(Navigator.prototype, "userAgentData", {
        brands,
        mobile: false,
        platform: "Linux",
        getHighEntropyValues: async (hints) => {
          const values = {
            architecture: "x86",
            bitness: "64",
            mobile: false,
            model: "",
            platform: "Linux",
            platformVersion: "6.0.0",
            uaFullVersion: ${JSON.stringify(chromeVersion)},
            fullVersionList: brands.map((brand) => ({
              brand: brand.brand,
              version: ${JSON.stringify(chromeVersion)}
            })),
            wow64: false
          };

          if (!Array.isArray(hints)) {
            return values;
          }

          return hints.reduce((accumulator, hint) => {
            if (hint in values) {
              accumulator[hint] = values[hint];
            }
            return accumulator;
          }, {});
        },
        toJSON: () => ({
          brands,
          mobile: false,
          platform: "Linux"
        })
      });

      if (!window.chrome) {
        Object.defineProperty(window, "chrome", {
          configurable: true,
          value: {}
        });
      }

      if (!window.chrome.runtime) {
        Object.defineProperty(window.chrome, "runtime", {
          configurable: true,
          value: {}
        });
      }
    })();
  `;
}

void webFrame.executeJavaScript(buildCompatScript(), true);

contextBridge.exposeInMainWorld("amusiz", {
  appVersion: () => ipcRenderer.invoke("app:getVersion"),
  refresh: () => ipcRenderer.send("window:refresh")
});
