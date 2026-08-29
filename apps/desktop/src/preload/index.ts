import {
  type CapsuleSettings,
  IPC,
  type ProviderId,
  type Rect,
  type UsageSnapshot,
} from "@capsule/config";
import { contextBridge, ipcRenderer } from "electron";

export interface CapsuleBridge {
  getSettings: () => Promise<CapsuleSettings>;
  setSettings: (settings: CapsuleSettings) => Promise<CapsuleSettings>;
  openSettings: (hash?: string) => Promise<void>;
  quit: () => Promise<void>;
  setPointerCapture: (capture: boolean) => void;
  /** Window-local areas the dock wants the mouse for. */
  setHitRegions: (regions: Rect[]) => void;
  setExpanded: (open: boolean, providerId: ProviderId | null) => void;
  /** Fires when main asks this window to show a different page. */
  onNavigate: (listener: (hash: string) => void) => () => void;
  /** Fires when the dock's offset inside its window changes. */
  onRailBias: (listener: (bias: number) => void) => () => void;
  startMove: (screenX: number, screenY: number) => void;
  endMove: () => Promise<void>;
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
  setHitRegions: (regions) => {
    ipcRenderer.send(IPC.setHitRegions, regions);
  },
  setExpanded: (open, providerId) => {
    ipcRenderer.send(IPC.setExpanded, open, providerId);
  },
  onNavigate: (listener) => {
    const handler = (_event: unknown, hash: string) => listener(hash);
    ipcRenderer.on(IPC.navigate, handler);
    return () => {
      ipcRenderer.off(IPC.navigate, handler);
    };
  },
  onRailBias: (listener) => {
    const handler = (_event: unknown, bias: number) => listener(bias);
    ipcRenderer.on(IPC.railBias, handler);
    return () => {
      ipcRenderer.off(IPC.railBias, handler);
    };
  },
  startMove: (screenX, screenY) => {
    ipcRenderer.send(IPC.startMove, screenX, screenY);
  },
  endMove: () => ipcRenderer.invoke(IPC.endMove),
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
