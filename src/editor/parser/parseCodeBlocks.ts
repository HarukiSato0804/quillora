export type CodeBlock = {
  fromLine: number;
  toLine: number;
  lang: string | null;
};

const FENCE = /^ {0,3}(```|~~~)(.*)$/;

// Finds fenced code blocks including their fence lines. An unclosed fence
// (still being typed) extends to the end of the document so the block
// styling appears immediately.
export function parseCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = text.split("\n");

  let open: { marker: string; lang: string | null; fromLine: number } | null =
    null;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(FENCE);
    if (!match) {
      continue;
    }
    if (open === null) {
      const lang = match[2].trim();
      open = {
        marker: match[1],
        lang: lang === "" ? null : lang,
        fromLine: i + 1,
      };
    } else if (match[1] === open.marker) {
      blocks.push({ fromLine: open.fromLine, toLine: i + 1, lang: open.lang });
      open = null;
    }
  }

  if (open !== null) {
    blocks.push({
      fromLine: open.fromLine,
      toLine: lines.length,
      lang: open.lang,
    });
  }

  return blocks;
}
