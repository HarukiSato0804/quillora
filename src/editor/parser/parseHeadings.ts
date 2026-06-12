export type Heading = {
  level: number;
  text: string;
  line: number;
  from: number;
};

const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const FENCE = /^ {0,3}(```|~~~)/;

export type HeadingMarkerRange = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  markerLength: number;
};

const HEADING_MARKER = /^( {0,3})(#{1,6})([ \t]+)(.*)$/;

// Detects a hideable leading heading marker. Stricter than parseHeadings:
// the marker must be followed by whitespace AND the heading must have text,
// so empty headings keep their markers visible while being edited.
export function detectHeadingMarker(
  lineText: string
): HeadingMarkerRange | null {
  const match = lineText.match(HEADING_MARKER);
  if (!match) {
    return null;
  }
  // 7+ #'s: the regex would match the first 6 followed by "#", which is not
  // whitespace, so it already fails. Guard against text that is only spaces.
  if (match[4].trim() === "") {
    return null;
  }
  return {
    level: match[2].length as HeadingMarkerRange["level"],
    markerLength: match[1].length + match[2].length + match[3].length,
  };
}

export function parseHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  let insideFence = false;
  let fenceMarker = "";
  let offset = 0;

  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineFrom = offset;

    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      if (!insideFence) {
        insideFence = true;
        fenceMarker = fenceMatch[1];
      } else if (fenceMatch[1] === fenceMarker) {
        insideFence = false;
      }
      offset += line.length + (i < lines.length - 1 ? 1 : 0);
      continue;
    }
    if (insideFence) {
      offset += line.length + (i < lines.length - 1 ? 1 : 0);
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
        from: lineFrom,
      });
    }
    offset += line.length + (i < lines.length - 1 ? 1 : 0);
  }

  return headings;
}
