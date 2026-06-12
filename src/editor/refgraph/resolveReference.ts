import type { Heading } from "../parser/parseHeadings";
import type { MarkdownLink } from "./parseMarkdownLinks";

export type ReferenceStatus =
  | "ok"
  | "missing-file"
  | "missing-heading"
  | "external"
  | "unsupported";

export type ResolvedReference = {
  sourceFile: string;
  link: MarkdownLink;
  resolvedPath: string | null;
  anchor: string | null;
  status: ReferenceStatus;
};

export function resolveReference(
  link: MarkdownLink,
  sourceFile: string,
  workspaceRoot: string,
  fileSet: Set<string>,
  headingsByFile: Map<string, Heading[]>
): ResolvedReference {
  const { pathPart, anchor } = splitTarget(link.target);
  const base: ResolvedReference = {
    sourceFile,
    link,
    resolvedPath: null,
    anchor,
    status: "unsupported",
  };

  if (/^https?:\/\//i.test(link.target)) {
    return { ...base, status: "external" };
  }

  const normalizedRoot = normalizeAbsolutePath(workspaceRoot);
  if (!normalizedRoot) {
    return base;
  }

  const sourceDir = dirname(sourceFile);
  const resolvedPath =
    link.kind === "anchor"
      ? normalizeAbsolutePath(sourceFile)
      : resolveTargetPath(pathPart, sourceDir, normalizedRoot, link.kind);

  if (!resolvedPath || !isInsideWorkspace(resolvedPath, normalizedRoot)) {
    return { ...base, resolvedPath, status: "unsupported" };
  }

  if (!fileSet.has(resolvedPath)) {
    return { ...base, resolvedPath, status: "missing-file" };
  }

  if (anchor && !hasHeadingAnchor(headingsByFile.get(resolvedPath) ?? [], anchor)) {
    return { ...base, resolvedPath, status: "missing-heading" };
  }

  return { ...base, resolvedPath, status: "ok" };
}

function splitTarget(target: string): { pathPart: string; anchor: string | null } {
  const hashIndex = target.indexOf("#");
  if (hashIndex < 0) {
    return { pathPart: target, anchor: null };
  }
  const anchor = target.slice(hashIndex + 1);
  return {
    pathPart: target.slice(0, hashIndex),
    anchor: anchor.length > 0 ? anchor : null,
  };
}

function resolveTargetPath(
  pathPart: string,
  sourceDir: string,
  workspaceRoot: string,
  kind: MarkdownLink["kind"]
): string | null {
  if (kind === "wiki") {
    return normalizeAbsolutePath(`${workspaceRoot}/${pathPart}.md`);
  }
  if (!pathPart) {
    return null;
  }
  if (pathPart.startsWith("/")) {
    return normalizeAbsolutePath(pathPart);
  }
  return normalizeAbsolutePath(`${sourceDir}/${pathPart}`);
}

function normalizeAbsolutePath(path: string): string | null {
  if (!path.startsWith("/")) {
    return null;
  }
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function dirname(path: string): string {
  const normalized = normalizeAbsolutePath(path);
  if (!normalized) {
    return "/";
  }
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : "/";
}

function isInsideWorkspace(path: string, workspaceRoot: string): boolean {
  return path === workspaceRoot || path.startsWith(`${workspaceRoot}/`);
}

function hasHeadingAnchor(headings: Heading[], anchor: string): boolean {
  const wanted = decodeURIComponent(anchor).toLowerCase();
  return headings.some((heading) => slugHeading(heading.text) === wanted);
}

function slugHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-");
}
