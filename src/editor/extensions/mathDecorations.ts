import {
  EditorState,
  RangeSetBuilder,
  StateField,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import katex from "katex";
import { parseMath } from "../parser/parseMath";

class KatexWidget extends WidgetType {
  constructor(
    private readonly expr: string,
    private readonly displayMode: boolean
  ) {
    super();
  }

  eq(other: KatexWidget): boolean {
    return other.expr === this.expr && other.displayMode === this.displayMode;
  }

  toDOM(): HTMLElement {
    const element = document.createElement(
      this.displayMode ? "div" : "span"
    );
    element.className = this.displayMode
      ? "cm-md-math cm-md-math-block"
      : "cm-md-math";
    katex.render(this.expr, element, {
      throwOnError: false,
      displayMode: this.displayMode,
    });
    return element;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export function buildMathDecorations(state: EditorState): DecorationSet {
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  const { blocks, inline } = parseMath(state.doc.toString());
  const builder = new RangeSetBuilder<Decoration>();

  const ranges: Array<{
    from: number;
    to: number;
    decoration: Decoration;
  }> = [];

  for (const block of blocks) {
    if (cursorLine >= block.fromLine && cursorLine <= block.toLine) {
      continue;
    }
    if (block.expr === "") {
      continue;
    }
    ranges.push({
      from: state.doc.line(block.fromLine).from,
      to: state.doc.line(block.toLine).to,
      decoration: Decoration.replace({
        widget: new KatexWidget(block.expr, true),
        block: true,
      }),
    });
  }

  for (const span of inline) {
    if (span.line === cursorLine) {
      continue;
    }
    const line = state.doc.line(span.line);
    ranges.push({
      from: line.from + span.from,
      to: line.from + span.to,
      decoration: Decoration.replace({
        widget: new KatexWidget(span.expr, false),
      }),
    });
  }

  ranges.sort((a, b) => a.from - b.from);
  for (const range of ranges) {
    builder.add(range.from, range.to, range.decoration);
  }
  return builder.finish();
}

export const mathDecorationsField = StateField.define<DecorationSet>({
  create: buildMathDecorations,
  update(decorations, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return buildMathDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function mathDecorations(): Extension {
  return [mathDecorationsField];
}
