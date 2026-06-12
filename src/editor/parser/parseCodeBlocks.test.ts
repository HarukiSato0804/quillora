import { describe, expect, it } from "vitest";
import { parseCodeBlocks } from "./parseCodeBlocks";

describe("parseCodeBlocks", () => {
  it("returns nothing for plain text", () => {
    expect(parseCodeBlocks("no code")).toEqual([]);
  });

  it("parses a closed fence with a language", () => {
    expect(parseCodeBlocks("```python\nprint(1)\n```")).toEqual([
      { fromLine: 1, toLine: 3, lang: "python" },
    ]);
  });

  it("parses a fence without a language", () => {
    expect(parseCodeBlocks("```\nx\n```")).toEqual([
      { fromLine: 1, toLine: 3, lang: null },
    ]);
  });

  it("extends an unclosed fence to the end of the document", () => {
    expect(parseCodeBlocks("text\n```js\nlet a = 1")).toEqual([
      { fromLine: 2, toLine: 3, lang: "js" },
    ]);
  });

  it("parses multiple blocks and tilde fences", () => {
    const text = "```a\nx\n```\n\n~~~b\ny\n~~~";
    expect(parseCodeBlocks(text)).toEqual([
      { fromLine: 1, toLine: 3, lang: "a" },
      { fromLine: 5, toLine: 7, lang: "b" },
    ]);
  });
});
