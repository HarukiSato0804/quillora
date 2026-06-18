import { isDirty, type WorkspaceState } from "./workspaceStore";

// Crash/draft recovery (issue #3).
//
// The session store deliberately persists only metadata for file-backed
// documents and re-reads their text from disk on restore — so unsaved edits to
// a saved file are lost if the app crashes. The draft store closes that gap:
// it keeps a recovery backup of the *unsaved* text for dirty file-backed
// documents, keyed by path, written separately from the session so a crash
// can't take both down at once.
//
// Untitled documents already round-trip their text through the session store,
// so drafts intentionally cover only file-backed documents.

export type Draft = {
  path: string;
  // The unsaved editor text at the time the draft was captured.
  text: string;
  // The document's last-known on-disk mtime, used to reason about staleness.
  baseMtimeMs: number | null;
  // Wall-clock capture time (ms epoch), shown to the user during recovery.
  savedAt: number;
};

export type PersistedDrafts = {
  version: 1;
  drafts: Draft[];
};

// Collect a draft for every dirty file-backed document. Clean documents and
// untitled documents are skipped (nothing to recover that disk/session lacks).
export function collectDrafts(
  state: WorkspaceState,
  savedAt: number
): Draft[] {
  return state.documents
    .filter((doc) => doc.path !== null && isDirty(doc))
    .map((doc) => ({
      path: doc.path as string,
      text: doc.text,
      baseMtimeMs: doc.fileMtimeMs,
      savedAt,
    }));
}

export function serializeDrafts(drafts: Draft[]): string {
  const payload: PersistedDrafts = { version: 1, drafts };
  return JSON.stringify(payload);
}

export function parseDrafts(json: string | null): Draft[] {
  if (!json) return [];
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return [];
  }
  if (
    typeof value !== "object" ||
    value === null ||
    (value as Partial<PersistedDrafts>).version !== 1 ||
    !Array.isArray((value as Partial<PersistedDrafts>).drafts)
  ) {
    return [];
  }
  return (value as PersistedDrafts).drafts.filter(
    (draft): draft is Draft =>
      typeof draft?.path === "string" && typeof draft?.text === "string"
  );
}

export type DiskContent = {
  path: string;
  text: string;
};

// A draft is worth recovering only if its text actually differs from what is
// now on disk. If they match, the user's edits were saved (or an external write
// already matches), so there is nothing to restore. Drafts whose file is no
// longer open/readable are dropped.
export function recoverableDrafts(
  drafts: Draft[],
  diskContents: DiskContent[]
): Draft[] {
  const diskByPath = new Map(diskContents.map((d) => [d.path, d.text]));
  return drafts.filter((draft) => {
    const disk = diskByPath.get(draft.path);
    return disk !== undefined && disk !== draft.text;
  });
}
