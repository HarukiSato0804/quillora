import {
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import {
  commandById,
  shortcutToAccelerator,
  type AppCommand,
  type AppCommandId,
} from "./commands";
import type { WorkspaceState } from "../editor/store/workspaceStore";

export type MenuExtras = {
  onOpenRecent: (path: string) => void;
  onQuit: () => void;
};

function fileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] || path;
}

// The menu is rebuilt whenever the recent-files list or command enabled
// states change; the most recent setAsAppMenu call wins. Every command
// item runs the same registry entry as keyboard shortcuts and buttons.
export async function setupAppMenu(
  commands: AppCommand[],
  workspace: WorkspaceState,
  recentFiles: string[],
  extras: MenuExtras
): Promise<void> {
  const separator = () => PredefinedMenuItem.new({ item: "Separator" });

  const commandItem = (id: AppCommandId) => {
    const command = commandById(commands, id);
    if (!command) {
      throw new Error(`Unknown command: ${id}`);
    }
    return MenuItem.new({
      text: command.title,
      accelerator: command.shortcut
        ? shortcutToAccelerator(command.shortcut)
        : undefined,
      enabled: command.enabled(workspace),
      action: () => void command.run(),
    });
  };

  const appSubmenu = await Submenu.new({
    text: "Quillora",
    items: [
      await PredefinedMenuItem.new({
        item: { About: { name: "Quillora" } },
        text: "About Quillora",
      }),
      await separator(),
      await commandItem("openSettings"),
      await separator(),
      await PredefinedMenuItem.new({ item: "Hide", text: "Hide Quillora" }),
      await PredefinedMenuItem.new({ item: "HideOthers" }),
      await PredefinedMenuItem.new({ item: "ShowAll" }),
      await separator(),
      await MenuItem.new({
        text: "Quit Quillora",
        accelerator: "CmdOrCtrl+Q",
        action: extras.onQuit,
      }),
    ],
  });

  const openRecentSubmenu = await Submenu.new({
    text: "Open Recent",
    enabled: recentFiles.length > 0,
    items: await Promise.all(
      recentFiles.map((path) =>
        MenuItem.new({
          text: fileName(path),
          action: () => extras.onOpenRecent(path),
        })
      )
    ),
  });

  const fileSubmenu = await Submenu.new({
    text: "File",
    items: [
      await commandItem("newDocument"),
      await commandItem("openDocuments"),
      openRecentSubmenu,
      await separator(),
      await commandItem("saveDocument"),
      await commandItem("saveDocumentAs"),
      await commandItem("saveAllDocuments"),
      await separator(),
      await commandItem("closeActiveDocument"),
      await commandItem("closeOtherDocuments"),
      await separator(),
      await separator(),
      await commandItem("file:import-folder"),
      await separator(),
      await commandItem("revealInFinder"),
      await commandItem("copyFilePath"),
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
      await separator(),
      await commandItem("find"),
      await commandItem("replace"),
    ],
  });

  const viewSubmenu = await Submenu.new({
    text: "View",
    items: [
      await commandItem("toggleSidebar"),
      await commandItem("toggleOutline"),
      await separator(),
      await commandItem("view:split-right"),
      await commandItem("view:split-down"),
      await separator(),
      await commandItem("toggleFocusMode"),
      await commandItem("toggleTypewriterMode"),
    ],
  });

  const formatSubmenu = await Submenu.new({
    text: "Format",
    items: [
      await commandItem("toggleBold"),
      await commandItem("toggleItalic"),
      await commandItem("toggleInlineCode"),
      await commandItem("insertLink"),
      await separator(),
      await commandItem("insertCodeBlock"),
      await commandItem("insertQuote"),
      await separator(),
      await commandItem("insertOrderedList"),
      await commandItem("insertUnorderedList"),
      await commandItem("insertTaskList"),
    ],
  });

  const windowSubmenu = await Submenu.new({
    text: "Window",
    items: [
      await PredefinedMenuItem.new({ item: "Minimize" }),
      await PredefinedMenuItem.new({ item: "Maximize", text: "Zoom" }),
      await separator(),
      await PredefinedMenuItem.new({ item: "CloseWindow" }),
    ],
  });

  const menu = await Menu.new({
    items: [
      appSubmenu,
      fileSubmenu,
      editSubmenu,
      viewSubmenu,
      formatSubmenu,
      windowSubmenu,
    ],
  });
  await menu.setAsAppMenu();
}
