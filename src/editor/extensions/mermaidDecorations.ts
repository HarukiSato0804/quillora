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
import { parseMermaidBlocks } from "../parser/parseMermaidBlocks";

// Mermaid is heavy, so it is loaded lazily the first time a diagram is
// actually rendered.
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid(): Promise<typeof import("mermaid").default> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((module) => {
      module.default.initialize({
        startOnLoad: false,
        theme: "base",
        securityLevel: "strict",
        themeVariables: {
          primaryColor: "#f0f4f8",
          primaryBorderColor: "#c1cad4",
          primaryTextColor: "#1f2328",
          secondaryColor: "#eef2f6",
          secondaryBorderColor: "#c1cad4",
          tertiaryColor: "#f6f8fa",
          lineColor: "#8c95a1",
          textColor: "#1f2328",
          fontSize: "13px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', sans-serif",
        },
      });
      return module.default;
    });
  }
  return mermaidPromise;
}

let renderCounter = 0;

class MermaidWidget extends WidgetType {
  constructor(private readonly code: string) {
    super();
  }

  eq(other: MermaidWidget): boolean {
    return other.code === this.code;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-md-mermaid";
    wrapper.textContent = "Rendering diagram…";

    const code = this.code;
    renderCounter += 1;
    const renderId = `markflow-mermaid-${renderCounter}`;

    loadMermaid()
      .then((mermaid) => mermaid.render(renderId, code))
      .then(({ svg }) => {
        wrapper.innerHTML = svg;
      })
      .catch((error: unknown) => {
        wrapper.textContent = `Mermaid error: ${String(error)}`;
        wrapper.classList.add("cm-md-mermaid-error");
        // Mermaid leaves an orphaned error element behind on failure.
        document.getElementById(`d${renderId}`)?.remove();
      });

    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export function buildMermaidDecorations(state: EditorState): DecorationSet {
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  const builder = new RangeSetBuilder<Decoration>();

  for (const block of parseMermaidBlocks(state.doc.toString())) {
    if (cursorLine >= block.fromLine && cursorLine <= block.toLine) {
      continue;
    }
    builder.add(
      state.doc.line(block.fromLine).from,
      state.doc.line(block.toLine).to,
      Decoration.replace({
        widget: new MermaidWidget(block.code),
        block: true,
      })
    );
  }

  return builder.finish();
}

export const mermaidDecorationsField = StateField.define<DecorationSet>({
  create: buildMermaidDecorations,
  update(decorations, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return buildMermaidDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function mermaidDecorations(): Extension {
  return [mermaidDecorationsField];
}
