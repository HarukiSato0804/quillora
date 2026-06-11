import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { buildMermaidDecorations } from "./mermaidDecorations";

function ranges(doc: string, cursor = 0): Array<{ from: number; to: number }> {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursor),
  });
  const found: Array<{ from: number; to: number }> = [];
  buildMermaidDecorations(state).between(0, doc.length, (from, to) => {
    found.push({ from, to });
  });
  return found;
}

const DIAGRAM = "```mermaid\ngraph TD\nA --> B\n```";

describe("buildMermaidDecorations", () => {
  it("replaces the diagram when the cursor is outside it", () => {
    const doc = `${DIAGRAM}\n\ncursor`;
    expect(ranges(doc, doc.length)).toEqual([{ from: 0, to: DIAGRAM.length }]);
  });

  it("keeps the source when the cursor is inside the block", () => {
    expect(ranges(DIAGRAM, 12)).toEqual([]);
  });

  it("ignores other code fences", () => {
    const doc = "```js\nlet a = 1\n```\ncursor";
    expect(ranges(doc, doc.length)).toEqual([]);
  });
});
