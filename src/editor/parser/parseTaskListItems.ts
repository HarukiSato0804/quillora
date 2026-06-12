export type TaskListMarker = {
  from: number;
  to: number;
  checkboxFrom: number;
  checkboxTo: number;
  checked: boolean;
  indent: number;
  marker: "-" | "*" | "+";
};

const TASK_LIST_ITEM = /^( {0,3})([-*+])([ \t]+)\[( |x|X)\]/;
const FENCE = /^ {0,3}(```|~~~)/;

export function parseTaskListItems(markdown: string): TaskListMarker[] {
  const items: TaskListMarker[] = [];
  const lines = markdown.split("\n");
  let insideFence = false;
  let fenceMarker = "";
  let offset = 0;

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
      offset += line.length + (i < lines.length - 1 ? 1 : 0);
      continue;
    }

    if (!insideFence) {
      const match = line.match(TASK_LIST_ITEM);
      if (match) {
        const indent = match[1].length;
        const markerStart = offset + indent;
        // from = start of "- [ ]" (the bullet marker), to = end of "[ ]"
        const checkboxOffset = indent + match[2].length + match[3].length;
        items.push({
          from: offset + indent,
          to: offset + checkboxOffset + 3, // 3 = length of "[ ]" or "[x]"
          checkboxFrom: offset + checkboxOffset,
          checkboxTo: offset + checkboxOffset + 3,
          checked: match[4] === "x" || match[4] === "X",
          indent,
          marker: match[2] as TaskListMarker["marker"],
        });
        void markerStart;
      }
    }

    offset += line.length + (i < lines.length - 1 ? 1 : 0);
  }

  return items;
}
