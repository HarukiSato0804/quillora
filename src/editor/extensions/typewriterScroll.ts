import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

// Keeps the cursor line vertically centered while typing or moving the
// selection. The re-center dispatch runs in an animation frame because
// dispatching from within an update listener is not allowed.
export function typewriterScroll(): Extension {
  return [
    EditorView.theme({
      ".cm-scroller": {
        paddingTop: "38vh",
        paddingBottom: "38vh",
      },
    }),
    EditorView.updateListener.of((update) => {
      if (!update.selectionSet) {
        return;
      }
      const view = update.view;
      const head = view.state.selection.main.head;
      requestAnimationFrame(() => {
        view.dispatch({
          effects: EditorView.scrollIntoView(head, { y: "center" }),
        });
      });
    }),
  ];
}
