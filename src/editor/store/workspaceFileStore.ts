export type MarkdownFileKind =
  | "skill"
  | "agent"
  | "readme"
  | "prompt"
  | "design"
  | "task"
  | "runbook"
  | "adr"
  | "changelog"
  | "unknown";

export type MarkdownFileEntry = {
  path: string;
  name: string;
  kind: MarkdownFileKind;
  size: number;
  modifiedAt: number;
  relativePath: string;
};

export type WorkspaceIndex = {
  rootPath: string;
  files: MarkdownFileEntry[];
  scannedAt: number;
} | null;

const VALID_KINDS = new Set<MarkdownFileKind>([
  "skill",
  "agent",
  "readme",
  "prompt",
  "design",
  "task",
  "runbook",
  "adr",
  "changelog",
  "unknown",
]);

export const MARKDOWN_FILE_KINDS: MarkdownFileKind[] = [
  "skill",
  "agent",
  "readme",
  "prompt",
  "design",
  "task",
  "runbook",
  "adr",
  "changelog",
  "unknown",
];

export function classifyByPath(
  relativePath: string,
  contentPrefix = ""
): MarkdownFileKind {
  const frontmatterKind = parseFrontmatterType(contentPrefix.slice(0, 200));
  if (frontmatterKind) {
    return frontmatterKind;
  }

  const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
  const segments = normalized.split("/").filter(Boolean);
  const fileName = segments[segments.length - 1] ?? normalized;

  if (fileName === "skill.md") {
    return "skill";
  }
  if (fileName === "agent.md" || segments.includes("agents")) {
    return "agent";
  }
  if (fileName === "readme.md") {
    return "readme";
  }
  if (
    fileName === "prompt.md" ||
    fileName === "system.md" ||
    fileName === "instructions.md"
  ) {
    return "prompt";
  }
  if (
    fileName === "design.md" ||
    fileName === "architecture.md" ||
    normalized.startsWith("docs/design/") ||
    normalized.includes("/docs/design/")
  ) {
    return "design";
  }
  if (
    fileName === "todo.md" ||
    fileName === "tasks.md" ||
    fileName === "roadmap.md"
  ) {
    return "task";
  }
  if (fileName === "runbook.md") {
    return "runbook";
  }
  if (fileName === "adr.md" || segments.includes("adr")) {
    return "adr";
  }
  if (fileName === "changelog.md") {
    return "changelog";
  }
  return "unknown";
}

export function groupByKind(
  files: MarkdownFileEntry[]
): Record<MarkdownFileKind, MarkdownFileEntry[]> {
  const grouped: Record<MarkdownFileKind, MarkdownFileEntry[]> = {
    skill: [],
    agent: [],
    readme: [],
    prompt: [],
    design: [],
    task: [],
    runbook: [],
    adr: [],
    changelog: [],
    unknown: [],
  };

  for (const file of files) {
    grouped[file.kind].push(file);
  }

  for (const kind of MARKDOWN_FILE_KINDS) {
    grouped[kind].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  return grouped;
}

function parseFrontmatterType(prefix: string): MarkdownFileKind | null {
  if (!prefix.startsWith("---")) {
    return null;
  }
  for (const line of prefix.slice(3).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "---") {
      return null;
    }
    const match = /^type:\s*["']?([^"'\s]+)["']?/.exec(trimmed);
    if (!match) {
      continue;
    }
    const kind = match[1] as MarkdownFileKind;
    return VALID_KINDS.has(kind) ? kind : null;
  }
  return null;
}
