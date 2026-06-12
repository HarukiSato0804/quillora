import { describe, expect, it } from "vitest";
import { parseCodeBlocks } from "./parseCodeBlocks";

describe("parseCodeBlocks", () => {
  it("returns nothing for plain text", () => {
    expect(parseCodeBlocks("no code")).toEqual([]);
  });

  it("parses a closed fence with a language", () => {
    expect(parseCodeBlocks("```python\nprint(1)\n```")).toEqual([
      { fromLine: 1, toLine: 3, lang: "python", closed: true },
    ]);
  });

  it("parses a fence without a language", () => {
    expect(parseCodeBlocks("```\nx\n```")).toEqual([
      { fromLine: 1, toLine: 3, lang: null, closed: true },
    ]);
  });

  it("extends an unclosed fence to the end of the document", () => {
    expect(parseCodeBlocks("text\n```js\nlet a = 1")).toEqual([
      { fromLine: 2, toLine: 3, lang: "js", closed: false },
    ]);
  });

  it("parses multiple blocks and tilde fences", () => {
    const text = "```a\nx\n```\n\n~~~b\ny\n~~~";
    expect(parseCodeBlocks(text)).toEqual([
      { fromLine: 1, toLine: 3, lang: "a", closed: true },
      { fromLine: 5, toLine: 7, lang: "b", closed: true },
    ]);
  });

  it("marks the unclosed field as false when fence is not closed", () => {
    const blocks = parseCodeBlocks("```js\ncode");
    expect(blocks[0].closed).toBe(false);
  });

  it("marks the closed field as true for a properly closed fence", () => {
    const blocks = parseCodeBlocks("```js\ncode\n```");
    expect(blocks[0].closed).toBe(true);
  });
});
