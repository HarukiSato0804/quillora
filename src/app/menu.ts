import {
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";

export type MenuHandlers = {
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onQuit: () => void;
};

function fileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] || path;
}

// The menu is rebuilt whenever the recent-files list changes; the most
// recent setAsAppMenu call wins.
export async function setupAppMenu(
  handlers: MenuHandlers,
  recentFiles: string[]
): Promise<void> {
  const separator = () => PredefinedMenuItem.new({ item: "Separator" });

  const openRecentSubmenu = await Submenu.new({
    text: "Open Recent",
    enabled: recentFiles.length > 0,
    items: await Promise.all(
      recentFiles.map((path) =>
        MenuItem.new({
          text: fileName(path),
          action: () => handlers.onOpenRecent(path),
        })
      )
    ),
  });

  const appSubmenu = await Submenu.new({
    text: "Markflow",
    items: [
      await PredefinedMenuItem.new({ item: "Hide", text: "Hide Markflow" }),
      await PredefinedMenuItem.new({ item: "HideOthers" }),
      await PredefinedMenuItem.new({ item: "ShowAll" }),
      await separator(),
      await MenuItem.new({
        text: "Quit Markflow",
        accelerator: "CmdOrCtrl+Q",
        action: handlers.onQuit,
      }),
    ],
  });

  const fileSubmenu = await Submenu.new({
    text: "File",
    items: [
      await MenuItem.new({
        text: "New",
        accelerator: "CmdOrCtrl+N",
        action: handlers.onNew,
      }),
      await MenuItem.new({
        text: "Open…",
        accelerator: "CmdOrCtrl+O",
        action: handlers.onOpen,
      }),
      openRecentSubmenu,
      await separator(),
      await MenuItem.new({
        text: "Save",
        accelerator: "CmdOrCtrl+S",
        action: handlers.onSave,
      }),
      await MenuItem.new({
        text: "Save As…",
        accelerator: "CmdOrCtrl+Shift+S",
        action: handlers.onSaveAs,
      }),
    ],
  });

  const editSubmenu = await Submenu.new({
    text: "Edit",
    items: [
      await PredefinedMenuItem.new({ item: "Undo" }),
      await PredefinedMenuItem.new({ item: "Redo" }),
      await separator(),
      await PredefinedMenuItem.new({ item: "Cut" }),
      await PredefinedMenuItem.new({ item: "Copy" }),
      await PredefinedMenuItem.new({ item: "Paste" }),
      await PredefinedMenuItem.new({ item: "SelectAll" }),
    ],
  });

  const windowSubmenu = await Submenu.new({
    text: "Window",
    items: [
      await PredefinedMenuItem.new({ item: "Minimize" }),
      await PredefinedMenuItem.new({ item: "Maximize" }),
      await separator(),
      await PredefinedMenuItem.new({ item: "CloseWindow" }),
    ],
  });

  const menu = await Menu.new({
    items: [appSubmenu, fileSubmenu, editSubmenu, windowSubmenu],
  });
  await menu.setAsAppMenu();
}
