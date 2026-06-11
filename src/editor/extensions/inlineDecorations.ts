import {
  EditorState,
  RangeSetBuilder,
  StateField,
  type Extension,
} from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { parseInlineSpans, type InlineSpanType } from "../parser/parseInlineSpans";

const contentDecorations: Record<InlineSpanType, Decoration> = {
  bold: Decoration.mark({ class: "cm-md-bold" }),
  italic: Decoration.mark({ class: "cm-md-italic" }),
  code: Decoration.mark({ class: "cm-md-code" }),
  link: Decoration.mark({ class: "cm-md-link" }),
};

const mutedMarker = Decoration.mark({
  class: "cm-md-inline-marker cm-md-marker-muted",
});
const visibleMarker = Decoration.mark({ class: "cm-md-inline-marker" });

const FENCE = /^ {0,3}(```|~~~)/;

export function buildInlineDecorations(state: EditorState): DecorationSet {
  const cursor = state.selection.main.head;
  const ranges: Array<{ from: number; to: number; decoration: Decoration }> =
    [];

  let insideFence = false;
  let fenceMarker = "";

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber);

    const fenceMatch = line.text.match(FENCE);
    if (fenceMatch) {
      if (!insideFence) {
        insideFence = true;
        fenceMarker = fenceMatch[1];
      } else if (fenceMatch[1] === fenceMarker) {
        insideFence = false;
      }
      continue;
    }
    if (insideFence) {
      continue;
    }

    for (const span of parseInlineSpans(line.text)) {
      const spanFrom = line.from + span.from;
      const spanTo = line.from + span.to;
      const cursorInside = cursor >= spanFrom && cursor <= spanTo;
      const marker = cursorInside ? visibleMarker : mutedMarker;

      for (const markerRange of span.markers) {
        ranges.push({
          from: line.from + markerRange.from,
          to: line.from + markerRange.to,
          decoration: marker,
        });
      }
      ranges.push({
        from: line.from + span.content.from,
        to: line.from + span.content.to,
        decoration: contentDecorations[span.type],
      });
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  const builder = new RangeSetBuilder<Decoration>();
  for (const range of ranges) {
    builder.add(range.from, range.to, range.decoration);
  }
  return builder.finish();
}

export const inlineDecorationsField = StateField.define<DecorationSet>({
  create: buildInlineDecorations,
  update(decorations, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return buildInlineDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function inlineDecorations(): Extension {
  return [inlineDecorationsField];
}
