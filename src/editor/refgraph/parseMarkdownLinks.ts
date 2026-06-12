export type MarkdownLinkKind = "inline" | "image" | "wiki" | "anchor";

export type MarkdownLink = {
  kind: MarkdownLinkKind;
  text: string;
  target: string;
  line: number;
};

const INLINE_OR_IMAGE_LINK = /(!?)\[([^\]\n]*)\]\(([^()\n]+)\)/g;
const WIKI_LINK = /\[\[([^\]\n]+)\]\]/g;
const FENCE = /^ {0,3}(```|~~~)/;

export function parseMarkdownLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  let insideFence = false;
  let fenceMarker = "";

  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
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

    for (const match of line.matchAll(INLINE_OR_IMAGE_LINK)) {
      const target = match[3].trim();
      links.push({
        kind: match[1] === "!" ? "image" : target.startsWith("#") ? "anchor" : "inline",
        text: match[2],
        target,
        line: index + 1,
      });
    }

    for (const match of line.matchAll(WIKI_LINK)) {
      const target = match[1].trim();
      links.push({
        kind: "wiki",
        text: target,
        target,
        line: index + 1,
      });
    }
  }

  return links;
}
