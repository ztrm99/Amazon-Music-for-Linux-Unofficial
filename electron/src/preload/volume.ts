import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("amusizVolume", {
  getState: () => ipcRenderer.invoke("volume:getState"),
  set: (volume: number) => ipcRenderer.invoke("volume:set", volume),
  toggleMute: () => ipcRenderer.invoke("volume:toggleMute")
});

