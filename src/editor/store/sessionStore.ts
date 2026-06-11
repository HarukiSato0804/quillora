import {
  activateDocument,
  addDocuments,
  createWorkspace,
  findDocumentByCanonicalPath,
  newUntitledDocument,
  updateDocumentScroll,
  updateDocumentSelection,
  type DocumentSelection,
  type WorkspaceState,
} from "./workspaceStore";

export type PersistedDocument = {
  path: string | null;
  title: string;
  textForUntitledOnly?: string;
  selection: DocumentSelection | null;
  scrollTop: number;
};

export type PersistedWorkspace = {
  version: 1;
  activeDocumentPath: string | null;
  openDocuments: PersistedDocument[];
};

// File-backed documents persist only metadata — their text is re-read
// from disk on restore, so a session restore can never overwrite what
// the user saved elsewhere. Untitled documents persist their text since
// disk has no copy. Pristine empty untitled tabs are not worth restoring.
export function serializeWorkspace(state: WorkspaceState): PersistedWorkspace {
  const active = state.documents.find(
    (doc) => doc.id === state.activeDocumentId
  );
  return {
    version: 1,
    activeDocumentPath: active?.path ?? null,
    openDocuments: state.documents
      .filter((doc) => doc.path !== null || doc.text !== "")
      .map((doc) => ({
        path: doc.path,
        title: doc.title,
        ...(doc.path === null ? { textForUntitledOnly: doc.text } : {}),
        selection: doc.selection,
        scrollTop: doc.scrollTop,
      })),
  };
}

export function isPersistedWorkspace(
  value: unknown
): value is PersistedWorkspace {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<PersistedWorkspace>;
  return candidate.version === 1 && Array.isArray(candidate.openDocuments);
}

export type RestoredFile = {
  path: string;
  text: string;
  mtimeMs: number | null;
};

// Rebuilds a workspace from a persisted session plus the file contents
// that could actually be read. Missing files are skipped (the caller
// reports them); an empty result falls back to a fresh untitled document.
export function buildRestoredWorkspace(
  persisted: PersistedWorkspace,
  files: RestoredFile[]
): WorkspaceState {
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  let ws = createWorkspace();

  for (const doc of persisted.openDocuments) {
    if (doc.path === null) {
      ws = newUntitledDocument(ws, { text: doc.textForUntitledOnly ?? "" });
    } else {
      const file = fileByPath.get(doc.path);
      if (!file) {
        continue;
      }
      ws = addDocuments(ws, [
        { path: file.path, text: file.text, fileMtimeMs: file.mtimeMs },
      ]);
    }
    const id = ws.activeDocumentId;
    if (id !== null) {
      ws = updateDocumentSelection(ws, id, doc.selection);
      ws = updateDocumentScroll(ws, id, doc.scrollTop);
    }
  }

  if (persisted.activeDocumentPath !== null) {
    const activeDoc = findDocumentByCanonicalPath(
      ws,
      persisted.activeDocumentPath
    );
    if (activeDoc) {
      ws = activateDocument(ws, activeDoc.id);
    }
  }

  if (ws.documents.length === 0) {
    ws = newUntitledDocument(ws);
  }
  return ws;
}
