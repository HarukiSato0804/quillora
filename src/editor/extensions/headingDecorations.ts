import {
  EditorState,
  RangeSetBuilder,
  StateField,
  type Extension,
} from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { parseHeadings } from "../parser/parseHeadings";

const headingLineDecorations = [1, 2, 3, 4, 5, 6].map((level) =>
  Decoration.line({ class: `cm-md-heading cm-md-heading-${level}` })
);

const mutedMarker = Decoration.mark({
  class: "cm-md-heading-marker cm-md-marker-muted",
});
const visibleMarker = Decoration.mark({ class: "cm-md-heading-marker" });

const OPENING_MARKER = /^( {0,3})#{1,6}/;
const CLOSING_MARKER = /[ \t]+#+[ \t]*$/;

export function buildHeadingDecorations(state: EditorState): DecorationSet {
  const headings = parseHeadings(state.doc.toString());
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  const builder = new RangeSetBuilder<Decoration>();

  for (const heading of headings) {
    const line = state.doc.line(heading.line);
    builder.add(line.from, line.from, headingLineDecorations[heading.level - 1]);

    const marker = line.number === cursorLine ? visibleMarker : mutedMarker;

    const opening = line.text.match(OPENING_MARKER);
    if (opening) {
      const from = line.from + opening[1].length;
      builder.add(from, from + heading.level, marker);
    }

    const closing = line.text.match(CLOSING_MARKER);
    if (closing && closing.index !== undefined) {
      const from = line.from + closing.index;
      builder.add(from, from + closing[0].length, marker);
    }
  }

  return builder.finish();
}

export const headingDecorationsField = StateField.define<DecorationSet>({
  create: buildHeadingDecorations,
  update(decorations, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return buildHeadingDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function headingDecorations(): Extension {
  return [headingDecorationsField];
}
