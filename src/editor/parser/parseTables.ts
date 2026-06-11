// GFM table scanner.
//
// Known limitations:
// - Escaped pipes (\|) are treated as cell separators.
// - Inline formatting inside cells is not interpreted here; the renderer
//   shows cell text as-is.

export type ColumnAlignment = "left" | "center" | "right" | null;

export type TableBlock = {
  fromLine: number;
  toLine: number;
  header: string[];
  align: ColumnAlignment[];
  rows: string[][];
};

const FENCE = /^ {0,3}(```|~~~)/;
const DELIMITER_CELL = /^:?-+:?$/;

function splitRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) {
    return null;
  }
  let inner = trimmed;
  if (inner.startsWith("|")) {
    inner = inner.slice(1);
  }
  if (inner.endsWith("|")) {
    inner = inner.slice(0, -1);
  }
  return inner.split("|").map((cell) => cell.trim());
}

function parseDelimiter(line: string): ColumnAlignment[] | null {
  const cells = splitRow(line);
  if (!cells || cells.length === 0) {
    return null;
  }
  const alignments: ColumnAlignment[] = [];
  for (const cell of cells) {
    if (!DELIMITER_CELL.test(cell)) {
      return null;
    }
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    alignments.push(
      left && right ? "center" : right ? "right" : left ? "left" : null
    );
  }
  return alignments;
}

export function parseTables(text: string): TableBlock[] {
  const tables: TableBlock[] = [];
  const lines = text.split("\n");
  let insideFence = false;
  let fenceMarker = "";

  for (let i = 0; i < lines.length; i++) {
    const fenceMatch = lines[i].match(FENCE);
    if (fenceMatch) {
      if (!insideFence) {
        insideFence = true;
        fenceMarker = fenceMatch[1];
      } else if (fenceMatch[1] === fenceMarker) {
        insideFence = false;
      }
      continue;
    }
    if (insideFence) {
      continue;
    }

    if (i + 1 >= lines.length) {
      continue;
    }
    const header = splitRow(lines[i]);
    if (!header) {
      continue;
    }
    const align = parseDelimiter(lines[i + 1]);
    if (!align || align.length !== header.length) {
      continue;
    }

    const rows: string[][] = [];
    let end = i + 1;
    for (let j = i + 2; j < lines.length; j++) {
      if (FENCE.test(lines[j])) {
        break;
      }
      const row = splitRow(lines[j]);
      if (!row) {
        break;
      }
      // Normalize row width to the header width.
      const cells = row.slice(0, header.length);
      while (cells.length < header.length) {
        cells.push("");
      }
      rows.push(cells);
      end = j;
    }

    tables.push({
      fromLine: i + 1,
      toLine: end + 1,
      header,
      align,
      rows,
    });
    i = end;
  }

  return tables;
}
