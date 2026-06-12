export type DocumentId = string;
export type PaneId = string;
export type SplitId = string;

export type DocumentKind = "file" | "untitled";
export type SplitDirection = "horizontal" | "vertical";

export type DocumentSelection = {
  anchor: number;
  head: number;
};

export type ExternalChangeState =
  | "clean"
  | "changed-on-disk"
  | "deleted-on-disk"
  | "conflict";

export type OpenDocument = {
  id: DocumentId;
  kind: DocumentKind;
  path: string | null;
  title: string;
  text: string;
  lastSavedText: string;
  encoding: "utf-8";
  lineEnding: "lf" | "crlf";
  selection: DocumentSelection | null;
  scrollTop: number;
  openedAt: number;
  lastActivatedAt: number;
  externalVersion: number;
  externalState: ExternalChangeState;
  fileMtimeMs: number | null;
  isSaving: boolean;
  isLoading: boolean;
  lastError: string | null;
};

export type EditorPane = {
  id: PaneId;
  documentIds: DocumentId[];
  activeDocumentId: DocumentId | null;
};

export type LayoutNode =
  | { type: "pane"; paneId: PaneId }
  | {
      type: "split";
      id: SplitId;
      direction: SplitDirection;
      ratio: number;
      first: LayoutNode;
      second: LayoutNode;
    };

export type WorkspaceState = {
  documents: OpenDocument[];
  panes: EditorPane[];
  activePaneId: PaneId;
  layout: LayoutNode;
  sidebarVisible: boolean;
  outlineVisible: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  dropActive: boolean;
};

const ROOT_PANE_ID = "pane-root";

export function createWorkspace(): WorkspaceState {
  return {
    documents: [],
    panes: [{ id: ROOT_PANE_ID, documentIds: [], activeDocumentId: null }],
    activePaneId: ROOT_PANE_ID,
    layout: { type: "pane", paneId: ROOT_PANE_ID },
    sidebarVisible: true,
    outlineVisible: true,
    focusMode: false,
    typewriterMode: false,
    dropActive: false,
  };
}

// Dirty state is always derived so it can never drift from the text.
export function isDirty(doc: OpenDocument): boolean {
  return doc.text !== doc.lastSavedText;
}

export function titleFromPath(path: string | null): string {
  if (path === null) {
    return "Untitled";
  }
  const segments = path.split("/");
  return segments[segments.length - 1] || "Untitled";
}

export function detectLineEnding(text: string): "lf" | "crlf" {
  return text.includes("\r\n") ? "crlf" : "lf";
}

export function activePane(state: WorkspaceState): EditorPane | null {
  return (
    state.panes.find((pane) => pane.id === state.activePaneId) ??
    state.panes[0] ??
    null
  );
}

export function activeDocumentId(state: WorkspaceState): DocumentId | null {
  return activePane(state)?.activeDocumentId ?? null;
}

export function activeDocument(state: WorkspaceState): OpenDocument | null {
  const id = activeDocumentId(state);
  if (id === null) {
    return null;
  }
  return state.documents.find((doc) => doc.id === id) ?? null;
}

export function paneDocuments(
  state: WorkspaceState,
  paneId: PaneId
): OpenDocument[] {
  const pane = state.panes.find((entry) => entry.id === paneId);
  if (!pane) {
    return [];
  }
  return pane.documentIds
    .map((id) => state.documents.find((doc) => doc.id === id))
    .filter((doc): doc is OpenDocument => doc !== undefined);
}

export function findDocumentByCanonicalPath(
  state: WorkspaceState,
  path: string
): OpenDocument | undefined {
  return state.documents.find((doc) => doc.path !== null && doc.path === path);
}

export function windowTitle(doc: OpenDocument | null): string {
  if (!doc) {
    return "Quillora";
  }
  return `${isDirty(doc) ? "• " : ""}${doc.title} — Quillora`;
}

function generateDocumentId(): DocumentId {
  return `doc-${crypto.randomUUID()}`;
}

function generatePaneId(): PaneId {
  return `pane-${crypto.randomUUID()}`;
}

function generateSplitId(): SplitId {
  return `split-${crypto.randomUUID()}`;
}

function clampRatio(ratio: number): number {
  return Math.min(0.85, Math.max(0.15, ratio));
}

function uniqueDocumentIds(ids: DocumentId[]): DocumentId[] {
  return Array.from(new Set(ids));
}

function baseDocument(id: DocumentId, now: number): OpenDocument {
  return {
    id,
    kind: "untitled",
    path: null,
    title: "Untitled",
    text: "",
    lastSavedText: "",
    encoding: "utf-8",
    lineEnding: "lf",
    selection: null,
    scrollTop: 0,
    openedAt: now,
    lastActivatedAt: now,
    externalVersion: 0,
    externalState: "clean",
    fileMtimeMs: null,
    isSaving: false,
    isLoading: false,
    lastError: null,
  };
}

function updatePane(
  state: WorkspaceState,
  paneId: PaneId,
  patch: (pane: EditorPane) => EditorPane
): WorkspaceState {
  if (!state.panes.some((pane) => pane.id === paneId)) {
    return state;
  }
  return {
    ...state,
    panes: state.panes.map((pane) => (pane.id === paneId ? patch(pane) : pane)),
  };
}

function withDocumentInPane(
  pane: EditorPane,
  documentId: DocumentId,
  index: number = pane.documentIds.length
): EditorPane {
  const withoutDuplicate = pane.documentIds.filter((id) => id !== documentId);
  const nextIndex = Math.min(Math.max(index, 0), withoutDuplicate.length);
  const documentIds = [
    ...withoutDuplicate.slice(0, nextIndex),
    documentId,
    ...withoutDuplicate.slice(nextIndex),
  ];
  return { ...pane, documentIds, activeDocumentId: documentId };
}

function fallbackActiveId(
  documentIds: DocumentId[],
  oldIds: DocumentId[],
  removedId: DocumentId
): DocumentId | null {
  const oldIndex = oldIds.indexOf(removedId);
  if (oldIndex >= 0) {
    const next = oldIds
      .slice(oldIndex + 1)
      .find((id) => documentIds.includes(id));
    if (next) {
      return next;
    }
  }
  return documentIds[documentIds.length - 1] ?? null;
}

function removePaneFromLayout(
  node: LayoutNode,
  paneId: PaneId
): LayoutNode | null {
  if (node.type === "pane") {
    return node.paneId === paneId ? null : node;
  }
  const first = removePaneFromLayout(node.first, paneId);
  const second = removePaneFromLayout(node.second, paneId);
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }
  return { ...node, first, second };
}

function replacePaneInLayout(
  node: LayoutNode,
  paneId: PaneId,
  replacement: LayoutNode
): LayoutNode {
  if (node.type === "pane") {
    return node.paneId === paneId ? replacement : node;
  }
  return {
    ...node,
    first: replacePaneInLayout(node.first, paneId, replacement),
    second: replacePaneInLayout(node.second, paneId, replacement),
  };
}

function updateLayoutRatio(
  node: LayoutNode,
  splitId: SplitId,
  ratio: number
): LayoutNode {
  if (node.type === "pane") {
    return node;
  }
  if (node.id === splitId) {
    return { ...node, ratio: clampRatio(ratio) };
  }
  return {
    ...node,
    first: updateLayoutRatio(node.first, splitId, ratio),
    second: updateLayoutRatio(node.second, splitId, ratio),
  };
}

function referencedDocumentIds(panes: EditorPane[]): Set<DocumentId> {
  return new Set(panes.flatMap((pane) => pane.documentIds));
}

export type CreateDocumentOptions = {
  id?: DocumentId;
  now?: number;
  // Restored unsaved content; the document starts dirty so it is never
  // silently lost.
  text?: string;
};

export function newUntitledDocument(
  state: WorkspaceState,
  options: CreateDocumentOptions = {}
): WorkspaceState {
  const id = options.id ?? generateDocumentId();
  const now = options.now ?? Date.now();
  const doc = baseDocument(id, now);
  const withDocument = {
    ...state,
    documents: [
      ...state.documents,
      options.text ? { ...doc, text: options.text } : doc,
    ],
  };
  return activateDocumentInPane(withDocument, state.activePaneId, id, now);
}

export type NewDocumentInput = {
  path: string;
  text: string;
  fileMtimeMs?: number | null;
  id?: DocumentId;
};

// Adds file-backed documents to the active pane, skipping paths that are
// already open globally. The last relevant document becomes active.
export function addDocuments(
  state: WorkspaceState,
  inputs: NewDocumentInput[],
  options: { now?: number } = {}
): WorkspaceState {
  const now = options.now ?? Date.now();
  let next: WorkspaceState = state;
  let lastRelevantId: DocumentId | null = null;

  for (const input of inputs) {
    const existing = next.documents.find(
      (doc) => doc.path !== null && doc.path === input.path
    );
    if (existing) {
      lastRelevantId = existing.id;
      next = activateDocumentInPane(next, next.activePaneId, existing.id, now);
      continue;
    }
    const id = input.id ?? generateDocumentId();
    next = {
      ...next,
      documents: [
        ...next.documents,
        {
          ...baseDocument(id, now),
          kind: "file",
          path: input.path,
          title: titleFromPath(input.path),
          text: input.text,
          lastSavedText: input.text,
          lineEnding: detectLineEnding(input.text),
          fileMtimeMs: input.fileMtimeMs ?? null,
        },
      ],
    };
    lastRelevantId = id;
    next = activateDocumentInPane(next, next.activePaneId, id, now);
  }

  return lastRelevantId === null ? state : next;
}

export function activatePane(
  state: WorkspaceState,
  paneId: PaneId
): WorkspaceState {
  if (!state.panes.some((pane) => pane.id === paneId)) {
    return state;
  }
  return state.activePaneId === paneId ? state : { ...state, activePaneId: paneId };
}

export function activateDocumentInPane(
  state: WorkspaceState,
  paneId: PaneId,
  id: DocumentId,
  now: number = Date.now()
): WorkspaceState {
  if (!state.documents.some((doc) => doc.id === id)) {
    return state;
  }
  const withActivePane = activatePane(state, paneId);
  return {
    ...updatePane(withActivePane, paneId, (pane) => withDocumentInPane(pane, id)),
    documents: withActivePane.documents.map((doc) =>
      doc.id === id ? { ...doc, lastActivatedAt: now } : doc
    ),
  };
}

export function activateDocument(
  state: WorkspaceState,
  id: DocumentId,
  now: number = Date.now()
): WorkspaceState {
  return activateDocumentInPane(state, state.activePaneId, id, now);
}

function updateDocument(
  state: WorkspaceState,
  id: DocumentId,
  patch: (doc: OpenDocument) => OpenDocument
): WorkspaceState {
  if (!state.documents.some((doc) => doc.id === id)) {
    return state;
  }
  return {
    ...state,
    documents: state.documents.map((doc) =>
      doc.id === id ? patch(doc) : doc
    ),
  };
}

export function updateDocumentText(
  state: WorkspaceState,
  id: DocumentId,
  text: string
): WorkspaceState {
  return updateDocument(state, id, (doc) => ({ ...doc, text }));
}

export function updateDocumentSelection(
  state: WorkspaceState,
  id: DocumentId,
  selection: DocumentSelection | null
): WorkspaceState {
  return updateDocument(state, id, (doc) => ({ ...doc, selection }));
}

export function updateDocumentScroll(
  state: WorkspaceState,
  id: DocumentId,
  scrollTop: number
): WorkspaceState {
  return updateDocument(state, id, (doc) => ({ ...doc, scrollTop }));
}

export function markDocumentSaved(
  state: WorkspaceState,
  id: DocumentId,
  path: string,
  text: string,
  fileMtimeMs?: number | null
): WorkspaceState {
  return updateDocument(state, id, (doc) => ({
    ...doc,
    kind: "file",
    path,
    title: titleFromPath(path),
    text,
    lastSavedText: text,
    fileMtimeMs: fileMtimeMs ?? doc.fileMtimeMs,
    externalState: "clean",
    isSaving: false,
    lastError: null,
  }));
}

export type DiskStat = {
  path: string;
  // null means the file no longer exists on disk.
  mtimeMs: number | null;
};

export function externalChangeState(
  doc: OpenDocument,
  diskMtimeMs: number | null
): ExternalChangeState {
  if (doc.path === null) {
    return "clean";
  }
  if (diskMtimeMs === null) {
    return "deleted-on-disk";
  }
  if (doc.fileMtimeMs !== null && diskMtimeMs > doc.fileMtimeMs) {
    return isDirty(doc) ? "conflict" : "changed-on-disk";
  }
  return "clean";
}

export function applyDiskStates(
  state: WorkspaceState,
  stats: DiskStat[]
): WorkspaceState {
  const statByPath = new Map(stats.map((stat) => [stat.path, stat]));
  return {
    ...state,
    documents: state.documents.map((doc) => {
      if (doc.path === null) {
        return doc;
      }
      const stat = statByPath.get(doc.path);
      if (!stat) {
        return doc;
      }
      const next = externalChangeState(doc, stat.mtimeMs);
      return next === doc.externalState
        ? doc
        : { ...doc, externalState: next };
    }),
  };
}

export function reloadDocumentFromDisk(
  state: WorkspaceState,
  id: DocumentId,
  text: string,
  fileMtimeMs: number | null
): WorkspaceState {
  return updateDocument(state, id, (doc) => ({
    ...doc,
    text,
    lastSavedText: text,
    fileMtimeMs,
    externalState: "clean",
    externalVersion: doc.externalVersion + 1,
  }));
}

export function toggleSidebar(state: WorkspaceState): WorkspaceState {
  return { ...state, sidebarVisible: !state.sidebarVisible };
}

export function toggleOutline(state: WorkspaceState): WorkspaceState {
  return { ...state, outlineVisible: !state.outlineVisible };
}

export function toggleFocusMode(state: WorkspaceState): WorkspaceState {
  return { ...state, focusMode: !state.focusMode };
}

export function toggleTypewriterMode(state: WorkspaceState): WorkspaceState {
  return { ...state, typewriterMode: !state.typewriterMode };
}

// Idempotent so repeated drag "over" events do not cause re-renders.
export function setDropActive(
  state: WorkspaceState,
  dropActive: boolean
): WorkspaceState {
  return state.dropActive === dropActive ? state : { ...state, dropActive };
}

function splitPane(
  state: WorkspaceState,
  direction: SplitDirection,
  paneId: PaneId = state.activePaneId
): WorkspaceState {
  const pane = state.panes.find((entry) => entry.id === paneId);
  if (!pane) {
    return state;
  }
  const newPaneId = generatePaneId();
  const activeId = pane.activeDocumentId;
  const newPane: EditorPane = {
    id: newPaneId,
    documentIds: activeId ? [activeId] : [],
    activeDocumentId: activeId,
  };
  const replacement: LayoutNode = {
    type: "split",
    id: generateSplitId(),
    direction,
    ratio: 0.5,
    first: { type: "pane", paneId },
    second: { type: "pane", paneId: newPaneId },
  };
  return normalizeLayout({
    ...state,
    panes: [...state.panes, newPane],
    activePaneId: newPaneId,
    layout: replacePaneInLayout(state.layout, paneId, replacement),
  });
}

export function splitPaneHorizontal(
  state: WorkspaceState,
  paneId: PaneId = state.activePaneId
): WorkspaceState {
  return splitPane(state, "horizontal", paneId);
}

export function splitPaneVertical(
  state: WorkspaceState,
  paneId: PaneId = state.activePaneId
): WorkspaceState {
  return splitPane(state, "vertical", paneId);
}

// Splits the pane and MOVES the active document to the new pane (not duplicate).
export function splitPaneMovingDocument(
  state: WorkspaceState,
  paneId: PaneId,
  documentId: DocumentId,
  direction: SplitDirection
): WorkspaceState {
  const sourcePane = state.panes.find((p) => p.id === paneId);
  if (!sourcePane || !sourcePane.documentIds.includes(documentId)) {
    return state;
  }
  const newPaneId = generatePaneId();
  const newPane: EditorPane = {
    id: newPaneId,
    documentIds: [documentId],
    activeDocumentId: documentId,
  };
  const remainingIds = sourcePane.documentIds.filter((id) => id !== documentId);
  const updatedSource: EditorPane = {
    ...sourcePane,
    documentIds: remainingIds,
    activeDocumentId:
      sourcePane.activeDocumentId === documentId
        ? fallbackActiveId(remainingIds, sourcePane.documentIds, documentId)
        : sourcePane.activeDocumentId,
  };
  const replacement: LayoutNode = {
    type: "split",
    id: generateSplitId(),
    direction,
    ratio: 0.5,
    first: { type: "pane", paneId },
    second: { type: "pane", paneId: newPaneId },
  };
  const next: WorkspaceState = {
    ...state,
    panes: [...state.panes.map((p) => (p.id === paneId ? updatedSource : p)), newPane],
    activePaneId: newPaneId,
    layout: replacePaneInLayout(state.layout, paneId, replacement),
  };
  return normalizeLayout(removeEmptyPanes(next));
}

// Removes panes with zero documents, except when it's the last pane.
export function removeEmptyPanes(state: WorkspaceState): WorkspaceState {
  if (state.panes.length <= 1) {
    return state;
  }
  const emptyPaneIds = new Set(
    state.panes
      .filter((p) => p.documentIds.length === 0)
      .map((p) => p.id)
  );
  if (emptyPaneIds.size === 0) {
    return state;
  }
  // Keep at least one pane.
  const remainingPanes = state.panes.filter((p) => !emptyPaneIds.has(p.id));
  if (remainingPanes.length === 0) {
    return state;
  }

  let layout = state.layout;
  for (const paneId of emptyPaneIds) {
    layout = removePaneFromLayout(layout, paneId) ?? {
      type: "pane" as const,
      paneId: remainingPanes[0].id,
    };
  }

  return normalizeLayout({
    ...state,
    panes: remainingPanes,
    activePaneId: emptyPaneIds.has(state.activePaneId)
      ? remainingPanes[0].id
      : state.activePaneId,
    layout,
  });
}

export function moveDocumentToPane(
  state: WorkspaceState,
  documentId: DocumentId,
  targetPaneId: PaneId
): WorkspaceState {
  const sourcePaneId =
    state.panes.find((pane) => pane.id === state.activePaneId)?.documentIds.includes(documentId)
      ? state.activePaneId
      : state.panes.find((pane) => pane.documentIds.includes(documentId))?.id;
  if (!sourcePaneId) {
    return state;
  }
  const targetPane = state.panes.find((pane) => pane.id === targetPaneId);
  return moveDocumentToPaneAt(
    state,
    sourcePaneId,
    documentId,
    targetPaneId,
    targetPane?.documentIds.length ?? 0
  );
}

export function moveDocumentToPaneAt(
  state: WorkspaceState,
  sourcePaneId: PaneId,
  documentId: DocumentId,
  targetPaneId: PaneId,
  targetIndex: number
): WorkspaceState {
  if (
    sourcePaneId === targetPaneId ||
    !state.documents.some((doc) => doc.id === documentId)
  ) {
    return reorderDocumentInPane(state, targetPaneId, documentId, targetIndex);
  }
  const sourcePane = state.panes.find((pane) => pane.id === sourcePaneId);
  const targetPane = state.panes.find((pane) => pane.id === targetPaneId);
  if (
    !sourcePane ||
    !targetPane ||
    !sourcePane.documentIds.includes(documentId) ||
    targetPane.documentIds.includes(documentId)
  ) {
    return state;
  }
  return removeEmptyPanes(normalizeLayout({
    ...state,
    activePaneId: targetPaneId,
    panes: state.panes.map((pane) => {
      if (pane.id === sourcePaneId) {
        const nextIds = pane.documentIds.filter((id) => id !== documentId);
        return {
          ...pane,
          documentIds: nextIds,
          activeDocumentId:
            pane.activeDocumentId === documentId
              ? fallbackActiveId(nextIds, pane.documentIds, documentId)
              : pane.activeDocumentId,
        };
      }
      if (pane.id === targetPaneId) {
        return withDocumentInPane(pane, documentId, targetIndex);
      }
      return pane;
    }),
  }));
}

export function copyDocumentReferenceToPaneAt(
  state: WorkspaceState,
  documentId: DocumentId,
  targetPaneId: PaneId,
  targetIndex: number
): WorkspaceState {
  if (!state.documents.some((doc) => doc.id === documentId)) {
    return state;
  }
  const targetPane = state.panes.find((pane) => pane.id === targetPaneId);
  if (!targetPane || targetPane.documentIds.includes(documentId)) {
    return state;
  }
  return {
    ...updatePane(state, targetPaneId, (pane) =>
      withDocumentInPane(pane, documentId, targetIndex)
    ),
    activePaneId: targetPaneId,
  };
}

export function reorderDocumentInPane(
  state: WorkspaceState,
  paneId: PaneId,
  documentId: DocumentId,
  targetIndex: number
): WorkspaceState {
  const pane = state.panes.find((entry) => entry.id === paneId);
  if (!pane || !pane.documentIds.includes(documentId)) {
    return state;
  }
  return updatePane(state, paneId, (entry) =>
    withDocumentInPane(entry, documentId, targetIndex)
  );
}

export function closeDocumentInPane(
  state: WorkspaceState,
  paneId: PaneId,
  documentId: DocumentId
): WorkspaceState {
  const pane = state.panes.find((entry) => entry.id === paneId);
  if (!pane || !pane.documentIds.includes(documentId)) {
    return state;
  }
  const panes = state.panes.map((entry) => {
    if (entry.id !== paneId) {
      return entry;
    }
    const documentIds = entry.documentIds.filter((id) => id !== documentId);
    return {
      ...entry,
      documentIds,
      activeDocumentId:
        entry.activeDocumentId === documentId
          ? fallbackActiveId(documentIds, entry.documentIds, documentId)
          : entry.activeDocumentId,
    };
  });
  const stillReferenced = referencedDocumentIds(panes);
  return removeEmptyPanes(normalizeLayout({
    ...state,
    panes,
    documents: state.documents.filter((doc) => stillReferenced.has(doc.id)),
  }));
}

export function closePane(
  state: WorkspaceState,
  paneId: PaneId
): WorkspaceState {
  if (state.panes.length <= 1 || !state.panes.some((pane) => pane.id === paneId)) {
    return state;
  }
  const panes = state.panes.filter((pane) => pane.id !== paneId);
  const stillReferenced = referencedDocumentIds(panes);
  const layout = removePaneFromLayout(state.layout, paneId) ?? {
    type: "pane" as const,
    paneId: panes[0].id,
  };
  return normalizeLayout({
    ...state,
    panes,
    activePaneId:
      state.activePaneId === paneId ? panes[0].id : state.activePaneId,
    layout,
    documents: state.documents.filter((doc) => stillReferenced.has(doc.id)),
  });
}

export function updateSplitRatio(
  state: WorkspaceState,
  splitId: SplitId,
  ratio: number
): WorkspaceState {
  return { ...state, layout: updateLayoutRatio(state.layout, splitId, ratio) };
}

export function normalizeLayout(state: WorkspaceState): WorkspaceState {
  const documentIdSet = new Set(state.documents.map((doc) => doc.id));
  const cleanedPanes = state.panes.map((pane) => {
    const documentIds = uniqueDocumentIds(pane.documentIds).filter((id) =>
      documentIdSet.has(id)
    );
    const activeId =
      pane.activeDocumentId && documentIds.includes(pane.activeDocumentId)
        ? pane.activeDocumentId
        : documentIds[0] ?? null;
    return { ...pane, documentIds, activeDocumentId: activeId };
  });
  const panes =
    cleanedPanes.length > 0
      ? cleanedPanes
      : [{ id: ROOT_PANE_ID, documentIds: [], activeDocumentId: null }];
  const paneIds = new Set(panes.map((pane) => pane.id));

  const normalizeNode = (node: LayoutNode): LayoutNode | null => {
    if (node.type === "pane") {
      return paneIds.has(node.paneId) ? node : null;
    }
    const first = normalizeNode(node.first);
    const second = normalizeNode(node.second);
    if (!first) {
      return second;
    }
    if (!second) {
      return first;
    }
    return { ...node, ratio: clampRatio(node.ratio), first, second };
  };

  return {
    ...state,
    panes,
    activePaneId: paneIds.has(state.activePaneId)
      ? state.activePaneId
      : panes[0].id,
    layout: normalizeNode(state.layout) ?? { type: "pane", paneId: panes[0].id },
  };
}

export function removeDocuments(
  state: WorkspaceState,
  ids: DocumentId[]
): WorkspaceState {
  const removed = new Set(ids);
  const remaining = state.documents.filter((doc) => !removed.has(doc.id));
  return normalizeLayout({
    ...state,
    documents: remaining,
    panes: state.panes.map((pane) => {
      const oldIds = pane.documentIds;
      const documentIds = oldIds.filter((id) => !removed.has(id));
      const removedActive = pane.activeDocumentId
        ? removed.has(pane.activeDocumentId)
        : false;
      return {
        ...pane,
        documentIds,
        activeDocumentId:
          removedActive && pane.activeDocumentId
            ? fallbackActiveId(documentIds, oldIds, pane.activeDocumentId)
            : pane.activeDocumentId,
      };
    }),
  });
}
