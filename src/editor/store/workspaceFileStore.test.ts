import { describe, expect, it } from "vitest";
import {
  classifyByPath,
  groupByKind,
  type MarkdownFileEntry,
} from "./workspaceFileStore";

function file(
  relativePath: string,
  kind: MarkdownFileEntry["kind"]
): MarkdownFileEntry {
  const parts = relativePath.split("/");
  return {
    path: `/workspace/${relativePath}`,
    name: parts[parts.length - 1] ?? relativePath,
    kind,
    size: 1,
    modifiedAt: 1,
    relativePath,
  };
}

describe("classifyByPath", () => {
  it("classifies known workspace markdown paths", () => {
    expect(classifyByPath("skill.md")).toBe("skill");
    expect(classifyByPath("README.md")).toBe("readme");
    expect(classifyByPath("agents/openai.md")).toBe("agent");
    expect(classifyByPath("notes/random.md")).toBe("unknown");
  });

  it("uses frontmatter type before path heuristics", () => {
    expect(classifyByPath("notes/random.md", "---\ntype: design\n---\n")).toBe(
      "design"
    );
  });
});

describe("groupByKind", () => {
  it("groups files by markdown kind", () => {
    const grouped = groupByKind([
      file("skill.md", "skill"),
      file("docs/design/app.md", "design"),
      file("notes.md", "unknown"),
    ]);

    expect(grouped.skill.map((entry) => entry.relativePath)).toEqual([
      "skill.md",
    ]);
    expect(grouped.design.map((entry) => entry.relativePath)).toEqual([
      "docs/design/app.md",
    ]);
    expect(grouped.unknown.map((entry) => entry.relativePath)).toEqual([
      "notes.md",
    ]);
  });
});
