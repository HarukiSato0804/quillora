import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  buildHeadingDecorations,
  headingDecorationsField,
} from "./headingDecorations";

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
  buildHeadingDecorations(state).between(0, doc.length, (from, to, value) => {
    decorations.push({ from, to, class: value.spec.class });
  });
  return decorations;
}

describe("buildHeadingDecorations", () => {
  it("returns no decorations for plain text", () => {
    expect(collect("just a paragraph")).toEqual([]);
  });

  it("adds a line decoration with the heading level", () => {
    const decorations = collect("body\n\n## Section", 0);
    const lineDecoration = decorations.find((d) =>
      d.class.includes("cm-md-heading-2")
    );
    expect(lineDecoration).toBeDefined();
    expect(lineDecoration!.from).toBe(6);
  });

  it("supports all six levels", () => {
    const doc = "# a\n## b\n### c\n#### d\n##### e\n###### f";
    const classes = collect(doc)
      .filter((d) => d.class.includes("cm-md-heading-"))
      .map((d) => d.class);
    for (let level = 1; level <= 6; level++) {
      expect(classes.some((c) => c.includes(`cm-md-heading-${level}`))).toBe(
        true
      );
    }
  });

  it("mutes the # markers when the cursor is on another line", () => {
    const doc = "# Title\n\nbody";
    const decorations = collect(doc, doc.length);
    const marker = decorations.find((d) =>
      d.class.includes("cm-md-heading-marker")
    );
    expect(marker).toBeDefined();
    expect(marker!.class).toContain("cm-md-marker-muted");
    expect(marker!.from).toBe(0);
    expect(marker!.to).toBe(1);
  });

  it("shows the # markers normally when the cursor is on the heading line", () => {
    const decorations = collect("# Title", 3);
    const marker = decorations.find((d) =>
      d.class.includes("cm-md-heading-marker")
    );
    expect(marker).toBeDefined();
    expect(marker!.class).not.toContain("cm-md-marker-muted");
  });

  it("also decorates closing hash markers", () => {
    const doc = "## Section ##\n\nbody";
    const markers = collect(doc, doc.length).filter((d) =>
      d.class.includes("cm-md-heading-marker")
    );
    expect(markers).toHaveLength(2);
    expect(markers[1].from).toBe("## Section".length);
    expect(markers[1].to).toBe("## Section ##".length);
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

    const markerClassAt = (s: EditorState) => {
      let found = "";
      s.field(headingDecorationsField).between(0, 1, (_f, _t, value) => {
        if (value.spec.class.includes("cm-md-heading-marker")) {
          found = value.spec.class;
        }
      });
      return found;
    };

    expect(markerClassAt(state)).not.toContain("cm-md-marker-muted");

    state = state.update({
      selection: EditorSelection.cursor(state.doc.length),
    }).state;
    expect(markerClassAt(state)).toContain("cm-md-marker-muted");
  });
});
