import { describe, expect, it } from "vitest";
import { parseMarkdownLinks } from "./parseMarkdownLinks";

describe("parseMarkdownLinks", () => {
  it("detects inline links", () => {
    expect(parseMarkdownLinks("[text](./foo.md)")).toEqual([
      { kind: "inline", text: "text", target: "./foo.md", line: 1 },
    ]);
  });

  it("detects image links", () => {
    expect(parseMarkdownLinks("![alt](./image.png)")).toEqual([
      { kind: "image", text: "alt", target: "./image.png", line: 1 },
    ]);
  });

  it("detects wiki links", () => {
    expect(parseMarkdownLinks("[[wiki]]")).toEqual([
      { kind: "wiki", text: "wiki", target: "wiki", line: 1 },
    ]);
  });

  it("detects same-file anchors", () => {
    expect(parseMarkdownLinks("[sec](#save-flow)")).toEqual([
      { kind: "anchor", text: "sec", target: "#save-flow", line: 1 },
    ]);
  });

  it("excludes links inside code fences", () => {
    const links = parseMarkdownLinks(
      ["```md", "[hidden](./hidden.md)", "```", "[shown](./shown.md)"].join("\n")
    );

    expect(links).toEqual([
      { kind: "inline", text: "shown", target: "./shown.md", line: 4 },
    ]);
  });
});
