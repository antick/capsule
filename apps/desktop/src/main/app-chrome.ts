import {
  APP_NAME,
  type CapsuleSettings,
  COPY,
  PLACEMENT_LABELS,
  PLACEMENT_PRESETS,
  type PlacementPreset,
} from "@capsule/config";
import { Menu, type MenuItemConstructorOptions, Tray } from "electron";
import { hideFromMacDock } from "./macos-dock.ts";
import { trayTemplateImage } from "./tray-icon.ts";

export interface AppChromeHandlers {
  getSettings: () => CapsuleSettings;
  applyPlacement: (preset: PlacementPreset) => void;
  openSettings: () => void;
  revealDock: () => void;
  /** Whether an auto-hiding dock is being held out right now. */
  getKeepOpen: () => boolean;
  toggleKeepOpen: () => void;
  quit: () => void;
}

/**
 * "Keep open": checked while the dock is held out, but only changeable when
 * the dock hides by itself. A dock that is always shown is already held out
 * by a setting, and a menu item that silently loses is worse than one that
 * says it is not yours to press.
 */
function keepOpenItem(
  settings: CapsuleSettings,
  handlers: AppChromeHandlers,
  accelerator?: string,
): MenuItemConstructorOptions {
  return {
    label: COPY.keepOpen,
    type: "checkbox",
    checked: handlers.getKeepOpen(),
    enabled: settings.autoHide,
    toolTip: settings.autoHide ? undefined : COPY.keepOpenDisabledHint,
    accelerator,
    click: () => handlers.toggleKeepOpen(),
  };
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

  // Capsule is reached from the menu bar and the HUD, so a Dock tile would
  // be a second copy of the same process taking up space.
  hideFromMacDock();

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
      label: COPY.showDock,
      click: () => handlers.revealDock(),
    },
    keepOpenItem(settings, handlers),
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
          label: COPY.showDock,
          accelerator: "CommandOrControl+Shift+D",
          click: () => handlers.revealDock(),
        },
        keepOpenItem(settings, handlers, "CommandOrControl+Shift+K"),
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
    { role: "editMenu" },
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
