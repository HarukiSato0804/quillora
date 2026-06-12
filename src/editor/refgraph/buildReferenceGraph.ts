import { parseHeadings } from "../parser/parseHeadings";
import { parseMarkdownLinks } from "./parseMarkdownLinks";
import { resolveReference, type ResolvedReference } from "./resolveReference";

export type ReferenceGraph = {
  references: ResolvedReference[];
  brokenReferences: ResolvedReference[];
};

export function buildReferenceGraph(
  files: { path: string; content: string }[],
  workspaceRoot: string
): ReferenceGraph {
  const fileSet = new Set(files.map((file) => normalizeAbsolutePath(file.path)));
  const headingsByFile = new Map(
    files.map((file) => [
      normalizeAbsolutePath(file.path),
      parseHeadings(file.content),
    ])
  );

  const references = files.flatMap((file) =>
    parseMarkdownLinks(file.content).map((link) =>
      resolveReference(
        link,
        normalizeAbsolutePath(file.path),
        workspaceRoot,
        fileSet,
        headingsByFile
      )
    )
  );

  return {
    references,
    brokenReferences: references.filter((reference) =>
      ["missing-file", "missing-heading"].includes(reference.status)
    ),
  };
}

function normalizeAbsolutePath(path: string): string {
  return path.replace(/\/+/g, "/");
}
