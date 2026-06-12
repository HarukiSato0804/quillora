import {
  findDocumentByCanonicalPath,
  type DocumentId,
  type WorkspaceState,
} from "../store/workspaceStore";

export const SUPPORTED_EXTENSIONS = ["md", "markdown", "mdx", "txt"] as const;

export function isSupportedMarkdownPath(path: string): boolean {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return false;
  }
  const extension = name.slice(dot + 1).toLowerCase();
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension);
}

export type OpenPlanEntry =
  | { kind: "read"; path: string }
  | { kind: "already-open"; path: string; id: DocumentId }
  | { kind: "unsupported"; path: string };

export type OpenPlan = {
  entries: OpenPlanEntry[];
  toRead: string[];
  unsupported: string[];
};

// Classifies requested paths in selection order: deduplicates repeats,
// rejects unsupported extensions, and detects documents that are already
// open so the caller can activate them instead of opening duplicates.
// Already-open detection compares the workspace's canonical paths; paths
// that survive to the read step are canonicalized by the Rust side and
// deduplicated once more on insert.
export function planOpenPaths(
  state: WorkspaceState,
  paths: string[]
): OpenPlan {
  const seen = new Set<string>();
  const entries: OpenPlanEntry[] = [];

  for (const path of paths) {
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);

    if (!isSupportedMarkdownPath(path)) {
      entries.push({ kind: "unsupported", path });
      continue;
    }
    const existing = findDocumentByCanonicalPath(state, path);
    if (existing) {
      entries.push({ kind: "already-open", path, id: existing.id });
      continue;
    }
    entries.push({ kind: "read", path });
  }

  return {
    entries,
    toRead: entries
      .filter((entry) => entry.kind === "read")
      .map((entry) => entry.path),
    unsupported: entries
      .filter((entry) => entry.kind === "unsupported")
      .map((entry) => entry.path),
  };
}
