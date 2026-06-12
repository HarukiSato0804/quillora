import { isSupportedMarkdownPath } from "./openPipeline";

export type DroppedItem =
  | { type: "markdown"; path: string }
  | { type: "image"; path: string }
  | { type: "directory"; path: string }
  | { type: "unsupported"; path: string };

const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "tiff",
  "heic",
];

function extensionOf(path: string): string | null {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  return name.slice(dot + 1).toLowerCase();
}

// The drop payload only carries paths, so directories are detected by the
// absence of an extension — a best-effort heuristic that covers typical
// Finder folders. Pass an explicit hint when the caller knows better.
export function classifyDroppedPath(
  path: string,
  options: { isDirectory?: boolean } = {}
): DroppedItem {
  if (options.isDirectory) {
    return { type: "directory", path };
  }
  if (isSupportedMarkdownPath(path)) {
    return { type: "markdown", path };
  }
  const extension = extensionOf(path);
  if (extension === null) {
    return { type: "directory", path };
  }
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return { type: "image", path };
  }
  return { type: "unsupported", path };
}

export function classifyDroppedPaths(paths: string[]): DroppedItem[] {
  return paths.map((path) => classifyDroppedPath(path));
}

export type DropSplit = {
  markdownPaths: string[];
  problems: string[];
};

// Splits a drop into paths for the openPaths pipeline and human-readable
// problems for everything Markflow does not handle yet.
export function splitDroppedPaths(paths: string[]): DropSplit {
  const markdownPaths: string[] = [];
  const problems: string[] = [];

  for (const item of classifyDroppedPaths(paths)) {
    switch (item.type) {
      case "markdown":
        markdownPaths.push(item.path);
        break;
      case "image":
        problems.push(`${item.path}: images cannot be opened as documents`);
        break;
      case "directory":
        problems.push(`${item.path}: folders are not supported yet`);
        break;
      case "unsupported":
        problems.push(`${item.path}: unsupported file type`);
        break;
    }
  }

  return { markdownPaths, problems };
}

export function fileUriToPath(uri: string): string {
  let parsed: URL;
  try {
    parsed = new URL(uri.trim());
  } catch {
    return "";
  }
  if (parsed.protocol !== "file:") {
    return "";
  }
  const path = decodeURIComponent(parsed.pathname);
  if (parsed.hostname && parsed.hostname !== "localhost") {
    return `//${parsed.hostname}${path}`;
  }
  return path;
}

export function extractPathsFromDataTransfer(dt: DataTransfer): string[] {
  if (!Array.from(dt.types).includes("text/uri-list")) {
    return [];
  }
  return dt
    .getData("text/uri-list")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map(fileUriToPath)
    .filter((path) => path !== "");
}
