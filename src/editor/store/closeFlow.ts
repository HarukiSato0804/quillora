import {
  isDirty,
  removeDocuments,
  type DocumentId,
  type WorkspaceState,
} from "./workspaceStore";

export type CloseIntent =
  | { type: "single"; documentId: DocumentId }
  | { type: "others"; exceptDocumentId: DocumentId }
  | { type: "saved" }
  | { type: "all" };

export type UnsavedDecision = "save" | "discard" | "cancel";

export type ClosePlan = {
  targets: DocumentId[];
  dirtyTargets: DocumentId[];
};

export function planClose(
  state: WorkspaceState,
  intent: CloseIntent
): ClosePlan {
  const targets = state.documents.filter((doc) => {
    switch (intent.type) {
      case "single":
        return doc.id === intent.documentId;
      case "others":
        return doc.id !== intent.exceptDocumentId;
      case "saved":
        return !isDirty(doc);
      case "all":
        return true;
    }
  });
  return {
    targets: targets.map((doc) => doc.id),
    dirtyTargets: targets.filter(isDirty).map((doc) => doc.id),
  };
}

// Applies an unsaved-changes decision to a close plan. "save" is expected
// to have been performed by the caller (file I/O lives outside the store),
// after which saved documents are no longer dirty and can be closed like
// "discard". "cancel" aborts the whole plan, keeping dirty tabs open.
export function applyCloseDecision(
  state: WorkspaceState,
  plan: ClosePlan,
  decision: UnsavedDecision
): WorkspaceState {
  if (plan.targets.length === 0) {
    return state;
  }
  if (plan.dirtyTargets.length > 0 && decision === "cancel") {
    return state;
  }
  return removeDocuments(state, plan.targets);
}
