import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { openSearchPanel } from "@codemirror/search";
import type { EditorState, TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { AppShell } from "./AppShell";
import { QuitDialog } from "./QuitDialog";
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
  applyDiskStates,
  externalChangeState,
  isDirty,
  markDocumentSaved,
  newUntitledDocument,
  reloadDocumentFromDisk,
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
  buildRestoredWorkspace,
  isPersistedWorkspace,
  serializeWorkspace,
} from "../editor/store/sessionStore";
import {
  confirmDiscardChanges,
  confirmReloadFromDisk,
  copyTextToClipboard,
  getRecentFiles,
  loadSession,
  pickMarkdownPaths,
  readMarkdownFiles,
  recordRecentFile,
  revealInFinder,
  saveMarkdownDocument,
  saveMarkdownDocumentAs,
  saveSession,
  showInfo,
  showOpenProblems,
  statFiles,
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

  const saveDocumentAsFor = useCallback(
    async (id: DocumentId): Promise<boolean> => {
      const doc = workspaceRef.current.documents.find((d) => d.id === id);
      if (!doc) {
        return false;
      }
      const path = await saveMarkdownDocumentAs(doc.text);
      if (!path) {
        return false;
      }
      setWorkspace((ws) => markDocumentSaved(ws, doc.id, path, doc.text));
      void noteRecent(path);
      return true;
    },
    [noteRecent]
  );

  const saveDocumentAs = useCallback(async () => {
    const activeId = workspaceRef.current.activeDocumentId;
    if (activeId !== null) {
      await saveDocumentAsFor(activeId);
    }
  }, [saveDocumentAsFor]);

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

  // Saves every dirty document; untitled ones go through Save As dialogs
  // one by one. Returns false as soon as the user cancels a dialog.
  const saveAllDocuments = useCallback(async (): Promise<boolean> => {
    for (const doc of workspaceRef.current.documents.filter(isDirty)) {
      if (doc.path !== null) {
        await saveMarkdownDocument(doc.path, doc.text);
        setWorkspace((current) =>
          markDocumentSaved(current, doc.id, doc.path!, doc.text)
        );
      } else if (!(await saveDocumentAsFor(doc.id))) {
        return false;
      }
    }
    return true;
  }, [saveDocumentAsFor]);

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

  // Session restore: rebuild the previous workspace once at startup.
  // The restore only replaces a single pristine untitled document, so it
  // can never clobber content the user already typed or a file opened
  // from Finder before the session loaded.
  useEffect(() => {
    const restore = async () => {
      const json = await loadSession();
      if (!json) {
        return;
      }
      const persisted: unknown = JSON.parse(json);
      if (!isPersistedWorkspace(persisted)) {
        return;
      }
      const filePaths = persisted.openDocuments
        .map((doc) => doc.path)
        .filter((path): path is string => path !== null);
      const result: ReadMarkdownFilesResult =
        filePaths.length > 0
          ? await readMarkdownFiles(filePaths)
          : { files: [], errors: [] };

      setWorkspace((current) => {
        const pristine =
          current.documents.length === 1 &&
          current.documents[0].kind === "untitled" &&
          current.documents[0].text === "";
        if (!pristine) {
          return current;
        }
        return buildRestoredWorkspace(
          persisted,
          result.files.map((file) => ({
            path: file.path,
            text: file.contents,
            mtimeMs: file.mtimeMs,
          }))
        );
      });

      if (result.errors.length > 0) {
        await showOpenProblems(
          result.errors.map(
            (error) => `${error.path}: could not restore (${error.message})`
          )
        ).catch(() => {});
      }
    };
    void restore().catch(() => {});
  }, []);

  // Persist the session whenever the workspace settles for a moment.
  useEffect(() => {
    const timer = setTimeout(() => {
      void saveSession(
        JSON.stringify(serializeWorkspace(workspaceRef.current))
      ).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [workspace]);

  // External change polling (every 5s and on window focus). Clean
  // documents reload automatically; dirty ones prompt once per conflict.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ws = workspaceRef.current;
      const paths = ws.documents
        .map((doc) => doc.path)
        .filter((path): path is string => path !== null);
      if (paths.length === 0) {
        return;
      }
      let stats;
      try {
        stats = await statFiles(paths);
      } catch {
        // Stat errors must never crash the app; try again next cycle.
        return;
      }
      if (cancelled) {
        return;
      }

      const current = workspaceRef.current;
      const statByPath = new Map(stats.map((stat) => [stat.path, stat]));
      const reloadPaths: string[] = [];
      const conflicts: Array<{ id: DocumentId; path: string; title: string }> =
        [];
      for (const doc of current.documents) {
        if (doc.path === null) {
          continue;
        }
        const stat = statByPath.get(doc.path);
        if (!stat) {
          continue;
        }
        const nextState = externalChangeState(doc, stat.mtimeMs);
        if (nextState === "changed-on-disk") {
          reloadPaths.push(doc.path);
        } else if (
          nextState === "conflict" &&
          doc.externalState !== "conflict"
        ) {
          conflicts.push({ id: doc.id, path: doc.path, title: doc.title });
        }
      }

      setWorkspace((ws2) => applyDiskStates(ws2, stats));

      if (reloadPaths.length > 0) {
        const result = await readMarkdownFiles(reloadPaths);
        if (cancelled) {
          return;
        }
        setWorkspace((ws2) => {
          let next = ws2;
          for (const file of result.files) {
            const doc = findDocumentByCanonicalPath(next, file.path);
            if (doc && !isDirty(doc)) {
              next = reloadDocumentFromDisk(
                next,
                doc.id,
                file.contents,
                file.mtimeMs
              );
            }
          }
          return next;
        });
      }

      for (const conflict of conflicts) {
        const reload = await confirmReloadFromDisk(conflict.title).catch(
          () => false
        );
        if (cancelled) {
          return;
        }
        if (reload) {
          const result = await readMarkdownFiles([conflict.path]);
          const file = result.files[0];
          if (file) {
            setWorkspace((ws2) =>
              reloadDocumentFromDisk(ws2, conflict.id, file.contents, file.mtimeMs)
            );
          }
        }
      }
    };

    const interval = setInterval(() => void check(), 5_000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
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

  // Window close (red traffic light, Cmd+Q, File > Quit — quitApp routes
  // them all through window.close()). With unsaved changes the close is
  // prevented and an in-window Save / Don't Save / Cancel dialog takes
  // over; a clean workspace closes immediately.
  const [quitDialogOpen, setQuitDialogOpen] = useState(false);

  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onCloseRequested((event) => {
      if (workspaceRef.current.documents.some(isDirty)) {
        event.preventDefault();
        setQuitDialogOpen(true);
      }
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, []);

  const quitNow = useCallback(() => {
    void getCurrentWindow()
      .destroy()
      .catch(() => {});
  }, []);

  const saveAllAndQuit = useCallback(async () => {
    if (await saveAllDocuments()) {
      quitNow();
    } else {
      // The user cancelled one of the Save As dialogs; stay open.
      setQuitDialogOpen(false);
    }
  }, [saveAllDocuments, quitNow]);

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
      {quitDialogOpen && (
        <QuitDialog
          dirtyCount={workspace.documents.filter(isDirty).length}
          onSaveAndQuit={() => void saveAllAndQuit()}
          onQuitWithoutSaving={quitNow}
          onCancel={() => setQuitDialogOpen(false)}
        />
      )}
    </AppShell>
  );
}
