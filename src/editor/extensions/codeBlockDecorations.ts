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

export function buildCodeBlockDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const block of parseCodeBlocks(state.doc.toString())) {
    for (let n = block.fromLine; n <= block.toLine; n++) {
      const line = state.doc.line(n);
      let classes = "cm-md-codeblock";
      if (n === block.fromLine) {
        classes += " cm-md-codeblock-first";
      }
      if (n === block.toLine) {
        classes += " cm-md-codeblock-last";
      }
      builder.add(line.from, line.from, lineDecoration(classes));

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
    if (transaction.docChanged) {
      return buildCodeBlockDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function codeBlockDecorations(): Extension {
  return [codeBlockDecorationsField];
}
