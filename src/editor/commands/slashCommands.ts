import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";

export type SlashCommandId =
  | "table"
  | "todo"
  | "bullet"
  | "numbered"
  | "code"
  | "quote"
  | "hr"
  | "mermaid"
  | "math"
  | "details";

type BuildResult = {
  text: string;
  cursorAnchor: number;
  cursorHead?: number;
};

export type SlashCommand = {
  id: SlashCommandId;
  title: string;
  aliases: string[];
  description: string;
  build(): BuildResult;
};

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "table",
    title: "Table",
    aliases: ["table"],
    description: "Insert a Markdown table",
    build() {
      const text = "| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n";
      return { text, cursorAnchor: 2, cursorHead: 10 };
    },
  },
  {
    id: "todo",
    title: "Todo",
    aliases: ["todo", "task", "checkbox"],
    description: "Insert a task list item",
    build() {
      const text = "- [ ] ";
      return { text, cursorAnchor: text.length };
    },
  },
  {
    id: "bullet",
    title: "Bullet list",
    aliases: ["bullet", "ul", "unordered"],
    description: "Insert an unordered list item",
    build() {
      const text = "- ";
      return { text, cursorAnchor: text.length };
    },
  },
  {
    id: "numbered",
    title: "Numbered list",
    aliases: ["numbered", "ol", "ordered"],
    description: "Insert an ordered list item",
    build() {
      const text = "1. ";
      return { text, cursorAnchor: text.length };
    },
  },
  {
    id: "code",
    title: "Code block",
    aliases: ["code", "fence", "codeblock"],
    description: "Insert a fenced code block",
    build() {
      const text = "```\n\n```\n";
      return { text, cursorAnchor: 3 };
    },
  },
  {
    id: "quote",
    title: "Quote",
    aliases: ["quote", "blockquote"],
    description: "Insert a block quote",
    build() {
      const text = "> ";
      return { text, cursorAnchor: text.length };
    },
  },
  {
    id: "hr",
    title: "Divider",
    aliases: ["hr", "divider", "rule", "line"],
    description: "Insert a horizontal rule",
    build() {
      const text = "---\n";
      return { text, cursorAnchor: text.length };
    },
  },
  {
    id: "mermaid",
    title: "Mermaid diagram",
    aliases: ["mermaid", "diagram", "chart", "graph"],
    description: "Insert a Mermaid diagram",
    build() {
      const text = "```mermaid\ngraph TD\n  A[Start] --> B[End]\n```\n";
      const anchor = "```mermaid\n".length;
      const head = anchor + "graph TD\n  A[Start] --> B[End]".length;
      return { text, cursorAnchor: anchor, cursorHead: head };
    },
  },
  {
    id: "math",
    title: "Math block",
    aliases: ["math", "latex", "equation"],
    description: "Insert a LaTeX math block",
    build() {
      const text = "$$\n\n$$\n";
      return { text, cursorAnchor: 3 };
    },
  },
  {
    id: "details",
    title: "Details",
    aliases: ["details", "collapse", "summary", "accordion"],
    description: "Insert a collapsible details block",
    build() {
      const text =
        "<details>\n<summary>Summary</summary>\n\nContent\n\n</details>\n";
      const anchor = "<details>\n<summary>".length;
      const head = anchor + "Summary".length;
      return { text, cursorAnchor: anchor, cursorHead: head };
    },
  },
];

export function filterSlashCommands(query: string): SlashCommand[] {
  if (!query) return SLASH_COMMANDS;
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.id.startsWith(q) ||
      cmd.title.toLowerCase().startsWith(q) ||
      cmd.aliases.some((a) => a.startsWith(q))
  );
}

export function findSlashTrigger(
  state: EditorState
): { from: number; to: number; query: string } | null {
  const sel = state.selection.main;
  if (sel.from !== sel.to) return null;

  const pos = sel.from;
  const line = state.doc.lineAt(pos);
  const beforeCursor = state.sliceDoc(line.from, pos);

  const match = beforeCursor.match(/^(\s*)(\/\w*)$/);
  if (!match) return null;

  const slashOffset = match[1]?.length ?? 0;
  const from = line.from + slashOffset;
  const query = (match[2] ?? "").slice(1);
  return { from, to: pos, query };
}

export function applySlashCommand(
  command: SlashCommand,
  from: number,
  to: number
): TransactionSpec {
  const { text, cursorAnchor, cursorHead } = command.build();
  const anchor = from + cursorAnchor;
  const head = cursorHead !== undefined ? from + cursorHead : anchor;
  return {
    changes: { from, to, insert: text },
    selection: EditorSelection.range(anchor, head),
  };
}
