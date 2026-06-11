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
import { parseTables, type TableBlock } from "../parser/parseTables";

class TableWidget extends WidgetType {
  constructor(private readonly table: TableBlock) {
    super();
  }

  eq(other: TableWidget): boolean {
    return JSON.stringify(other.table) === JSON.stringify(this.table);
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-md-table";
    const table = document.createElement("table");

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    this.table.header.forEach((cell, column) => {
      const th = document.createElement("th");
      th.textContent = cell;
      const align = this.table.align[column];
      if (align) {
        th.style.textAlign = align;
      }
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const row of this.table.rows) {
      const tr = document.createElement("tr");
      row.forEach((cell, column) => {
        const td = document.createElement("td");
        td.textContent = cell;
        const align = this.table.align[column];
        if (align) {
          td.style.textAlign = align;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    wrapper.appendChild(table);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export function buildTableDecorations(state: EditorState): DecorationSet {
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  const builder = new RangeSetBuilder<Decoration>();

  for (const table of parseTables(state.doc.toString())) {
    if (cursorLine >= table.fromLine && cursorLine <= table.toLine) {
      continue;
    }
    builder.add(
      state.doc.line(table.fromLine).from,
      state.doc.line(table.toLine).to,
      Decoration.replace({ widget: new TableWidget(table), block: true })
    );
  }

  return builder.finish();
}

export const tableDecorationsField = StateField.define<DecorationSet>({
  create: buildTableDecorations,
  update(decorations, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return buildTableDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function tableDecorations(): Extension {
  return [tableDecorationsField];
}
