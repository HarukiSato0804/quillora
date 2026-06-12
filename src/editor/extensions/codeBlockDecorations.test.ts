import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import type { Decoration } from "@codemirror/view";
import { buildCodeBlockDecorations } from "./codeBlockDecorations";

type Collected = {
  from: number;
  to: number;
  class: string | undefined;
  isWidget: boolean;
  isReplace: boolean;
};

function isReplaceDecoration(value: Decoration): boolean {
  return "isReplace" in value && value.isReplace === true;
}

function collectAt(doc: string, cursorPos = 0): Collected[] {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursorPos },
  });
  const found: Collected[] = [];
  buildCodeBlockDecorations(state).between(0, doc.length, (from, to, value) => {
    found.push({
      from,
      to,
      class: value.spec.class,
      isWidget: value.spec.widget !== undefined,
      isReplace: isReplaceDecoration(value),
    });
  });
  return found;
}

// Simpler helper: just class names for line decorations
function classesAt(doc: string, cursorPos = 0): string[] {
  return collectAt(doc, cursorPos)
    .filter((d) => d.class !== undefined)
    .map((d) => d.class as string);
}

// Count replace decorations (hidden fence markers)
function replaceCount(doc: string, cursorPos = 0): number {
  return collectAt(doc, cursorPos).filter((d) => d.isReplace).length;
}

const DOC = "```python\ncode\n```";
// Positions: line 1 = 0..8 (```python), line 2 = 10..13 (code), line 3 = 15..17 (```)

describe("buildCodeBlockDecorations", () => {
  it("returns nothing without fences", () => {
    expect(collectAt("plain text")).toEqual([]);
  });

  it("marks first, middle, and last lines of a block", () => {
    const classes = classesAt("```\ncode\n```");
    expect(classes).toEqual([
      "cm-md-codeblock cm-md-codeblock-first",
      "cm-md-codeblock",
      "cm-md-codeblock cm-md-codeblock-last",
    ]);
  });

  it("adds a language label widget on the opening fence line", () => {
    // cursor outside block (position 0 = opening fence, which IS active, so move cursor after block)
    const afterBlock = DOC.length;
    const widgets = collectAt(DOC, afterBlock).filter((d) => d.isWidget);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].from).toBe("```python".length);
  });

  it("adds no label without a language", () => {
    expect(collectAt("```\ncode\n```").some((d) => d.isWidget)).toBe(false);
  });

  it("marks a single-line unclosed fence as first and last", () => {
    const classes = classesAt("```js");
    expect(classes[0]).toBe(
      "cm-md-codeblock cm-md-codeblock-first cm-md-codeblock-last"
    );
  });

  it("hides opening and closing fence lines when cursor is outside", () => {
    // cursor after the block
    expect(replaceCount(DOC, DOC.length)).toBe(2);
  });

  it("does not hide fences when cursor is on the opening fence line", () => {
    expect(replaceCount(DOC, 0)).toBe(0);
  });

  it("does not hide fences when cursor is inside the code block", () => {
    // cursor on 'code' line (position 10)
    expect(replaceCount(DOC, 10)).toBe(0);
  });

  it("does not hide fences when cursor is on the closing fence line", () => {
    // cursor on closing ``` line (position 15)
    expect(replaceCount(DOC, 15)).toBe(0);
  });

  it("does not hide closing fence of unclosed block even when cursor is before the block", () => {
    // cursor on line before the block so block is inactive; no closing fence exists
    const unclosed = "intro\n```js\ncode";
    // cursor at position 0 (before block, block starts at line 2)
    expect(replaceCount(unclosed, 0)).toBe(1); // only opening fence hidden, no closing fence
  });

  it("language badge still appears when fence is hidden", () => {
    const afterBlock = DOC.length;
    const items = collectAt(DOC, afterBlock);
    expect(items.some((d) => d.isWidget)).toBe(true);
  });
});
