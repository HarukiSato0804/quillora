import { invoke } from "@tauri-apps/api/core";
import { open, save, ask, message } from "@tauri-apps/plugin-dialog";

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

export async function readMarkdownFiles(
  paths: string[]
): Promise<ReadMarkdownFilesResult> {
  return invoke<ReadMarkdownFilesResult>("read_markdown_files", { paths });
}

export async function showOpenProblems(problems: string[]): Promise<void> {
  await message(problems.join("\n"), { title: "Markflow", kind: "warning" });
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

export async function saveMarkdownDocument(
  path: string,
  contents: string
): Promise<void> {
  await invoke("write_markdown_file", {
    path,
    contents,
  });
}

export async function saveMarkdownDocumentAs(
  contents: string
): Promise<string | null> {
  const selected = await save({
    filters: markdownFilters,
    defaultPath: "untitled.md",
  });

  if (typeof selected !== "string") {
    return null;
  }

  await saveMarkdownDocument(selected, contents);
  return selected;
}

export async function confirmDiscardChanges(): Promise<boolean> {
  return ask("You have unsaved changes. Discard them?", {
    title: "Markflow",
    kind: "warning",
  });
}
