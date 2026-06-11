import { invoke } from "@tauri-apps/api/core";
import { open, save, ask } from "@tauri-apps/plugin-dialog";

const markdownFilters = [
  {
    name: "Markdown",
    extensions: ["md", "markdown", "txt"],
  },
];

export type OpenedDocument = {
  path: string;
  contents: string;
};

export async function readMarkdownPath(path: string): Promise<string> {
  return invoke<string>("read_markdown_file", { path });
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

export async function openMarkdownDocument(): Promise<OpenedDocument | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: markdownFilters,
  });

  if (typeof selected !== "string") {
    return null;
  }

  const contents = await invoke<string>("read_markdown_file", {
    path: selected,
  });

  return {
    path: selected,
    contents,
  };
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
