import { describe, expect, it } from "vitest";
import { parseListItems } from "./parseListItems";

describe("parseListItems", () => {
  it("detects dash, star, and plus bullets", () => {
    expect(parseListItems("- a\n* b\n+ c")).toEqual([
      { from: 0, to: 1, marker: "-" },
      { from: 4, to: 5, marker: "*" },
      { from: 8, to: 9, marker: "+" },
    ]);
  });

  it("preserves marker offsets with indentation", () => {
    expect(parseListItems("  - nested")).toEqual([
      { from: 2, to: 3, marker: "-" },
    ]);
  });

  it("requires whitespace after the marker", () => {
    expect(parseListItems("-not a list")).toEqual([]);
  });

  it("skips fenced code blocks", () => {
    const markdown = "```\n- hidden\n```\n- visible";
    expect(parseListItems(markdown)).toEqual([
      { from: 17, to: 18, marker: "-" },
    ]);
  });
});
