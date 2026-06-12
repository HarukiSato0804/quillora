import { describe, expect, it } from "vitest";
import { buildContextBundle, type BundleEntry } from "./buildContextBundle";

function entry(relativePath: string, content: string): BundleEntry {
  return {
    path: `/workspace/${relativePath}`,
    relativePath,
    content,
  };
}

describe("buildContextBundle", () => {
  it("builds a bundle from one file", () => {
    const bundle = buildContextBundle([entry("skill.md", "# Skill")]);

    expect(bundle.entries).toHaveLength(1);
    expect(bundle.markdown).toContain("## File: skill.md");
  });

  it("builds a bundle from multiple files", () => {
    const bundle = buildContextBundle([
      entry("skill.md", "# Skill"),
      entry("agent.md", "# Agent"),
    ]);

    expect(bundle.entries).toHaveLength(2);
    expect(bundle.markdown).toContain("## File: skill.md");
    expect(bundle.markdown).toContain("## File: agent.md");
  });

  it("includes file path headings and wraps content in code blocks", () => {
    const bundle = buildContextBundle([entry("docs/agent.md", "Body")]);

    expect(bundle.markdown).toContain("## File: docs/agent.md");
    expect(bundle.markdown).toContain(["```md", "Body", "```"].join("\n"));
  });

  it("calculates total chars correctly", () => {
    const bundle = buildContextBundle([entry("a.md", "123"), entry("b.md", "45")]);

    expect(bundle.totalChars).toBe(5);
  });

  it("estimates tokens with Math.ceil(totalChars / 4)", () => {
    const bundle = buildContextBundle([entry("a.md", "12345")]);

    expect(bundle.estimatedTokens).toBe(2);
  });

  it("preserves selection order in output order", () => {
    const bundle = buildContextBundle([
      entry("b.md", "B"),
      entry("a.md", "A"),
    ]);

    expect(bundle.markdown.indexOf("## File: b.md")).toBeLessThan(
      bundle.markdown.indexOf("## File: a.md")
    );
  });
});
