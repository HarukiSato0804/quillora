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
import { parseListItems } from "../parser/parseListItems";
import { parseTaskListItems } from "../parser/parseTaskListItems";

class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = "cm-md-list-marker";
    marker.textContent = "•";
    return marker;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const listLine = Decoration.line({ class: "cm-md-list-line" });
const bulletMarker = Decoration.replace({ widget: new BulletWidget() });

function selectionTouchesLine(
  state: EditorState,
  lineFrom: number,
  lineTo: number
): boolean {
  return state.selection.ranges.some(
    (range) => range.from <= lineTo && range.to >= lineFrom
  );
}

export function buildListDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc.toString();

  // Task list lines are handled by taskListDecorations — skip them here
  const taskFroms = new Set(parseTaskListItems(doc).map((t) => t.from));

  for (const item of parseListItems(doc)) {
    if (taskFroms.has(item.from)) continue;
    const line = state.doc.lineAt(item.from);
    builder.add(line.from, line.from, listLine);
    if (!selectionTouchesLine(state, line.from, line.to)) {
      builder.add(item.from, item.to, bulletMarker);
    }
  }

  return builder.finish();
}

export const listDecorationsField = StateField.define<DecorationSet>({
  create: buildListDecorations,
  update(decorations, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return buildListDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function listDecorations(): Extension {
  return [listDecorationsField];
}
