export type MermaidBlock = {
  fromLine: number;
  toLine: number;
  code: string;
};

const FENCE = /^ {0,3}(```|~~~)(.*)$/;

export function parseMermaidBlocks(text: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  const lines = text.split("\n");

  let open: {
    marker: string;
    isMermaid: boolean;
    fromLine: number;
    code: string[];
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(FENCE);
    if (match) {
      if (open === null) {
        open = {
          marker: match[1],
          isMermaid: match[2].trim().toLowerCase() === "mermaid",
          fromLine: i + 1,
          code: [],
        };
      } else if (match[1] === open.marker) {
        if (open.isMermaid && open.code.length > 0) {
          blocks.push({
            fromLine: open.fromLine,
            toLine: i + 1,
            code: open.code.join("\n"),
          });
        }
        open = null;
      } else if (open !== null) {
        open.code.push(lines[i]);
      }
    } else if (open !== null) {
      open.code.push(lines[i]);
    }
  }

  return blocks;
}
