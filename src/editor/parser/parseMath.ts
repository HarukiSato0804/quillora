// Math syntax scanner.
//
// Known limitations:
// - `\$` escapes are not recognized.
// - Inline math inside inline code spans is still matched.
// - Currency-like text ("$5 and $10") is avoided only by requiring the
//   expression to start and end with non-space characters.

export type MathBlock = {
  fromLine: number;
  toLine: number;
  expr: string;
};

export type InlineMath = {
  line: number;
  from: number;
  to: number;
  expr: string;
};

export type ParsedMath = {
  blocks: MathBlock[];
  inline: InlineMath[];
};

const FENCE = /^ {0,3}(```|~~~)/;
const BLOCK_DELIMITER = /^\s*\$\$\s*$/;
const SINGLE_LINE_BLOCK = /^\s*\$\$(.+?)\$\$\s*$/;
const INLINE = /(?<!\$)\$([^$\s\n](?:[^$\n]*[^$\s\n])?)\$(?!\$)/g;

export function parseMath(text: string): ParsedMath {
  const blocks: MathBlock[] = [];
  const inline: InlineMath[] = [];

  const lines = text.split("\n");
  let insideFence = false;
  let fenceMarker = "";
  let blockStart: number | null = null;
  let blockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];

    if (blockStart === null) {
      const fenceMatch = line.match(FENCE);
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

      const singleLine = line.match(SINGLE_LINE_BLOCK);
      if (singleLine) {
        blocks.push({
          fromLine: lineNumber,
          toLine: lineNumber,
          expr: singleLine[1].trim(),
        });
        continue;
      }

      if (BLOCK_DELIMITER.test(line)) {
        blockStart = lineNumber;
        blockLines = [];
        continue;
      }

      for (const match of line.matchAll(INLINE)) {
        inline.push({
          line: lineNumber,
          from: match.index,
          to: match.index + match[0].length,
          expr: match[1],
        });
      }
    } else if (BLOCK_DELIMITER.test(line)) {
      blocks.push({
        fromLine: blockStart,
        toLine: lineNumber,
        expr: blockLines.join("\n").trim(),
      });
      blockStart = null;
      blockLines = [];
    } else {
      blockLines.push(line);
    }
  }

  return { blocks, inline };
}
