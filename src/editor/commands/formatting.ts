// Pure Markdown formatting commands. Each function computes a
// TransactionSpec from an EditorState; dispatching is left to the caller
// so the logic stays unit-testable without a DOM.

import {
  EditorSelection,
  type EditorState,
  type TransactionSpec,
} from "@codemirror/state";

export function toggleInlineMarker(
  state: EditorState,
  marker: string
): TransactionSpec {
  const { from, to } = state.selection.main;
  const length = marker.length;
  const selected = state.sliceDoc(from, to);

  // Selection includes the markers: **bold** -> bold
  if (
    selected.length >= length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(length, selected.length - length);
    return {
      changes: { from, to, insert: inner },
      selection: EditorSelection.range(from, from + inner.length),
    };
  }

  // Markers surround the selection: **|bold|** -> bold
  const before = state.sliceDoc(Math.max(0, from - length), from);
  const after = state.sliceDoc(to, Math.min(state.doc.length, to + length));
  if (before === marker && after === marker) {
    return {
      changes: [
        { from: from - length, to: from, insert: "" },
        { from: to, to: to + length, insert: "" },
      ],
      selection: EditorSelection.range(from - length, to - length),
    };
  }

  // Empty cursor: insert a pair and place the cursor inside.
  if (from === to) {
    return {
      changes: { from, insert: marker + marker },
      selection: EditorSelection.cursor(from + length),
    };
  }

  // Wrap the selection.
  return {
    changes: [
      { from, insert: marker },
      { from: to, insert: marker },
    ],
    selection: EditorSelection.range(from + length, to + length),
  };
}

export function insertLink(state: EditorState): TransactionSpec {
  const { from, to } = state.selection.main;
  const text = state.sliceDoc(from, to);

  if (text.length > 0) {
    const insert = `[${text}](url)`;
    const urlStart = from + 1 + text.length + 2;
    return {
      changes: { from, to, insert },
      selection: EditorSelection.range(urlStart, urlStart + 3),
    };
  }

  const insert = "[label](url)";
  return {
    changes: { from, insert },
    selection: EditorSelection.range(from + 1, from + 6),
  };
}

type LineInfo = {
  from: number;
  text: string;
};

function selectedLines(state: EditorState): LineInfo[] {
  const { from, to } = state.selection.main;
  const first = state.doc.lineAt(from).number;
  const last = state.doc.lineAt(to).number;
  const lines: LineInfo[] = [];
  for (let n = first; n <= last; n++) {
    const line = state.doc.line(n);
    lines.push({ from: line.from, text: line.text });
  }
  return lines;
}

export function toggleLinePrefix(
  state: EditorState,
  prefix: string
): TransactionSpec {
  const lines = selectedLines(state);
  const allPrefixed = lines.every((line) => line.text.startsWith(prefix));

  if (allPrefixed) {
    return {
      changes: lines.map((line) => ({
        from: line.from,
        to: line.from + prefix.length,
        insert: "",
      })),
    };
  }
  return {
    changes: lines
      .filter((line) => !line.text.startsWith(prefix))
      .map((line) => ({ from: line.from, insert: prefix })),
  };
}

const ORDERED_PREFIX = /^\d+\. /;

export function toggleOrderedList(state: EditorState): TransactionSpec {
  const lines = selectedLines(state);
  const allNumbered = lines.every((line) => ORDERED_PREFIX.test(line.text));

  if (allNumbered) {
    return {
      changes: lines.map((line) => ({
        from: line.from,
        to: line.from + line.text.match(ORDERED_PREFIX)![0].length,
        insert: "",
      })),
    };
  }
  return {
    changes: lines.map((line, index) => ({
      from: line.from,
      insert: `${index + 1}. `,
    })),
  };
}

export function wrapCodeBlock(state: EditorState): TransactionSpec {
  const { from, to } = state.selection.main;
  const firstLine = state.doc.lineAt(from);
  const lastLine = state.doc.lineAt(to);
  return {
    changes: [
      { from: firstLine.from, insert: "```\n" },
      { from: lastLine.to, insert: "\n```" },
    ],
    // Cursor lands right after the opening fence so a language can be typed.
    selection: EditorSelection.cursor(firstLine.from + 3),
  };
}
