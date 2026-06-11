import { describe, expect, it } from "vitest";
import { parseInlineSpans } from "./parseInlineSpans";

describe("parseInlineSpans", () => {
  it("returns nothing for plain text", () => {
    expect(parseInlineSpans("plain text")).toEqual([]);
  });

  it("parses bold", () => {
    const spans = parseInlineSpans("a **bold** b");
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      type: "bold",
      from: 2,
      to: 10,
      content: { from: 4, to: 8 },
    });
    expect(spans[0].markers).toEqual([
      { from: 2, to: 4 },
      { from: 8, to: 10 },
    ]);
  });

  it("parses italic without consuming bold markers", () => {
    const spans = parseInlineSpans("*it* and **bo**");
    expect(spans.map((s) => s.type)).toEqual(["italic", "bold"]);
    expect(spans[0]).toMatchObject({ from: 0, to: 4, content: { from: 1, to: 3 } });
  });

  it("parses inline code", () => {
    const spans = parseInlineSpans("run `npm test` now");
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      type: "code",
      from: 4,
      to: 14,
      content: { from: 5, to: 13 },
    });
  });

  it("does not parse emphasis inside inline code", () => {
    const spans = parseInlineSpans("`**not bold**`");
    expect(spans.map((s) => s.type)).toEqual(["code"]);
  });

  it("parses links with label and url markers", () => {
    const spans = parseInlineSpans("see [docs](https://example.com).");
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      type: "link",
      from: 4,
      to: 31,
      content: { from: 5, to: 9 },
    });
    expect(spans[0].markers).toEqual([
      { from: 4, to: 5 },
      { from: 9, to: 31 },
    ]);
  });

  it("parses multiple spans sorted by position", () => {
    const spans = parseInlineSpans("**a** then `b` then *c*");
    expect(spans.map((s) => s.type)).toEqual(["bold", "code", "italic"]);
    expect(spans[0].from).toBeLessThan(spans[1].from);
    expect(spans[1].from).toBeLessThan(spans[2].from);
  });

  it("ignores unterminated markers", () => {
    expect(parseInlineSpans("**open and `dangling")).toEqual([]);
  });
});
