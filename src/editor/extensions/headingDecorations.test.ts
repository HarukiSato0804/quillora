import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  buildHeadingDecorations,
  headingDecorationsField,
} from "./headingDecorations";

type CollectedDecoration = {
  from: number;
  to: number;
  class: string | undefined;
  replaced: boolean;
};

function collect(
  doc: string,
  selection: EditorSelection = EditorSelection.single(0)
): CollectedDecoration[] {
  const state = EditorState.create({ doc, selection });
  const decorations: CollectedDecoration[] = [];
  buildHeadingDecorations(state).between(0, doc.length, (from, to, value) => {
    decorations.push({
      from,
      to,
      class: value.spec.class,
      replaced: value.spec.class === undefined && value.spec.widget === undefined,
    });
  });
  return decorations;
}

function cursor(pos: number): EditorSelection {
  return EditorSelection.single(pos);
}

describe("buildHeadingDecorations", () => {
  it("returns no decorations for plain text", () => {
    expect(collect("just a paragraph")).toEqual([]);
  });

  it("adds a line decoration with the heading level", () => {
    const doc = "body\n\n## Section";
    const lineDecoration = collect(doc, cursor(0)).find((d) =>
      d.class?.includes("cm-md-heading-2")
    );
    expect(lineDecoration).toBeDefined();
    expect(lineDecoration!.from).toBe(6);
  });

  it("supports all six levels", () => {
    const doc = "# a\n## b\n### c\n#### d\n##### e\n###### f\n\ncursor";
    const classes = collect(doc, cursor(doc.length))
      .filter((d) => d.class?.includes("cm-md-heading-"))
      .map((d) => d.class);
    for (let level = 1; level <= 6; level++) {
      expect(classes.some((c) => c?.includes(`cm-md-heading-${level}`))).toBe(
        true
      );
    }
  });

  it("hides the leading marker when the line is inactive", () => {
    const doc = "## Title\n\nbody";
    const hidden = collect(doc, cursor(doc.length)).find((d) => d.replaced);
    expect(hidden).toBeDefined();
    // "## " = marker (2) + following space (1)
    expect(hidden!.from).toBe(0);
    expect(hidden!.to).toBe(3);
  });

  it("shows the marker when the cursor is on the heading line", () => {
    const decorations = collect("# Title", cursor(3));
    expect(decorations.some((d) => d.replaced)).toBe(false);
  });

  it("shows the marker when a selection overlaps the heading line", () => {
    const doc = "# Title\n\nbody";
    const overlapping = EditorSelection.single(5, doc.length);
    expect(collect(doc, overlapping).some((d) => d.replaced)).toBe(false);
  });

  it("keeps markers of empty headings visible", () => {
    const doc = "##\n\nbody";
    expect(collect(doc, cursor(doc.length)).some((d) => d.replaced)).toBe(
      false
    );
  });

  it("still mutes closing hash markers on inactive lines", () => {
    const doc = "## Section ##\n\nbody";
    const decorations = collect(doc, cursor(doc.length));
    const hidden = decorations.find((d) => d.replaced);
    expect(hidden).toMatchObject({ from: 0, to: 3 });
    const closing = decorations.find((d) =>
      d.class?.includes("cm-md-marker-muted")
    );
    expect(closing).toMatchObject({
      from: "## Section".length,
      to: "## Section ##".length,
    });
  });

  it("ignores headings inside fenced code blocks", () => {
    expect(collect("```\n# fake\n```")).toEqual([]);
  });

  it("recomputes when the selection moves across lines", () => {
    let state = EditorState.create({
      doc: "# Title\n\nbody",
      selection: EditorSelection.cursor(0),
      extensions: [headingDecorationsField],
    });

    const hiddenCount = (s: EditorState) => {
      let count = 0;
      s.field(headingDecorationsField).between(0, 3, (_f, _t, value) => {
        if (!value.spec.class) {
          count += 1;
        }
      });
      return count;
    };

    expect(hiddenCount(state)).toBe(0);

    state = state.update({
      selection: EditorSelection.cursor(state.doc.length),
    }).state;
    expect(hiddenCount(state)).toBe(1);
  });
});
