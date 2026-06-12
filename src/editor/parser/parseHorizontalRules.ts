export type HorizontalRuleRange = {
  from: number;
  to: number;
};

const HORIZONTAL_RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const FENCE = /^ {0,3}(```|~~~)/;

export function parseHorizontalRules(markdown: string): HorizontalRuleRange[] {
  const rules: HorizontalRuleRange[] = [];
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
    } else if (!insideFence && HORIZONTAL_RULE.test(line)) {
      rules.push({ from: lineFrom, to: lineFrom + line.length });
    }

    offset += line.length + (i < lines.length - 1 ? 1 : 0);
  }

  return rules;
}
