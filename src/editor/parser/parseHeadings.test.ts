import { describe, expect, it } from "vitest";
import { detectHeadingMarker, parseHeadings } from "./parseHeadings";

describe("detectHeadingMarker", () => {
  it("detects levels 1 through 6 with marker length including whitespace", () => {
    expect(detectHeadingMarker("# a")).toEqual({ level: 1, markerLength: 2 });
    expect(detectHeadingMarker("###### a")).toEqual({
      level: 6,
      markerLength: 7,
    });
  });

  it("includes leading indent and multiple separator spaces", () => {
    expect(detectHeadingMarker("  ##  a")).toEqual({
      level: 2,
      markerLength: 6,
    });
  });

  it("accepts a tab separator", () => {
    expect(detectHeadingMarker("#\ta")).toEqual({ level: 1, markerLength: 2 });
  });

  it("rejects 7 or more hashes", () => {
    expect(detectHeadingMarker("####### a")).toBeNull();
  });

  it("rejects markers without following whitespace", () => {
    expect(detectHeadingMarker("#hash")).toBeNull();
  });

  it("rejects headings without text", () => {
    expect(detectHeadingMarker("## ")).toBeNull();
    expect(detectHeadingMarker("##")).toBeNull();
  });
});

describe("parseHeadings", () => {
  it("returns an empty list for empty text", () => {
    expect(parseHeadings("")).toEqual([]);
  });

  it("extracts ATX headings with levels and line numbers", () => {
    const text = "# Title\n\nbody\n\n## Section\n\n### Sub";
    expect(parseHeadings(text)).toEqual([
      { level: 1, text: "Title", line: 1 },
      { level: 2, text: "Section", line: 5 },
      { level: 3, text: "Sub", line: 7 },
    ]);
  });

  it("supports heading levels 1 through 6", () => {
    const text = "# a\n## b\n### c\n#### d\n##### e\n###### f";
    expect(parseHeadings(text).map((h) => h.level)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("ignores lines with 7 or more #", () => {
    expect(parseHeadings("####### too deep")).toEqual([]);
  });

  it("ignores # without a following space unless the line is only markers", () => {
    expect(parseHeadings("#not-a-heading")).toEqual([]);
  });

  it("allows empty headings", () => {
    expect(parseHeadings("##")).toEqual([{ level: 2, text: "", line: 1 }]);
  });

  it("strips closing hash markers", () => {
    expect(parseHeadings("## Section ##")).toEqual([
      { level: 2, text: "Section", line: 1 },
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    const text = "```\n# not a heading\n```\n# real";
    expect(parseHeadings(text)).toEqual([
      { level: 1, text: "real", line: 4 },
    ]);
  });

  it("handles tilde fences independently of backtick fences", () => {
    const text = "~~~\n# hidden\n~~~\n## visible";
    expect(parseHeadings(text)).toEqual([
      { level: 2, text: "visible", line: 4 },
    ]);
  });

  it("allows up to three leading spaces", () => {
    expect(parseHeadings("   # indented")).toEqual([
      { level: 1, text: "indented", line: 1 },
    ]);
  });
});
