export type Heading = {
  level: number;
  text: string;
  line: number;
};

const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const FENCE = /^ {0,3}(```|~~~)/;

export function parseHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  let insideFence = false;
  let fenceMarker = "";

  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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

    const match = line.match(ATX_HEADING);
    if (match) {
      const rawText = (match[2] ?? "").trim();
      headings.push({
        level: match[1].length,
        // strip optional closing #'s: "## title ##" -> "title"
        text: rawText.replace(/[ \t]+#+$/, "").trim(),
        line: i + 1,
      });
    }
  }

  return headings;
}
