import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { AppShell } from "./AppShell";
import { setupAppMenu } from "./menu";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { Sidebar } from "../editor/ui/Sidebar";
import { StatusBar } from "../editor/ui/StatusBar";
import { parseHeadings } from "../editor/parser/parseHeadings";
import { dirname } from "../editor/parser/parseImages";
import {
  activeDocument,
  addDocuments,
  createWorkspace,
  isDirty,
  markDocumentSaved,
  newUntitledDocument,
  removeDocuments,
  updateDocumentText,
  windowTitle,
  type WorkspaceState,
} from "../editor/store/workspaceStore";
import {
  confirmDiscardChanges,
  getRecentFiles,
  openMarkdownDocument,
  readMarkdownPath,
  recordRecentFile,
  saveMarkdownDocument,
  saveMarkdownDocumentAs,
  takePendingOpenPath,
} from "../editor/tauri/fileApi";

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() =>
    newUntitledDocument(createWorkspace())
  );
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const active = activeDocument(workspace);
  const activeText = active?.text ?? "";

  const [recentFiles, setRecentFiles] = useState<string[]>([]);

  const noteRecent = useCallback(async (path: string) => {
    try {
      setRecentFiles(await recordRecentFile(path));
    } catch {
      // Recent-files persistence is best-effort.
    }
  }, []);

  const headings = useMemo(() => parseHeadings(activeText), [activeText]);

  const title = windowTitle(active);
  useEffect(() => {
    getCurrentWindow()
      .setTitle(title)
      .catch(() => {
        // Outside Tauri (e.g. plain vite dev) there is no native window.
      });
  }, [title]);

  const activeIsDirty = useCallback(() => {
    const doc = activeDocument(workspaceRef.current);
    return doc !== null && isDirty(doc);
  }, []);

  const handleChange = useCallback((text: string) => {
    setWorkspace((ws) =>
      ws.activeDocumentId === null
        ? ws
        : updateDocumentText(ws, ws.activeDocumentId, text)
    );
  }, []);

  // Until tabs land, New/Open keep the single-document UX: the current
  // document is replaced (after a dirty confirmation) rather than kept
  // open alongside the new one.
  const replaceActive = useCallback(
    (transform: (ws: WorkspaceState) => WorkspaceState) => {
      setWorkspace((ws) =>
        transform(
          ws.activeDocumentId === null
            ? ws
            : removeDocuments(ws, [ws.activeDocumentId])
        )
      );
    },
    []
  );

  const newDocument = useCallback(async () => {
    if (activeIsDirty() && !(await confirmDiscardChanges())) {
      return;
    }
    replaceActive((ws) => newUntitledDocument(ws));
  }, [activeIsDirty, replaceActive]);

  const openDocument = useCallback(async () => {
    if (activeIsDirty() && !(await confirmDiscardChanges())) {
      return;
    }
    const opened = await openMarkdownDocument();
    if (opened) {
      replaceActive((ws) =>
        addDocuments(ws, [{ path: opened.path, text: opened.contents }])
      );
      void noteRecent(opened.path);
    }
  }, [activeIsDirty, replaceActive, noteRecent]);

  const saveDocumentAs = useCallback(async () => {
    const doc = activeDocument(workspaceRef.current);
    if (!doc) {
      return;
    }
    const path = await saveMarkdownDocumentAs(doc.text);
    if (path) {
      setWorkspace((ws) => markDocumentSaved(ws, doc.id, path, doc.text));
      void noteRecent(path);
    }
  }, [noteRecent]);

  const saveDocument = useCallback(async () => {
    const doc = activeDocument(workspaceRef.current);
    if (!doc) {
      return;
    }
    if (doc.path === null) {
      await saveDocumentAs();
      return;
    }
    await saveMarkdownDocument(doc.path, doc.text);
    setWorkspace((ws) => markDocumentSaved(ws, doc.id, doc.path!, doc.text));
  }, [saveDocumentAs]);

  const openPath = useCallback(
    async (path: string) => {
      if (activeIsDirty() && !(await confirmDiscardChanges())) {
        return;
      }
      const contents = await readMarkdownPath(path);
      replaceActive((ws) => addDocuments(ws, [{ path, text: contents }]));
      void noteRecent(path);
    },
    [activeIsDirty, replaceActive, noteRecent]
  );

  const quitApp = useCallback(() => {
    // Route quit through the window close so the unsaved-changes
    // confirmation in onCloseRequested applies to Cmd+Q as well.
    void getCurrentWindow().close();
  }, []);

  // Load the persisted recent-files list once at startup.
  useEffect(() => {
    getRecentFiles()
      .then(setRecentFiles)
      .catch(() => {});
  }, []);

  // Native menu (File / Edit / Window) with macOS accelerators. Rebuilt
  // whenever the recent-files list changes.
  useEffect(() => {
    void setupAppMenu(
      {
        onNew: () => void newDocument(),
        onOpen: () => void openDocument(),
        onOpenRecent: (path) =>
          void openPath(path).catch(() => {
            // The file may have been moved or deleted since it was recorded.
          }),
        onSave: () => void saveDocument(),
        onSaveAs: () => void saveDocumentAs(),
        onQuit: quitApp,
      },
      recentFiles
    ).catch(() => {
      // Outside Tauri there is no native menu.
    });
  }, [
    newDocument,
    openDocument,
    openPath,
    saveDocument,
    saveDocumentAs,
    quitApp,
    recentFiles,
  ]);

  // Confirm before closing the window when any document has unsaved changes.
  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onCloseRequested(
      async (event) => {
        const anyDirty = workspaceRef.current.documents.some(isDirty);
        if (anyDirty && !(await confirmDiscardChanges())) {
          event.preventDefault();
        }
      }
    );
    return () => {
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, []);

  // Files opened from Finder (file association) arrive as a pending path.
  useEffect(() => {
    const consumePending = async () => {
      const path = await takePendingOpenPath();
      if (path) {
        await openPath(path);
      }
    };
    const unlistenPromise = listen("markflow://open-file", () => {
      void consumePending();
    });
    void consumePending().catch(() => {});
    return () => {
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [openPath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "n" && !event.shiftKey) {
        event.preventDefault();
        void newDocument();
      } else if (key === "o" && !event.shiftKey) {
        event.preventDefault();
        void openDocument();
      } else if (key === "s" && event.shiftKey) {
        event.preventDefault();
        void saveDocumentAs();
      } else if (key === "s") {
        event.preventDefault();
        void saveDocument();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [newDocument, openDocument, saveDocument, saveDocumentAs]);

  return (
    <AppShell
      sidebar={<Sidebar headings={headings} />}
      statusBar={<StatusBar document={active} />}
      onNew={newDocument}
      onOpen={openDocument}
      onSave={saveDocument}
      onSaveAs={saveDocumentAs}
    >
      <MarkdownEditor
        value={activeText}
        onChange={handleChange}
        imageBaseDir={active?.path ? dirname(active.path) : null}
      />
    </AppShell>
  );
}
