import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { buildMathDecorations } from "./mathDecorations";

function ranges(doc: string, cursor = 0): Array<{ from: number; to: number }> {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursor),
  });
  const found: Array<{ from: number; to: number }> = [];
  buildMathDecorations(state).between(0, doc.length, (from, to) => {
    found.push({ from, to });
  });
  return found;
}

describe("buildMathDecorations", () => {
  it("replaces inline math when the cursor is elsewhere", () => {
    const doc = "$x^2$\n\ncursor";
    expect(ranges(doc, doc.length)).toEqual([{ from: 0, to: 5 }]);
  });

  it("keeps inline math source when the cursor is on its line", () => {
    expect(ranges("$x^2$", 2)).toEqual([]);
  });

  it("replaces a block when the cursor is outside it", () => {
    const doc = "$$\nx^2\n$$\ncursor";
    expect(ranges(doc, doc.length)).toEqual([{ from: 0, to: 9 }]);
  });

  it("keeps block source when the cursor is inside the block", () => {
    const doc = "$$\nx^2\n$$\nafter";
    expect(ranges(doc, 4)).toEqual([]);
  });

  it("skips empty blocks", () => {
    const doc = "$$\n$$\ncursor";
    expect(ranges(doc, doc.length)).toEqual([]);
  });
});
