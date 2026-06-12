import { describe, expect, it } from "vitest";
import { parseHorizontalRules } from "./parseHorizontalRules";

describe("parseHorizontalRules", () => {
  it("detects dash, star, and underscore rules", () => {
    expect(parseHorizontalRules("---\n***\n____")).toEqual([
      { from: 0, to: 3 },
      { from: 4, to: 7 },
      { from: 8, to: 12 },
    ]);
  });

  it("allows spaces between repeated markers", () => {
    expect(parseHorizontalRules("- - -")).toEqual([{ from: 0, to: 5 }]);
  });

  it("rejects mixed marker lines", () => {
    expect(parseHorizontalRules("--*")).toEqual([]);
  });

  it("skips fenced code blocks", () => {
    const markdown = "~~~\n---\n~~~\n***";
    expect(parseHorizontalRules(markdown)).toEqual([{ from: 12, to: 15 }]);
  });
});
