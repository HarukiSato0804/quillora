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
import { parseTaskListItems } from "../parser/parseTaskListItems";

class TaskCheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly checkboxFrom: number,
    private readonly checkboxTo: number
  ) {
    super();
  }

  eq(other: TaskCheckboxWidget): boolean {
    return (
      this.checked === other.checked &&
      this.checkboxFrom === other.checkboxFrom
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.className = "cm-md-task-checkbox";
    checkbox.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    checkbox.addEventListener("click", (e) => {
      e.preventDefault();
      view.dispatch({
        changes: {
          from: this.checkboxFrom,
          to: this.checkboxTo,
          insert: this.checked ? "[ ]" : "[x]",
        },
      });
    });
    return checkbox;
  }

  ignoreEvent(e: Event): boolean {
    return e.type !== "mousedown" && e.type !== "click";
  }
}

const taskListLine = Decoration.line({ class: "cm-md-task-line" });
const checkedLine = Decoration.line({ class: "cm-md-task-line cm-md-task-checked" });

function selectionTouchesLine(
  state: EditorState,
  lineFrom: number,
  lineTo: number
): boolean {
  return state.selection.ranges.some(
    (range) => range.from <= lineTo && range.to >= lineFrom
  );
}

export function buildTaskListDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc.toString();

  for (const item of parseTaskListItems(doc)) {
    const line = state.doc.lineAt(item.from);
    const lineClass = item.checked ? checkedLine : taskListLine;
    builder.add(line.from, line.from, lineClass);

    if (!selectionTouchesLine(state, line.from, line.to)) {
      const widget = new TaskCheckboxWidget(
        item.checked,
        item.checkboxFrom,
        item.checkboxTo
      );
      builder.add(item.from, item.to, Decoration.replace({ widget }));
    }
  }

  return builder.finish();
}

export const taskListDecorationsField = StateField.define<DecorationSet>({
  create: buildTaskListDecorations,
  update(decorations, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return buildTaskListDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function taskListDecorations(): Extension {
  return [taskListDecorationsField];
}

export function getTaskListPaths(doc: string): Set<number> {
  const paths = new Set<number>();
  for (const item of parseTaskListItems(doc)) {
    paths.add(item.from);
  }
  return paths;
}
