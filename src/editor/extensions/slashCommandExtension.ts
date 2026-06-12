import {
  autocompletion,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import {
  applySlashCommand,
  filterSlashCommands,
} from "../commands/slashCommands";

const slashMenuTheme = EditorView.theme({
  ".cm-tooltip.cm-tooltip-autocomplete": {
    background: "var(--q-surface-elevated, #fff)",
    border: "1px solid var(--q-border, rgba(16,24,40,0.10))",
    borderRadius: "8px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
    padding: "4px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: "13px",
    minWidth: "260px",
    maxWidth: "340px",
  },
  ".cm-completionList": {
    padding: "0",
    listStyle: "none",
    margin: "0",
  },
  ".cm-completionItem": {
    display: "flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    gap: "12px",
    color: "var(--q-text, #1d1d1f)",
    lineHeight: "1.4",
  },
  ".cm-completionItem[aria-selected='true']": {
    background: "var(--q-accent-soft, rgba(79,124,255,0.12))",
  },
  ".cm-completionLabel": {
    fontWeight: "500",
    flex: "0 0 130px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-completionDetail": {
    color: "var(--q-muted, #6e7681)",
    fontSize: "12px",
    flex: "1",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

function slashCompletionSource(context: CompletionContext) {
  const { state, pos } = context;
  const line = state.doc.lineAt(pos);
  const before = state.sliceDoc(line.from, pos);

  const match = before.match(/^(\s*)(\/\w*)$/);
  if (!match) return null;

  const slashOffset = match[1]?.length ?? 0;
  const from = line.from + slashOffset;
  const query = (match[2] ?? "").slice(1);

  const matched = filterSlashCommands(query);
  if (matched.length === 0) return null;

  const completions: Completion[] = matched.map((cmd) => ({
    label: "/" + cmd.id,
    displayLabel: cmd.title,
    detail: cmd.description,
    type: "text",
    apply: (view: EditorView, _c: Completion, cFrom: number, cTo: number) => {
      view.dispatch(applySlashCommand(cmd, cFrom, cTo));
    },
  }));

  return { from, options: completions, filter: false };
}

export function slashCommandExtension() {
  return [
    slashMenuTheme,
    autocompletion({
      override: [slashCompletionSource],
      activateOnTyping: true,
      closeOnBlur: true,
      icons: false,
    }),
  ];
}
