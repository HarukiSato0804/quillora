import { describe, expect, it } from "vitest";
import type { Heading } from "../parser/parseHeadings";
import type { MarkdownLink } from "./parseMarkdownLinks";
import { resolveReference } from "./resolveReference";

const root = "/workspace";
const sourceFile = "/workspace/docs/current.md";

function link(target: string, kind: MarkdownLink["kind"] = "inline"): MarkdownLink {
  return { kind, text: "link", target, line: 1 };
}

function resolve(
  markdownLink: MarkdownLink,
  files = [sourceFile, "/workspace/docs/foo.md"],
  headings: Record<string, Heading[]> = {}
) {
  return resolveReference(
    markdownLink,
    sourceFile,
    root,
    new Set(files),
    new Map(Object.entries(headings))
  );
}

describe("resolveReference", () => {
  it("resolves relative paths relative to the source file", () => {
    const result = resolve(link("./foo.md"));

    expect(result.status).toBe("ok");
    expect(result.resolvedPath).toBe("/workspace/docs/foo.md");
  });

  it("marks nonexistent files as missing-file", () => {
    const result = resolve(link("./missing.md"));

    expect(result.status).toBe("missing-file");
    expect(result.resolvedPath).toBe("/workspace/docs/missing.md");
  });

  it("marks nonexistent heading anchors as missing-heading", () => {
    const result = resolve(
      link("./foo.md#missing"),
      [sourceFile, "/workspace/docs/foo.md"],
      { "/workspace/docs/foo.md": [{ level: 2, text: "Present", line: 1, from: 0 }] }
    );

    expect(result.status).toBe("missing-heading");
    expect(result.anchor).toBe("missing");
  });

  it("marks http URLs as external", () => {
    const result = resolve(link("https://example.com"));

    expect(result.status).toBe("external");
    expect(result.resolvedPath).toBeNull();
  });
});
