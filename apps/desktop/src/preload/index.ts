import {
  type ActivityByProvider,
  type CapsuleSettings,
  type Corner,
  type HardwareNotch,
  IPC,
  type ProviderId,
  type Rect,
  type UsageSnapshot,
} from "@capsule/config";
import { contextBridge, ipcRenderer } from "electron";

/** How the overlay should draw itself inside the window main just gave it. */
export interface DockFrame {
  railBias: number;
  corner: Corner | null;
  /** The display's own notch, when the dock is drawn as it. */
  hardwareNotch: HardwareNotch | null;
}

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
  /** Fires when the dock's offset inside its window, or its corner, changes. */
  onDockFrame: (listener: (frame: DockFrame) => void) => () => void;
  /** Fires when main's hit test sees the cursor arrive at, or leave, the dock. */
  onPointerInside: (listener: (inside: boolean) => void) => () => void;
  /** Ask for one provider's usage to be fetched again, right now. */
  refreshProvider: (providerId: ProviderId) => void;
  /** Ask for the dock to unroll and stay out for a moment. */
  revealDock: () => void;
  /** Fires on the overlay when that ask arrives. */
  onRevealDock: (listener: () => void) => () => void;
  /** Live agent sessions by provider, now and whenever they change. */
  onActivity: (listener: (activity: ActivityByProvider) => void) => () => void;
  /** Hold an auto-hiding dock out, or let it go. */
  setKeepOpen: (keepOpen: boolean) => void;
  /** Whether the dock is being held out, now and whenever that changes. */
  onKeepOpen: (listener: (keepOpen: boolean) => void) => () => void;
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
  onDockFrame: (listener) => {
    const handler = (_event: unknown, frame: DockFrame) => listener(frame);
    ipcRenderer.on(IPC.dockFrame, handler);
    // Main publishes on did-finish-load, which lands before React has mounted
    // and subscribed, so ask for the current frame rather than wait for the
    // next one — otherwise a reload draws the dock as if it were on an edge.
    void ipcRenderer
      .invoke(IPC.getDockFrame)
      .then((frame: DockFrame) => listener(frame));
    return () => {
      ipcRenderer.off(IPC.dockFrame, handler);
    };
  },
  onPointerInside: (listener) => {
    const handler = (_event: unknown, inside: boolean) => listener(inside);
    ipcRenderer.on(IPC.pointerInside, handler);
    return () => {
      ipcRenderer.off(IPC.pointerInside, handler);
    };
  },
  refreshProvider: (providerId) => {
    ipcRenderer.send(IPC.refreshProvider, providerId);
  },
  revealDock: () => {
    ipcRenderer.send(IPC.revealDock);
  },
  onRevealDock: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(IPC.revealDock, handler);
    return () => {
      ipcRenderer.off(IPC.revealDock, handler);
    };
  },
  onActivity: (listener) => {
    const handler = (_event: unknown, activity: ActivityByProvider) =>
      listener(activity);
    ipcRenderer.on(IPC.activity, handler);
    void ipcRenderer
      .invoke(IPC.getActivity)
      .then((activity: ActivityByProvider) => listener(activity));
    return () => {
      ipcRenderer.off(IPC.activity, handler);
    };
  },
  setKeepOpen: (keepOpen) => {
    ipcRenderer.send(IPC.setKeepOpen, keepOpen);
  },
  onKeepOpen: (listener) => {
    const handler = (_event: unknown, keepOpen: boolean) => listener(keepOpen);
    ipcRenderer.on(IPC.keepOpen, handler);
    void ipcRenderer
      .invoke(IPC.getKeepOpen)
      .then((keepOpen: boolean) => listener(keepOpen));
    return () => {
      ipcRenderer.off(IPC.keepOpen, handler);
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
