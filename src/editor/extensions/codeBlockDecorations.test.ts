import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { buildCodeBlockDecorations } from "./codeBlockDecorations";

type Collected = {
  from: number;
  to: number;
  class: string | undefined;
  isWidget: boolean;
};

function collect(doc: string): Collected[] {
  const state = EditorState.create({ doc });
  const found: Collected[] = [];
  buildCodeBlockDecorations(state).between(0, doc.length, (from, to, value) => {
    found.push({
      from,
      to,
      class: value.spec.class,
      isWidget: value.spec.widget !== undefined,
    });
  });
  return found;
}

describe("buildCodeBlockDecorations", () => {
  it("returns nothing without fences", () => {
    expect(collect("plain text")).toEqual([]);
  });

  it("marks first, middle, and last lines of a block", () => {
    const classes = collect("```\ncode\n```")
      .filter((d) => !d.isWidget)
      .map((d) => d.class);
    expect(classes).toEqual([
      "cm-md-codeblock cm-md-codeblock-first",
      "cm-md-codeblock",
      "cm-md-codeblock cm-md-codeblock-last",
    ]);
  });

  it("adds a language label widget on the opening fence line", () => {
    const widgets = collect("```python\ncode\n```").filter((d) => d.isWidget);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].from).toBe("```python".length);
  });

  it("adds no label without a language", () => {
    expect(collect("```\ncode\n```").some((d) => d.isWidget)).toBe(false);
  });

  it("marks a single-line unclosed fence as first and last", () => {
    const classes = collect("```js").filter((d) => !d.isWidget);
    expect(classes[0].class).toBe(
      "cm-md-codeblock cm-md-codeblock-first cm-md-codeblock-last"
    );
  });
});
