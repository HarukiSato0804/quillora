export type DocumentId = string;

export type DocumentKind = "file" | "untitled";

export type DocumentSelection = {
  anchor: number;
  head: number;
};

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
  fileMtimeMs: number | null;
  isSaving: boolean;
  isLoading: boolean;
  lastError: string | null;
};

export type WorkspaceState = {
  documents: OpenDocument[];
  activeDocumentId: DocumentId | null;
  sidebarVisible: boolean;
  outlineVisible: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  dropActive: boolean;
};

export function createWorkspace(): WorkspaceState {
  return {
    documents: [],
    activeDocumentId: null,
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

export function activeDocument(state: WorkspaceState): OpenDocument | null {
  if (state.activeDocumentId === null) {
    return null;
  }
  return (
    state.documents.find((doc) => doc.id === state.activeDocumentId) ?? null
  );
}

export function findDocumentByCanonicalPath(
  state: WorkspaceState,
  path: string
): OpenDocument | undefined {
  return state.documents.find((doc) => doc.path !== null && doc.path === path);
}

export function windowTitle(doc: OpenDocument | null): string {
  if (!doc) {
    return "Markflow";
  }
  return `${isDirty(doc) ? "• " : ""}${doc.title} — Markflow`;
}

function generateId(): DocumentId {
  return `doc-${crypto.randomUUID()}`;
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
    fileMtimeMs: null,
    isSaving: false,
    isLoading: false,
    lastError: null,
  };
}

export type CreateDocumentOptions = {
  id?: DocumentId;
  now?: number;
};

export function newUntitledDocument(
  state: WorkspaceState,
  options: CreateDocumentOptions = {}
): WorkspaceState {
  const id = options.id ?? generateId();
  const now = options.now ?? Date.now();
  return {
    ...state,
    documents: [...state.documents, baseDocument(id, now)],
    activeDocumentId: id,
  };
}

export type NewDocumentInput = {
  path: string;
  text: string;
  fileMtimeMs?: number | null;
  id?: DocumentId;
};

// Adds file-backed documents, skipping paths that are already open. The
// last relevant document (newly opened or already open) becomes active.
export function addDocuments(
  state: WorkspaceState,
  inputs: NewDocumentInput[],
  options: { now?: number } = {}
): WorkspaceState {
  const now = options.now ?? Date.now();
  const documents = [...state.documents];
  let lastRelevantId: DocumentId | null = null;

  for (const input of inputs) {
    const existing = documents.find(
      (doc) => doc.path !== null && doc.path === input.path
    );
    if (existing) {
      lastRelevantId = existing.id;
      continue;
    }
    const id = input.id ?? generateId();
    documents.push({
      ...baseDocument(id, now),
      kind: "file",
      path: input.path,
      title: titleFromPath(input.path),
      text: input.text,
      lastSavedText: input.text,
      lineEnding: detectLineEnding(input.text),
      fileMtimeMs: input.fileMtimeMs ?? null,
    });
    lastRelevantId = id;
  }

  return {
    ...state,
    documents,
    activeDocumentId: lastRelevantId ?? state.activeDocumentId,
  };
}

export function activateDocument(
  state: WorkspaceState,
  id: DocumentId,
  now: number = Date.now()
): WorkspaceState {
  if (!state.documents.some((doc) => doc.id === id)) {
    return state;
  }
  return {
    ...state,
    activeDocumentId: id,
    documents: state.documents.map((doc) =>
      doc.id === id ? { ...doc, lastActivatedAt: now } : doc
    ),
  };
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
    isSaving: false,
    lastError: null,
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

export function removeDocuments(
  state: WorkspaceState,
  ids: DocumentId[]
): WorkspaceState {
  const removed = new Set(ids);
  const remaining = state.documents.filter((doc) => !removed.has(doc.id));

  let activeDocumentId = state.activeDocumentId;
  if (activeDocumentId !== null && removed.has(activeDocumentId)) {
    const oldIndex = state.documents.findIndex(
      (doc) => doc.id === activeDocumentId
    );
    const nextSurvivor = state.documents
      .slice(oldIndex + 1)
      .find((doc) => !removed.has(doc.id));
    activeDocumentId =
      nextSurvivor?.id ?? remaining[remaining.length - 1]?.id ?? null;
  }

  return { ...state, documents: remaining, activeDocumentId };
}
