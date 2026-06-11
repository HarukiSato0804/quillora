// Lightweight inline Markdown scanner for visual decorations.
//
// Known limitations (intentionally not full CommonMark):
// - Only `*`-style emphasis is recognized; `_em_` and `__strong__` are ignored.
// - Nested emphasis (e.g. bold inside italic or inside link labels) is not
//   decorated; the outermost recognized span wins.
// - Escapes (\*) and multi-line spans are not handled.
// - Reference-style links and autolinks are not handled.

export type InlineSpanType = "code" | "bold" | "italic" | "link";

export type MarkerRange = {
  from: number;
  to: number;
};

export type InlineSpan = {
  type: InlineSpanType;
  from: number;
  to: number;
  content: MarkerRange;
  markers: MarkerRange[];
};

const CODE = /`([^`\n]+)`/g;
const BOLD = /\*\*([^*\n]+)\*\*/g;
const ITALIC = /(?<!\*)\*([^*\s\n](?:[^*\n]*[^*\s\n])?)\*(?!\*)/g;
const LINK = /(?<!!)\[([^\]\n]+)\]\(([^()\n]*)\)/g;

function overlaps(from: number, to: number, spans: InlineSpan[]): boolean {
  return spans.some((span) => from < span.to && to > span.from);
}

export function parseInlineSpans(lineText: string): InlineSpan[] {
  const spans: InlineSpan[] = [];

  for (const match of lineText.matchAll(CODE)) {
    const from = match.index;
    const to = from + match[0].length;
    spans.push({
      type: "code",
      from,
      to,
      content: { from: from + 1, to: to - 1 },
      markers: [
        { from, to: from + 1 },
        { from: to - 1, to },
      ],
    });
  }

  for (const match of lineText.matchAll(BOLD)) {
    const from = match.index;
    const to = from + match[0].length;
    if (overlaps(from, to, spans)) continue;
    spans.push({
      type: "bold",
      from,
      to,
      content: { from: from + 2, to: to - 2 },
      markers: [
        { from, to: from + 2 },
        { from: to - 2, to },
      ],
    });
  }

  for (const match of lineText.matchAll(ITALIC)) {
    const from = match.index;
    const to = from + match[0].length;
    if (overlaps(from, to, spans)) continue;
    spans.push({
      type: "italic",
      from,
      to,
      content: { from: from + 1, to: to - 1 },
      markers: [
        { from, to: from + 1 },
        { from: to - 1, to },
      ],
    });
  }

  for (const match of lineText.matchAll(LINK)) {
    const from = match.index;
    const to = from + match[0].length;
    if (overlaps(from, to, spans)) continue;
    const labelEnd = from + 1 + match[1].length;
    spans.push({
      type: "link",
      from,
      to,
      content: { from: from + 1, to: labelEnd },
      markers: [
        { from, to: from + 1 },
        { from: labelEnd, to },
      ],
    });
  }

  return spans.sort((a, b) => a.from - b.from);
}
