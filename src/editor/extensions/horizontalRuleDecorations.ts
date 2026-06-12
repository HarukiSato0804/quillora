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
import { parseHorizontalRules } from "../parser/parseHorizontalRules";

class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const rule = document.createElement("hr");
    rule.className = "cm-md-hr";
    return rule;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const horizontalRule = Decoration.replace({
  widget: new HorizontalRuleWidget(),
  block: true,
});

function selectionTouchesLine(
  state: EditorState,
  lineFrom: number,
  lineTo: number
): boolean {
  return state.selection.ranges.some(
    (range) => range.from <= lineTo && range.to >= lineFrom
  );
}

export function buildHorizontalRuleDecorations(
  state: EditorState
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const rule of parseHorizontalRules(state.doc.toString())) {
    const line = state.doc.lineAt(rule.from);
    if (!selectionTouchesLine(state, line.from, line.to)) {
      builder.add(rule.from, rule.to, horizontalRule);
    }
  }

  return builder.finish();
}

export const horizontalRuleDecorationsField =
  StateField.define<DecorationSet>({
    create: buildHorizontalRuleDecorations,
    update(decorations, transaction) {
      if (transaction.docChanged || transaction.selection) {
        return buildHorizontalRuleDecorations(transaction.state);
      }
      return decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
  });

export function horizontalRuleDecorations(): Extension {
  return [horizontalRuleDecorationsField];
}
