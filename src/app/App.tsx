import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { openSearchPanel } from "@codemirror/search";
import type { EditorState, TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { AppShell } from "./AppShell";
import { setupAppMenu } from "./menu";
import {
  commandForKeyEvent,
  createCommands,
  type CommandHandlers,
} from "./commands";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { Sidebar } from "../editor/ui/Sidebar";
import { StatusBar } from "../editor/ui/StatusBar";
import { TabsBar } from "../editor/ui/TabsBar";
import { parseHeadings } from "../editor/parser/parseHeadings";
import { dirname } from "../editor/parser/parseImages";
import {
  insertLink as insertLinkSpec,
  toggleInlineMarker,
  toggleLinePrefix,
  toggleOrderedList,
  wrapCodeBlock,
} from "../editor/commands/formatting";
import {
  activateDocument,
  activeDocument,
  addDocuments,
  createWorkspace,
  findDocumentByCanonicalPath,
  isDirty,
  markDocumentSaved,
  newUntitledDocument,
  setDropActive,
  toggleFocusMode,
  toggleOutline,
  toggleSidebar,
  toggleTypewriterMode,
  updateDocumentText,
  windowTitle,
  type DocumentId,
  type NewDocumentInput,
  type WorkspaceState,
} from "../editor/store/workspaceStore";
import {
  applyCloseDecision,
  planClose,
  type CloseIntent,
} from "../editor/store/closeFlow";
import {
  confirmDiscardChanges,
  copyTextToClipboard,
  getRecentFiles,
  pickMarkdownPaths,
  readMarkdownFiles,
  recordRecentFile,
  revealInFinder,
  saveMarkdownDocument,
  saveMarkdownDocumentAs,
  showInfo,
  showOpenProblems,
  takePendingOpenPath,
  type ReadMarkdownFilesResult,
} from "../editor/tauri/fileApi";
import { planOpenPaths } from "../editor/files/openPipeline";
import { splitDroppedPaths } from "../editor/files/dropClassification";

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() =>
    newUntitledDocument(createWorkspace())
  );
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const viewRef = useRef<EditorView | null>(null);

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

  const handleChange = useCallback((text: string) => {
    setWorkspace((ws) =>
      ws.activeDocumentId === null
        ? ws
        : updateDocumentText(ws, ws.activeDocumentId, text)
    );
  }, []);

  const newDocument = useCallback(async () => {
    setWorkspace((ws) => newUntitledDocument(ws));
  }, []);

  // The single pipeline behind Open dialog, Open Recent, Finder open, and
  // drag-and-drop: classify paths, read new ones in one batch, activate
  // the last relevant document, and surface per-file problems.
  const openPaths = useCallback(
    async (paths: string[]) => {
      const plan = planOpenPaths(workspaceRef.current, paths);
      let result: ReadMarkdownFilesResult = { files: [], errors: [] };
      if (plan.toRead.length > 0) {
        result = await readMarkdownFiles(plan.toRead);
      }

      const fileByRequested = new Map(
        result.files.map((file) => [file.requestedPath, file])
      );
      let lastRelevant:
        | { kind: "path"; path: string }
        | { kind: "id"; id: string }
        | null = null;
      const inputs: NewDocumentInput[] = [];
      for (const entry of plan.entries) {
        if (entry.kind === "read") {
          const file = fileByRequested.get(entry.path);
          if (file) {
            inputs.push({
              path: file.path,
              text: file.contents,
              fileMtimeMs: file.mtimeMs,
            });
            lastRelevant = { kind: "path", path: file.path };
          }
        } else if (entry.kind === "already-open") {
          lastRelevant = { kind: "id", id: entry.id };
        }
      }

      setWorkspace((ws) => {
        let next = inputs.length > 0 ? addDocuments(ws, inputs) : ws;
        if (lastRelevant?.kind === "id") {
          next = activateDocument(next, lastRelevant.id);
        } else if (lastRelevant?.kind === "path") {
          const doc = findDocumentByCanonicalPath(next, lastRelevant.path);
          if (doc) {
            next = activateDocument(next, doc.id);
          }
        }
        return next;
      });

      for (const file of result.files) {
        void noteRecent(file.path);
      }

      const problems = [
        ...plan.unsupported.map((path) => `${path}: unsupported file type`),
        ...result.errors.map((error) => `${error.path}: ${error.message}`),
      ];
      if (problems.length > 0) {
        await showOpenProblems(problems).catch(() => {});
      }
    },
    [noteRecent]
  );

  const openDocuments = useCallback(async () => {
    const paths = await pickMarkdownPaths();
    if (paths.length > 0) {
      await openPaths(paths);
    }
  }, [openPaths]);

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

  const saveAllDocuments = useCallback(async () => {
    const ws = workspaceRef.current;
    for (const doc of ws.documents.filter(isDirty)) {
      if (doc.path !== null) {
        await saveMarkdownDocument(doc.path, doc.text);
        setWorkspace((current) =>
          markDocumentSaved(current, doc.id, doc.path!, doc.text)
        );
      } else if (doc.id === ws.activeDocumentId) {
        // Untitled documents need a dialog; only prompt for the active one.
        await saveDocumentAs();
      }
    }
  }, [saveDocumentAs]);

  // All close paths (tab close button, middle click, Cmd+W, menu) go
  // through the close flow; the UI never removes documents directly. The
  // first version maps the confirmation dialog onto discard/cancel.
  const closeWithIntent = useCallback(async (intent: CloseIntent) => {
    const plan = planClose(workspaceRef.current, intent);
    if (plan.targets.length === 0) {
      return;
    }
    if (plan.dirtyTargets.length > 0 && !(await confirmDiscardChanges())) {
      return;
    }
    setWorkspace((ws) => {
      const next = applyCloseDecision(ws, plan, "discard");
      // The editor always shows a document, so closing the last tab
      // immediately opens a fresh untitled one.
      return next.documents.length === 0 ? newUntitledDocument(next) : next;
    });
  }, []);

  const closeTab = useCallback(
    (id: DocumentId) => {
      void closeWithIntent({ type: "single", documentId: id });
    },
    [closeWithIntent]
  );

  const activateTab = useCallback((id: DocumentId) => {
    setWorkspace((ws) => activateDocument(ws, id));
  }, []);

  const switchTabBy = useCallback((offset: number) => {
    setWorkspace((ws) => {
      if (ws.documents.length < 2 || ws.activeDocumentId === null) {
        return ws;
      }
      const index = ws.documents.findIndex(
        (doc) => doc.id === ws.activeDocumentId
      );
      const nextIndex =
        (index + offset + ws.documents.length) % ws.documents.length;
      return activateDocument(ws, ws.documents[nextIndex].id);
    });
  }, []);

  const openPath = useCallback(
    async (path: string) => {
      await openPaths([path]);
    },
    [openPaths]
  );

  const quitApp = useCallback(() => {
    // Route quit through the window close so the unsaved-changes
    // confirmation in onCloseRequested applies to Cmd+Q as well.
    void getCurrentWindow().close();
  }, []);

  const withEditor = useCallback(
    (makeSpec: (state: EditorState) => TransactionSpec) => {
      const view = viewRef.current;
      if (!view) {
        return;
      }
      view.dispatch(makeSpec(view.state));
      view.focus();
    },
    []
  );

  // Every user-facing action lives in the command registry; the menu,
  // keyboard shortcuts, and toolbar all run the same entries.
  const commandHandlers: CommandHandlers = useMemo(
    () => ({
      newDocument: () => void newDocument(),
      openDocuments: () => void openDocuments(),
      saveDocument: () => void saveDocument(),
      saveDocumentAs: () => void saveDocumentAs(),
      saveAllDocuments: () => void saveAllDocuments(),
      closeActiveDocument: () => {
        const activeId = workspaceRef.current.activeDocumentId;
        if (activeId !== null) {
          closeTab(activeId);
        }
      },
      closeOtherDocuments: () => {
        const activeId = workspaceRef.current.activeDocumentId;
        if (activeId !== null) {
          void closeWithIntent({ type: "others", exceptDocumentId: activeId });
        }
      },
      revealInFinder: () => {
        const path = activeDocument(workspaceRef.current)?.path;
        if (path) {
          void revealInFinder(path).catch(() => {});
        }
      },
      copyFilePath: () => {
        const path = activeDocument(workspaceRef.current)?.path;
        if (path) {
          void copyTextToClipboard(path).catch(() => {});
        }
      },
      toggleSidebar: () => setWorkspace(toggleSidebar),
      toggleOutline: () => setWorkspace(toggleOutline),
      toggleFocusMode: () => setWorkspace(toggleFocusMode),
      toggleTypewriterMode: () => setWorkspace(toggleTypewriterMode),
      toggleBold: () => withEditor((state) => toggleInlineMarker(state, "**")),
      toggleItalic: () => withEditor((state) => toggleInlineMarker(state, "*")),
      toggleInlineCode: () =>
        withEditor((state) => toggleInlineMarker(state, "`")),
      insertLink: () => withEditor(insertLinkSpec),
      insertCodeBlock: () => withEditor(wrapCodeBlock),
      insertQuote: () => withEditor((state) => toggleLinePrefix(state, "> ")),
      insertOrderedList: () => withEditor(toggleOrderedList),
      insertUnorderedList: () =>
        withEditor((state) => toggleLinePrefix(state, "- ")),
      insertTaskList: () =>
        withEditor((state) => toggleLinePrefix(state, "- [ ] ")),
      find: () => {
        if (viewRef.current) {
          openSearchPanel(viewRef.current);
        }
      },
      replace: () => {
        // CodeMirror's search panel includes the replace controls.
        if (viewRef.current) {
          openSearchPanel(viewRef.current);
        }
      },
      openSettings: () =>
        void showInfo("Settings will arrive in a future update.").catch(
          () => {}
        ),
    }),
    [
      newDocument,
      openDocuments,
      saveDocument,
      saveDocumentAs,
      saveAllDocuments,
      closeTab,
      closeWithIntent,
      withEditor,
    ]
  );

  const commands = useMemo(
    () => createCommands(commandHandlers),
    [commandHandlers]
  );

  // Load the persisted recent-files list once at startup.
  useEffect(() => {
    getRecentFiles()
      .then(setRecentFiles)
      .catch(() => {});
  }, []);

  // Rebuild the native menu only when something that affects it changes
  // (enabled states or the recent list), not on every keystroke.
  const menuSignature = JSON.stringify({
    hasActive: active !== null,
    hasPath: active?.path != null,
    anyDirty: workspace.documents.some(isDirty),
    multi: workspace.documents.length > 1,
    recentFiles,
  });
  useEffect(() => {
    void setupAppMenu(commands, workspaceRef.current, recentFiles, {
      onOpenRecent: (path) =>
        void openPath(path).catch(() => {
          // The file may have been moved or deleted since it was recorded.
        }),
      onQuit: quitApp,
    }).catch(() => {
      // Outside Tauri there is no native menu.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuSignature, commands, openPath, quitApp]);

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

  // Finder drag-and-drop. Markdown files flow into openPaths (same
  // pipeline as the Open dialog); everything else is reported.
  const handleDrop = useCallback(
    async (paths: string[]) => {
      const { markdownPaths, problems } = splitDroppedPaths(paths);
      if (markdownPaths.length > 0) {
        await openPaths(markdownPaths);
      }
      if (problems.length > 0) {
        await showOpenProblems(problems).catch(() => {});
      }
    },
    [openPaths]
  );

  useEffect(() => {
    const unlistenPromise = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setWorkspace((ws) => setDropActive(ws, true));
      } else if (event.payload.type === "drop") {
        setWorkspace((ws) => setDropActive(ws, false));
        void handleDrop(event.payload.paths);
      } else {
        setWorkspace((ws) => setDropActive(ws, false));
      }
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [handleDrop]);

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
      if (!event.metaKey || event.ctrlKey) {
        return;
      }
      // Tab navigation is workspace plumbing rather than a user command,
      // so it is handled outside the registry.
      if (event.shiftKey && !event.altKey && event.code === "BracketLeft") {
        event.preventDefault();
        switchTabBy(-1);
        return;
      }
      if (event.shiftKey && !event.altKey && event.code === "BracketRight") {
        event.preventDefault();
        switchTabBy(1);
        return;
      }
      if (!event.shiftKey && !event.altKey && /^[1-9]$/.test(event.key)) {
        const docs = workspaceRef.current.documents;
        const index = Number(event.key) - 1;
        if (index < docs.length) {
          event.preventDefault();
          activateTab(docs[index].id);
        }
        return;
      }
      const command = commandForKeyEvent(commands, event);
      if (command && command.enabled(workspaceRef.current)) {
        event.preventDefault();
        void command.run();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [commands, activateTab, switchTabBy]);

  const tabsBar = (
    <TabsBar
      documents={workspace.documents}
      activeDocumentId={workspace.activeDocumentId}
      onActivate={activateTab}
      onClose={closeTab}
    />
  );

  return (
    <AppShell
      focusMode={workspace.focusMode}
      tabsBar={tabsBar}
      sidebar={
        workspace.sidebarVisible ? (
          <Sidebar
            headings={headings}
            outlineVisible={workspace.outlineVisible}
          />
        ) : null
      }
      statusBar={<StatusBar document={active} />}
      onNew={commandHandlers.newDocument}
      onOpen={commandHandlers.openDocuments}
      onSave={commandHandlers.saveDocument}
      onSaveAs={commandHandlers.saveDocumentAs}
    >
      <MarkdownEditor
        value={activeText}
        onChange={handleChange}
        imageBaseDir={active?.path ? dirname(active.path) : null}
        typewriterMode={workspace.typewriterMode}
        onViewReady={(view) => {
          viewRef.current = view;
        }}
      />
      {workspace.dropActive && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay-text">Drop Markdown files to open</div>
        </div>
      )}
    </AppShell>
  );
}
