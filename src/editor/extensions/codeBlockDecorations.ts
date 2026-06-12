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
import { parseCodeBlocks } from "../parser/parseCodeBlocks";

class LanguageLabelWidget extends WidgetType {
  constructor(private readonly lang: string) {
    super();
  }

  eq(other: LanguageLabelWidget): boolean {
    return other.lang === this.lang;
  }

  toDOM(): HTMLElement {
    const label = document.createElement("span");
    label.className = "cm-md-codeblock-lang";
    label.textContent = this.lang;
    return label;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const lineDecorationCache = new Map<string, Decoration>();

function lineDecoration(classes: string): Decoration {
  let decoration = lineDecorationCache.get(classes);
  if (!decoration) {
    decoration = Decoration.line({ class: classes });
    lineDecorationCache.set(classes, decoration);
  }
  return decoration;
}

const hiddenFence = Decoration.replace({});

export function buildCodeBlockDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursorPos = state.selection.main.head;
  const cursorLine = state.doc.lineAt(cursorPos).number;

  for (const block of parseCodeBlocks(state.doc.toString())) {
    const closingFenceEnd = block.closed ? state.doc.line(block.toLine).to : -1;
    const isActive =
      cursorLine >= block.fromLine &&
      cursorLine <= block.toLine &&
      cursorPos !== closingFenceEnd;

    for (let n = block.fromLine; n <= block.toLine; n++) {
      const line = state.doc.line(n);
      let classes = "cm-md-codeblock";
      if (n === block.fromLine) classes += " cm-md-codeblock-first";
      if (n === block.toLine) classes += " cm-md-codeblock-last";

      builder.add(line.from, line.from, lineDecoration(classes));

      const isFenceLine =
        n === block.fromLine || (n === block.toLine && block.closed);

      if (!isActive && isFenceLine) {
        // Visually hide fence text; the language badge widget is still rendered.
        builder.add(line.from, line.to, hiddenFence);
      }

      if (n === block.fromLine && block.lang) {
        builder.add(
          line.to,
          line.to,
          Decoration.widget({
            widget: new LanguageLabelWidget(block.lang),
            side: 1,
          })
        );
      }
    }
  }

  return builder.finish();
}

export const codeBlockDecorationsField = StateField.define<DecorationSet>({
  create: buildCodeBlockDecorations,
  update(decorations, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return buildCodeBlockDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function codeBlockDecorations(): Extension {
  return [codeBlockDecorationsField];
}
