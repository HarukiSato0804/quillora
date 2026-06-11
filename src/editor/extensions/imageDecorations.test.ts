import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { buildImageDecorations } from "./imageDecorations";

function ranges(doc: string, cursor = 0): Array<{ from: number; to: number }> {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursor),
  });
  const decorations = buildImageDecorations(state, {
    baseDir: "/docs",
    toAssetUrl: (path) => `asset:${path}`,
  });
  const found: Array<{ from: number; to: number }> = [];
  decorations.between(0, doc.length, (from, to) => {
    found.push({ from, to });
  });
  return found;
}

describe("buildImageDecorations", () => {
  it("replaces the image syntax when the cursor is on another line", () => {
    const doc = "![a](x.png)\n\ncursor";
    expect(ranges(doc, doc.length)).toEqual([{ from: 0, to: 11 }]);
  });

  it("keeps the source visible when the cursor is on the image line", () => {
    expect(ranges("![a](x.png)", 3)).toEqual([]);
  });

  it("skips unresolvable relative urls", () => {
    const state = EditorState.create({
      doc: "![a](x.png)\n\ncursor",
      selection: EditorSelection.cursor(15),
    });
    const decorations = buildImageDecorations(state, {
      baseDir: null,
      toAssetUrl: (path) => `asset:${path}`,
    });
    let count = 0;
    decorations.between(0, state.doc.length, () => {
      count += 1;
    });
    expect(count).toBe(0);
  });

  it("skips images inside fenced code blocks", () => {
    const doc = "```\n![a](x.png)\n```\ncursor";
    expect(ranges(doc, doc.length)).toEqual([]);
  });
});
