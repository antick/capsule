import {
  type CapsuleSettings,
  IPC,
  type ProviderId,
  type UsageSnapshot,
} from "@capsule/config";
import { contextBridge, ipcRenderer } from "electron";

export interface CapsuleBridge {
  getSettings: () => Promise<CapsuleSettings>;
  setSettings: (settings: CapsuleSettings) => Promise<CapsuleSettings>;
  openSettings: (hash?: string) => Promise<void>;
  quit: () => Promise<void>;
  setPointerCapture: (capture: boolean) => void;
  setExpanded: (open: boolean, providerId: ProviderId | null) => void;
  showContextMenu: () => void;
  getSnapshots: () => Promise<{
    snapshots: UsageSnapshot[];
    settings: CapsuleSettings;
  }>;
  onSnapshots: (
    listener: (snapshots: UsageSnapshot[], settings: CapsuleSettings) => void,
  ) => () => void;
}

const capsule: CapsuleBridge = {
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  getSnapshots: () => ipcRenderer.invoke(IPC.getSnapshots),
  setSettings: (settings) => ipcRenderer.invoke(IPC.setSettings, settings),
  openSettings: (hash) => ipcRenderer.invoke(IPC.openSettings, hash),
  quit: () => ipcRenderer.invoke(IPC.quit),
  setPointerCapture: (capture) => {
    ipcRenderer.send(IPC.setPointerCapture, capture);
  },
  setExpanded: (open, providerId) => {
    ipcRenderer.send(IPC.setExpanded, open, providerId);
  },
  showContextMenu: () => {
    ipcRenderer.send(IPC.contextMenu);
  },
  onSnapshots: (listener) => {
    const handler = (
      _event: unknown,
      snapshots: UsageSnapshot[],
      settings: CapsuleSettings,
    ) => {
      listener(snapshots, settings);
    };
    ipcRenderer.on(IPC.snapshots, handler);
    void ipcRenderer
      .invoke(IPC.getSnapshots)
      .then(
        (payload: {
          snapshots: UsageSnapshot[];
          settings: CapsuleSettings;
        }) => {
          listener(payload.snapshots, payload.settings);
        },
      );
    return () => {
      ipcRenderer.off(IPC.snapshots, handler);
    };
  },
};

contextBridge.exposeInMainWorld("capsule", capsule);
