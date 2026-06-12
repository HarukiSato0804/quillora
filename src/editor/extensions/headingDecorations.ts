import {
  EditorState,
  RangeSetBuilder,
  StateField,
  type Extension,
} from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { detectHeadingMarker, parseHeadings } from "../parser/parseHeadings";

const headingLineDecorations = [1, 2, 3, 4, 5, 6].map((level) =>
  Decoration.line({ class: `cm-md-heading cm-md-heading-${level}` })
);

const hiddenMarker = Decoration.replace({});

const CLOSING_MARKER = /[ \t]+#+[ \t]*$/;

function selectionTouchesLine(
  state: EditorState,
  lineFrom: number,
  lineTo: number
): boolean {
  return state.selection.ranges.some(
    (range) => range.from <= lineTo && range.to >= lineFrom
  );
}

export function buildHeadingDecorations(state: EditorState): DecorationSet {
  const headings = parseHeadings(state.doc.toString());
  const builder = new RangeSetBuilder<Decoration>();

  for (const heading of headings) {
    const line = state.doc.line(heading.line);
    builder.add(line.from, line.from, headingLineDecorations[heading.level - 1]);

    // A line is active when the cursor is on it or the selection overlaps
    // it. IME composition always happens at the cursor, so the composing
    // line is active by the same rule.
    if (selectionTouchesLine(state, line.from, line.to)) {
      continue;
    }

    const marker = detectHeadingMarker(line.text);
    if (marker) {
      builder.add(line.from, line.from + marker.markerLength, hiddenMarker);
    }

    const closing = line.text.match(CLOSING_MARKER);
    if (closing && closing.index !== undefined) {
      const from = line.from + closing.index;
      builder.add(from, from + closing[0].length, hiddenMarker);
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
