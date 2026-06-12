import {
  activeDocument,
  isDirty,
  type WorkspaceState,
} from "../editor/store/workspaceStore";

export type AppCommandId =
  | "newDocument"
  | "openDocuments"
  | "saveDocument"
  | "saveDocumentAs"
  | "saveAllDocuments"
  | "closeActiveDocument"
  | "closeOtherDocuments"
  | "view:split-right"
  | "view:split-down"
  | "revealInFinder"
  | "copyFilePath"
  | "toggleSidebar"
  | "toggleOutline"
  | "toggleFocusMode"
  | "toggleTypewriterMode"
  | "toggleBold"
  | "toggleItalic"
  | "toggleInlineCode"
  | "insertLink"
  | "insertCodeBlock"
  | "insertQuote"
  | "insertOrderedList"
  | "insertUnorderedList"
  | "insertTaskList"
  | "find"
  | "replace"
  | "openSettings";

export type AppCommand = {
  id: AppCommandId;
  title: string;
  shortcut?: string;
  enabled: (workspace: WorkspaceState) => boolean;
  run: () => Promise<void> | void;
};

export type CommandHandlers = Record<AppCommandId, () => Promise<void> | void>;

const always = () => true;
const hasActiveDocument = (ws: WorkspaceState) => activeDocument(ws) !== null;
const hasSavedPath = (ws: WorkspaceState) =>
  activeDocument(ws)?.path != null;
const hasMultipleDocuments = (ws: WorkspaceState) => ws.documents.length > 1;
const hasAnyDirty = (ws: WorkspaceState) => ws.documents.some(isDirty);

// Single source of truth for every user-facing action. The native menu,
// keyboard shortcuts, toolbar, and a future command palette all execute
// these commands; none of them duplicates business logic.
export function createCommands(handlers: CommandHandlers): AppCommand[] {
  const command = (
    id: AppCommandId,
    title: string,
    enabled: AppCommand["enabled"],
    shortcut?: string
  ): AppCommand => ({ id, title, shortcut, enabled, run: handlers[id] });

  return [
    command("newDocument", "New", always, "Cmd+N"),
    command("openDocuments", "Open…", always, "Cmd+O"),
    command("saveDocument", "Save", hasActiveDocument, "Cmd+S"),
    command("saveDocumentAs", "Save As…", hasActiveDocument, "Cmd+Shift+S"),
    command("saveAllDocuments", "Save All", hasAnyDirty),
    command("closeActiveDocument", "Close Tab", hasActiveDocument, "Cmd+W"),
    command("closeOtherDocuments", "Close Other Tabs", hasMultipleDocuments),
    command("view:split-right", "Split Right", hasActiveDocument, "Cmd+\\"),
    command(
      "view:split-down",
      "Split Down",
      hasActiveDocument,
      "Cmd+Shift+\\"
    ),
    command("revealInFinder", "Reveal in Finder", hasSavedPath),
    command("copyFilePath", "Copy File Path", hasSavedPath),
    command("toggleSidebar", "Toggle Sidebar", always),
    command("toggleOutline", "Toggle Outline", always),
    command("toggleFocusMode", "Toggle Focus Mode", always),
    command("toggleTypewriterMode", "Toggle Typewriter Mode", always),
    command("toggleBold", "Bold", hasActiveDocument, "Cmd+B"),
    command("toggleItalic", "Italic", hasActiveDocument, "Cmd+I"),
    command("toggleInlineCode", "Inline Code", hasActiveDocument, "Cmd+E"),
    command("insertLink", "Link", hasActiveDocument, "Cmd+K"),
    command("insertCodeBlock", "Code Block", hasActiveDocument),
    command("insertQuote", "Quote", hasActiveDocument),
    command("insertOrderedList", "Ordered List", hasActiveDocument),
    command("insertUnorderedList", "Unordered List", hasActiveDocument),
    command("insertTaskList", "Task List", hasActiveDocument),
    command("find", "Find", hasActiveDocument, "Cmd+F"),
    command("replace", "Replace", hasActiveDocument, "Cmd+Option+F"),
    command("openSettings", "Settings…", always, "Cmd+,"),
  ];
}

export function commandById(
  commands: AppCommand[],
  id: AppCommandId
): AppCommand | undefined {
  return commands.find((command) => command.id === id);
}

export function runCommand(
  commands: AppCommand[],
  id: AppCommandId,
  workspace: WorkspaceState
): boolean {
  const command = commandById(commands, id);
  if (!command || !command.enabled(workspace)) {
    return false;
  }
  void command.run();
  return true;
}

type ParsedShortcut = {
  meta: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
};

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split("+");
  const key = parts[parts.length - 1];
  return {
    meta: parts.includes("Cmd"),
    shift: parts.includes("Shift"),
    alt: parts.includes("Option"),
    key: key.toLowerCase(),
  };
}

export function commandForKeyEvent(
  commands: AppCommand[],
  event: Pick<
    KeyboardEvent,
    "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "key"
  >
): AppCommand | undefined {
  if (!event.metaKey || event.ctrlKey) {
    return undefined;
  }
  return commands.find((command) => {
    if (!command.shortcut) {
      return false;
    }
    const parsed = parseShortcut(command.shortcut);
    return (
      parsed.meta &&
      event.shiftKey === parsed.shift &&
      event.altKey === parsed.alt &&
      event.key.toLowerCase() === parsed.key
    );
  });
}

// Converts the registry's shortcut notation into a Tauri menu accelerator.
export function shortcutToAccelerator(shortcut: string): string {
  return shortcut.replace("Cmd", "CmdOrCtrl").replace("Option", "Alt");
}
