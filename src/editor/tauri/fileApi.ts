import { invoke } from "@tauri-apps/api/core";
import { open, save, ask, message } from "@tauri-apps/plugin-dialog";
import type { MarkdownFileEntry } from "../store/workspaceFileStore";

const markdownFilters = [
  {
    name: "Markdown",
    extensions: ["md", "markdown", "txt"],
  },
];

export type MarkdownFilePayload = {
  requestedPath: string;
  path: string;
  contents: string;
  mtimeMs: number | null;
};

export type FileReadErrorPayload = {
  path: string;
  message: string;
};

export type ReadMarkdownFilesResult = {
  files: MarkdownFilePayload[];
  errors: FileReadErrorPayload[];
};

export async function pickMarkdownPaths(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: markdownFilters,
  });
  if (selected === null) {
    return [];
  }
  return Array.isArray(selected) ? selected : [selected];
}

export async function pickWorkspaceRoot(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: true,
  });
  return typeof selected === "string" ? selected : null;
}

export async function scanWorkspace(
  root: string
): Promise<MarkdownFileEntry[]> {
  return invoke<MarkdownFileEntry[]>("scan_workspace", { root });
}

export async function readMarkdownFiles(
  paths: string[]
): Promise<ReadMarkdownFilesResult> {
  return invoke<ReadMarkdownFilesResult>("read_markdown_files", { paths });
}

export async function showOpenProblems(problems: string[]): Promise<void> {
  await message(problems.join("\n"), { title: "Quillora", kind: "warning" });
}

export async function showInfo(text: string): Promise<void> {
  await message(text, { title: "Quillora", kind: "info" });
}

export async function revealInFinder(path: string): Promise<void> {
  await invoke("reveal_in_finder", { path });
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await invoke("copy_text_to_clipboard", { text });
}

export async function saveSession(json: string): Promise<void> {
  await invoke("save_session", { json });
}

export async function loadSession(): Promise<string | null> {
  return invoke<string | null>("load_session");
}

export type FileStatPayload = {
  path: string;
  mtimeMs: number | null;
};

export async function statFiles(paths: string[]): Promise<FileStatPayload[]> {
  return invoke<FileStatPayload[]>("stat_files", { paths });
}

export async function confirmReloadFromDisk(title: string): Promise<boolean> {
  return ask(
    `"${title}" changed on disk and you have unsaved edits.\nReload from disk and discard your edits?`,
    { title: "Quillora", kind: "warning" }
  );
}

export async function takePendingOpenPath(): Promise<string | null> {
  return invoke<string | null>("take_pending_open_path");
}

export async function getRecentFiles(): Promise<string[]> {
  return invoke<string[]>("get_recent_files");
}

export async function recordRecentFile(path: string): Promise<string[]> {
  return invoke<string[]>("record_recent_file", { path });
}

// Sentinel the Rust side returns when a guarded write detects the file changed
// on disk since `expectedMtimeMs`. Surfaced as a distinct error so the save
// flow can prompt instead of clobbering.
export const EXTERNAL_CHANGE_ERROR = "EXTERNAL_CHANGE";

export type WriteResult = {
  mtimeMs: number | null;
};

export async function saveMarkdownDocument(
  path: string,
  contents: string,
  expectedMtimeMs?: number | null
): Promise<WriteResult> {
  return invoke<WriteResult>("write_markdown_file", {
    path,
    contents,
    expectedMtimeMs: expectedMtimeMs ?? null,
  });
}

export function isExternalChangeError(error: unknown): boolean {
  return typeof error === "string" && error.includes(EXTERNAL_CHANGE_ERROR);
}

export async function saveDrafts(json: string): Promise<void> {
  await invoke("save_drafts", { json });
}

export async function loadDrafts(): Promise<string | null> {
  return invoke<string | null>("load_drafts");
}

export async function clearDrafts(): Promise<void> {
  await invoke("clear_drafts");
}

export async function confirmOverwriteExternalChange(
  title: string
): Promise<boolean> {
  return ask(
    `"${title}" was changed on disk since you opened it.\nOverwrite the version on disk with your edits?`,
    { title: "Quillora", kind: "warning" }
  );
}

export async function showSaveError(
  title: string,
  detail: string
): Promise<void> {
  await message(`Could not save "${title}".\n\n${detail}`, {
    title: "Quillora",
    kind: "error",
  });
}

export async function confirmRecoverDrafts(count: number): Promise<boolean> {
  const noun = count === 1 ? "document" : "documents";
  return ask(
    `Quillora found unsaved changes for ${count} ${noun} from your last session.\nRestore them?`,
    { title: "Quillora", kind: "warning" }
  );
}

export async function saveMarkdownDocumentAs(
  contents: string,
  defaultPath = "untitled.md"
): Promise<string | null> {
  const selected = await save({
    filters: markdownFilters,
    defaultPath,
  });

  if (typeof selected !== "string") {
    return null;
  }

  await saveMarkdownDocument(selected, contents);
  return selected;
}

export async function confirmDiscardChanges(): Promise<boolean> {
  return ask("You have unsaved changes. Discard them?", {
    title: "Quillora",
    kind: "warning",
  });
}
