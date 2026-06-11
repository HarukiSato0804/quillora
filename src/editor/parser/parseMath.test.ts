import { describe, expect, it } from "vitest";
import { parseMath } from "./parseMath";

describe("parseMath", () => {
  it("returns nothing for plain text", () => {
    expect(parseMath("no math")).toEqual({ blocks: [], inline: [] });
  });

  it("parses inline math with positions", () => {
    const { inline } = parseMath("Euler: $e^{i\\pi}+1=0$ done");
    expect(inline).toEqual([
      { line: 1, from: 7, to: 21, expr: "e^{i\\pi}+1=0" },
    ]);
  });

  it("does not treat currency-like text as math", () => {
    expect(parseMath("$5 and $10").inline).toEqual([]);
  });

  it("does not match $$ delimiters as inline math", () => {
    expect(parseMath("a $$ b").inline).toEqual([]);
  });

  it("parses multi-line block math", () => {
    const { blocks } = parseMath("$$\nx^2\ny^2\n$$");
    expect(blocks).toEqual([{ fromLine: 1, toLine: 4, expr: "x^2\ny^2" }]);
  });

  it("parses single-line block math", () => {
    const { blocks } = parseMath("$$x^2$$");
    expect(blocks).toEqual([{ fromLine: 1, toLine: 1, expr: "x^2" }]);
  });

  it("ignores math inside fenced code blocks", () => {
    const parsed = parseMath("```\n$x$\n$$\ny\n$$\n```");
    expect(parsed.blocks).toEqual([]);
    expect(parsed.inline).toEqual([]);
  });

  it("does not scan inline math inside block math", () => {
    const parsed = parseMath("$$\n$x$\n$$");
    expect(parsed.inline).toEqual([]);
    expect(parsed.blocks).toHaveLength(1);
  });
});
