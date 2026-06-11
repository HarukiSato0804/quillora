import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { buildInlineDecorations } from "./inlineDecorations";

type CollectedDecoration = {
  from: number;
  to: number;
  class: string;
};

function collect(doc: string, cursor = 0): CollectedDecoration[] {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursor),
  });
  const decorations: CollectedDecoration[] = [];
  buildInlineDecorations(state).between(0, doc.length, (from, to, value) => {
    decorations.push({ from, to, class: value.spec.class });
  });
  return decorations;
}

describe("buildInlineDecorations", () => {
  it("decorates bold content", () => {
    const decorations = collect("**bold**\n\ncursor here", 12);
    const content = decorations.find((d) => d.class === "cm-md-bold");
    expect(content).toMatchObject({ from: 2, to: 6 });
  });

  it("mutes markers when the cursor is outside the span", () => {
    const decorations = collect("**bold**\n\ncursor here", 12);
    const markers = decorations.filter((d) =>
      d.class.includes("cm-md-inline-marker")
    );
    expect(markers).toHaveLength(2);
    expect(markers.every((m) => m.class.includes("cm-md-marker-muted"))).toBe(
      true
    );
  });

  it("shows markers when the cursor is inside the span", () => {
    const decorations = collect("**bold**", 4);
    const markers = decorations.filter((d) =>
      d.class.includes("cm-md-inline-marker")
    );
    expect(markers).toHaveLength(2);
    expect(markers.some((m) => m.class.includes("cm-md-marker-muted"))).toBe(
      false
    );
  });

  it("decorates italic, code, and link content with their own classes", () => {
    const doc = "*it* `code` [label](https://example.com)";
    const classes = collect(doc, 0).map((d) => d.class);
    expect(classes).toContain("cm-md-italic");
    expect(classes).toContain("cm-md-code");
    expect(classes).toContain("cm-md-link");
  });

  it("offsets decorations on later lines", () => {
    const decorations = collect("first\n**bold**", 0);
    const content = decorations.find((d) => d.class === "cm-md-bold");
    expect(content).toMatchObject({ from: 8, to: 12 });
  });

  it("skips fenced code blocks", () => {
    expect(collect("```\n**not bold**\n```")).toEqual([]);
  });
});
