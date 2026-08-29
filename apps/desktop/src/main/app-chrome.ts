import {
  APP_NAME,
  type CapsuleSettings,
  COPY,
  PLACEMENT_LABELS,
  PLACEMENT_PRESETS,
  type PlacementPreset,
} from "@capsule/config";
import { app, Menu, type MenuItemConstructorOptions, Tray } from "electron";
import { trayTemplateImage } from "./tray-icon.ts";

export interface AppChromeHandlers {
  getSettings: () => CapsuleSettings;
  applyPlacement: (preset: PlacementPreset) => void;
  openSettings: () => void;
  quit: () => void;
}

export function createAppChrome(handlers: AppChromeHandlers): {
  sync: (settings: CapsuleSettings) => void;
  popup: (onClose?: () => void) => void;
} {
  const tray = new Tray(trayTemplateImage());
  tray.setToolTip(APP_NAME);
  tray.on("click", () => {
    tray.popUpContextMenu();
  });

  if (process.platform === "darwin") {
    // Capsule is reached from the menu bar and the dock itself, so a Dock tile
    // would be a second copy of the same commands taking up space.
    app.dock?.hide();
  }

  const sync = (settings: CapsuleSettings) => {
    tray.setContextMenu(
      Menu.buildFromTemplate(capsuleCommandTemplate(settings, handlers)),
    );
    Menu.setApplicationMenu(
      Menu.buildFromTemplate(applicationMenuTemplate(settings, handlers)),
    );
  };

  sync(handlers.getSettings());
  return {
    sync,
    popup: (onClose) => {
      Menu.buildFromTemplate(
        capsuleCommandTemplate(handlers.getSettings(), handlers),
      ).popup({ callback: onClose });
    },
  };
}

export function capsuleCommandTemplate(
  settings: CapsuleSettings,
  handlers: AppChromeHandlers,
): MenuItemConstructorOptions[] {
  return [
    {
      label: COPY.openSettings,
      click: () => handlers.openSettings(),
    },
    { type: "separator" },
    {
      label: COPY.position,
      submenu: placementTemplate(settings.placementPreset, handlers),
    },
    { type: "separator" },
    {
      label: COPY.quit,
      click: () => handlers.quit(),
    },
  ];
}

function applicationMenuTemplate(
  settings: CapsuleSettings,
  handlers: AppChromeHandlers,
): MenuItemConstructorOptions[] {
  return [
    {
      label: APP_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: COPY.settings,
          accelerator: "CommandOrControl+,",
          click: () => handlers.openSettings(),
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit", label: COPY.quit },
      ],
    },
    {
      label: COPY.position,
      submenu: placementTemplate(settings.placementPreset, handlers),
    },
  ];
}

function placementTemplate(
  current: PlacementPreset,
  handlers: AppChromeHandlers,
): MenuItemConstructorOptions[] {
  return PLACEMENT_PRESETS.map((preset) => ({
    type: "radio",
    label: PLACEMENT_LABELS[preset],
    checked: preset === current,
    click: () => handlers.applyPlacement(preset),
  }));
}
