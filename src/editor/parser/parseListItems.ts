export type ListItemMarker = {
  from: number;
  to: number;
  marker: "-" | "*" | "+";
};

const BULLET_LIST_ITEM = /^( {0,3})([-*+])([ \t]+)/;
const FENCE = /^ {0,3}(```|~~~)/;

export function parseListItems(markdown: string): ListItemMarker[] {
  const items: ListItemMarker[] = [];
  const lines = markdown.split("\n");
  let insideFence = false;
  let fenceMarker = "";
  let offset = 0;

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
    } else if (!insideFence) {
      const match = line.match(BULLET_LIST_ITEM);
      if (match) {
        const from = lineFrom + match[1].length;
        items.push({
          from,
          to: from + match[2].length,
          marker: match[2] as ListItemMarker["marker"],
        });
      }
    }

    offset += line.length + (i < lines.length - 1 ? 1 : 0);
  }

  return items;
}
