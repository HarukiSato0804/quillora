import { describe, expect, it } from "vitest";
import {
  EditorSelection,
  EditorState,
  type TransactionSpec,
} from "@codemirror/state";
import {
  insertLink,
  toggleInlineMarker,
  toggleLinePrefix,
  toggleOrderedList,
  wrapCodeBlock,
} from "./formatting";

function state(doc: string, anchor: number, head = anchor): EditorState {
  return EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
  });
}

function apply(s: EditorState, spec: TransactionSpec) {
  const tr = s.update(spec);
  return { doc: tr.state.doc.toString(), selection: tr.state.selection.main };
}

describe("toggleInlineMarker", () => {
  it("wraps a selection", () => {
    const s = state("hello world", 0, 5);
    const result = apply(s, toggleInlineMarker(s, "**"));
    expect(result.doc).toBe("**hello** world");
    expect([result.selection.from, result.selection.to]).toEqual([2, 7]);
  });

  it("unwraps when the selection includes the markers", () => {
    const s = state("**hello** world", 0, 9);
    const result = apply(s, toggleInlineMarker(s, "**"));
    expect(result.doc).toBe("hello world");
  });

  it("unwraps when markers surround the selection", () => {
    const s = state("**hello** world", 2, 7);
    const result = apply(s, toggleInlineMarker(s, "**"));
    expect(result.doc).toBe("hello world");
    expect([result.selection.from, result.selection.to]).toEqual([0, 5]);
  });

  it("inserts a pair at an empty cursor", () => {
    const s = state("ab", 1);
    const result = apply(s, toggleInlineMarker(s, "*"));
    expect(result.doc).toBe("a**b");
    expect(result.selection.head).toBe(2);
  });
});

describe("insertLink", () => {
  it("turns the selection into a link and selects the url placeholder", () => {
    const s = state("docs here", 0, 4);
    const result = apply(s, insertLink(s));
    expect(result.doc).toBe("[docs](url) here");
    expect(s.sliceDoc(0, 4)).toBe("docs");
    expect([result.selection.from, result.selection.to]).toEqual([7, 10]);
  });

  it("inserts a template at an empty cursor and selects the label", () => {
    const s = state("", 0);
    const result = apply(s, insertLink(s));
    expect(result.doc).toBe("[label](url)");
    expect([result.selection.from, result.selection.to]).toEqual([1, 6]);
  });
});

describe("toggleLinePrefix", () => {
  it("adds the prefix to every selected line", () => {
    const s = state("a\nb", 0, 3);
    expect(apply(s, toggleLinePrefix(s, "> ")).doc).toBe("> a\n> b");
  });

  it("removes the prefix when all lines have it", () => {
    const s = state("> a\n> b", 0, 7);
    expect(apply(s, toggleLinePrefix(s, "> ")).doc).toBe("a\nb");
  });

  it("only adds to lines missing the prefix in a mixed selection", () => {
    const s = state("- a\nb", 0, 5);
    expect(apply(s, toggleLinePrefix(s, "- ")).doc).toBe("- a\n- b");
  });
});

describe("toggleOrderedList", () => {
  it("numbers selected lines sequentially", () => {
    const s = state("a\nb\nc", 0, 5);
    expect(apply(s, toggleOrderedList(s)).doc).toBe("1. a\n2. b\n3. c");
  });

  it("removes numbering when all lines are numbered", () => {
    const s = state("1. a\n2. b", 0, 9);
    expect(apply(s, toggleOrderedList(s)).doc).toBe("a\nb");
  });
});

describe("wrapCodeBlock", () => {
  it("wraps the selected lines in a fence", () => {
    const s = state("code line", 2);
    expect(apply(s, wrapCodeBlock(s)).doc).toBe("```\ncode line\n```");
  });
});
