import { describe, expect, it } from "vitest";
import { parseMermaidBlocks } from "./parseMermaidBlocks";

describe("parseMermaidBlocks", () => {
  it("returns nothing for plain text", () => {
    expect(parseMermaidBlocks("no diagrams")).toEqual([]);
  });

  it("parses a mermaid fenced block", () => {
    const text = "```mermaid\ngraph TD\nA --> B\n```";
    expect(parseMermaidBlocks(text)).toEqual([
      { fromLine: 1, toLine: 4, code: "graph TD\nA --> B" },
    ]);
  });

  it("ignores non-mermaid code fences", () => {
    expect(parseMermaidBlocks("```python\nprint(1)\n```")).toEqual([]);
  });

  it("ignores unclosed mermaid fences", () => {
    expect(parseMermaidBlocks("```mermaid\ngraph TD")).toEqual([]);
  });

  it("ignores empty mermaid blocks", () => {
    expect(parseMermaidBlocks("```mermaid\n```")).toEqual([]);
  });

  it("supports tilde fences", () => {
    const text = "~~~mermaid\ngraph TD\n~~~";
    expect(parseMermaidBlocks(text)).toEqual([
      { fromLine: 1, toLine: 3, code: "graph TD" },
    ]);
  });

  it("ignores mermaid-looking fences inside another open fence", () => {
    const text = "```\n~~~mermaid\ngraph TD\n~~~\n```";
    expect(parseMermaidBlocks(text)).toEqual([]);
  });
});
