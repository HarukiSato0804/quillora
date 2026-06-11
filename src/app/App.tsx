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
  createUntitledDocument,
  windowTitle,
  withOpenedFile,
  withSavedFile,
  withText,
  type DocumentState,
} from "../editor/store/documentStore";
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
  const [document, setDocument] = useState<DocumentState>(
    createUntitledDocument
  );
  const documentRef = useRef(document);
  documentRef.current = document;

  const [recentFiles, setRecentFiles] = useState<string[]>([]);

  const noteRecent = useCallback(async (path: string) => {
    try {
      setRecentFiles(await recordRecentFile(path));
    } catch {
      // Recent-files persistence is best-effort.
    }
  }, []);

  const headings = useMemo(() => parseHeadings(document.text), [document.text]);

  useEffect(() => {
    getCurrentWindow()
      .setTitle(windowTitle(document))
      .catch(() => {
        // Outside Tauri (e.g. plain vite dev) there is no native window.
      });
  }, [document.dirty, document.title]);

  const handleChange = useCallback((text: string) => {
    setDocument((current) => withText(current, text));
  }, []);

  const newDocument = useCallback(async () => {
    if (documentRef.current.dirty && !(await confirmDiscardChanges())) {
      return;
    }
    setDocument(createUntitledDocument());
  }, []);

  const openDocument = useCallback(async () => {
    if (documentRef.current.dirty && !(await confirmDiscardChanges())) {
      return;
    }
    const opened = await openMarkdownDocument();
    if (opened) {
      setDocument(withOpenedFile(opened.path, opened.contents));
      void noteRecent(opened.path);
    }
  }, [noteRecent]);

  const saveDocumentAs = useCallback(async () => {
    const current = documentRef.current;
    const path = await saveMarkdownDocumentAs(current.text);
    if (path) {
      setDocument(withSavedFile(current, path));
      void noteRecent(path);
    }
  }, [noteRecent]);

  const saveDocument = useCallback(async () => {
    const current = documentRef.current;
    if (current.path === null) {
      await saveDocumentAs();
      return;
    }
    await saveMarkdownDocument(current.path, current.text);
    setDocument(withSavedFile(current, current.path));
  }, [saveDocumentAs]);

  const openPath = useCallback(async (path: string) => {
    if (documentRef.current.dirty && !(await confirmDiscardChanges())) {
      return;
    }
    const contents = await readMarkdownPath(path);
    setDocument(withOpenedFile(path, contents));
    void noteRecent(path);
  }, [noteRecent]);

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

  // Confirm before closing the window with unsaved changes.
  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onCloseRequested(
      async (event) => {
        if (documentRef.current.dirty && !(await confirmDiscardChanges())) {
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
      statusBar={<StatusBar document={document} />}
      onNew={newDocument}
      onOpen={openDocument}
      onSave={saveDocument}
      onSaveAs={saveDocumentAs}
    >
      <MarkdownEditor
        value={document.text}
        onChange={handleChange}
        imageBaseDir={document.path ? dirname(document.path) : null}
      />
    </AppShell>
  );
}
