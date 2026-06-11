import { describe, expect, it } from "vitest";
import { parseTables } from "./parseTables";

const SIMPLE = "| a | b |\n| --- | --- |\n| 1 | 2 |";

describe("parseTables", () => {
  it("returns nothing for plain text", () => {
    expect(parseTables("no table")).toEqual([]);
  });

  it("parses a simple table", () => {
    expect(parseTables(SIMPLE)).toEqual([
      {
        fromLine: 1,
        toLine: 3,
        header: ["a", "b"],
        align: [null, null],
        rows: [["1", "2"]],
      },
    ]);
  });

  it("parses alignments from the delimiter row", () => {
    const text = "| l | c | r |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |";
    expect(parseTables(text)[0].align).toEqual(["left", "center", "right"]);
  });

  it("requires a delimiter row", () => {
    expect(parseTables("| a | b |\n| 1 | 2 |")).toEqual([]);
  });

  it("requires delimiter width to match the header", () => {
    expect(parseTables("| a | b |\n| --- |\n| 1 | 2 |")).toEqual([]);
  });

  it("stops the table at the first non-row line", () => {
    const text = `${SIMPLE}\n\nparagraph`;
    expect(parseTables(text)[0].toLine).toBe(3);
  });

  it("pads short rows and truncates long rows", () => {
    const text = "| a | b |\n| --- | --- |\n| 1 |\n| 1 | 2 | 3 |";
    expect(parseTables(text)[0].rows).toEqual([
      ["1", ""],
      ["1", "2"],
    ]);
  });

  it("ignores tables inside fenced code blocks", () => {
    expect(parseTables("```\n| a |\n| --- |\n```")).toEqual([]);
  });

  it("parses tables without outer pipes", () => {
    const text = "a | b\n--- | ---\n1 | 2";
    expect(parseTables(text)).toHaveLength(1);
  });
});
