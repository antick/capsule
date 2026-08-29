import {
  APP_NAME,
  type CapsuleSettings,
  COPY,
  PLACEMENT_LABELS,
  PLACEMENT_MENU_GROUPS,
  type PlacementPreset,
} from "@capsule/config";
import { app, Menu, type MenuItemConstructorOptions, Tray } from "electron";
import { dockAppImage, trayTemplateImage } from "./tray-icon.ts";

export interface AppChromeHandlers {
  getSettings: () => CapsuleSettings;
  applyPlacement: (preset: PlacementPreset) => void;
  openSettings: () => void;
  quit: () => void;
}

export function createAppChrome(handlers: AppChromeHandlers): {
  sync: (settings: CapsuleSettings) => void;
  popup: () => void;
} {
  const tray = new Tray(trayTemplateImage());
  tray.setToolTip(APP_NAME);
  tray.on("click", () => {
    tray.popUpContextMenu();
  });

  if (process.platform === "darwin") {
    app.dock?.show();
    app.dock?.setIcon(dockAppImage());
  }

  const sync = (settings: CapsuleSettings) => {
    const trayMenu = Menu.buildFromTemplate(
      capsuleCommandTemplate(settings, handlers),
    );
    tray.setContextMenu(trayMenu);
    if (process.platform === "darwin") {
      app.dock?.setMenu(trayMenu);
    }
    Menu.setApplicationMenu(
      Menu.buildFromTemplate(applicationMenuTemplate(settings, handlers)),
    );
  };

  sync(handlers.getSettings());
  return {
    sync,
    popup: () => {
      Menu.buildFromTemplate(
        capsuleCommandTemplate(handlers.getSettings(), handlers),
      ).popup();
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
  const items: MenuItemConstructorOptions[] = [];
  for (const [groupIndex, group] of PLACEMENT_MENU_GROUPS.entries()) {
    if (groupIndex > 0) {
      items.push({ type: "separator" });
    }
    for (const preset of group) {
      items.push({
        type: "radio",
        label: PLACEMENT_LABELS[preset],
        checked: preset === current,
        click: () => handlers.applyPlacement(preset),
      });
    }
  }
  return items;
}
