import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { buildTableDecorations } from "./tableDecorations";

function ranges(doc: string, cursor = 0): Array<{ from: number; to: number }> {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursor),
  });
  const found: Array<{ from: number; to: number }> = [];
  buildTableDecorations(state).between(0, doc.length, (from, to) => {
    found.push({ from, to });
  });
  return found;
}

const TABLE = "| a | b |\n| --- | --- |\n| 1 | 2 |";

describe("buildTableDecorations", () => {
  it("replaces the table when the cursor is outside it", () => {
    const doc = `${TABLE}\n\ncursor`;
    expect(ranges(doc, doc.length)).toEqual([{ from: 0, to: TABLE.length }]);
  });

  it("keeps the source when the cursor is inside the table", () => {
    expect(ranges(TABLE, 4)).toEqual([]);
  });
});
