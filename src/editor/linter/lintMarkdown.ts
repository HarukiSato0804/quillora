export type LintSeverity = "error" | "warning" | "info";

export type LintIssue = {
  rule: string;
  severity: LintSeverity;
  message: string;
  line?: number;
};

export type LintResult = {
  file: string;
  kind: string;
  issues: LintIssue[];
};

const REQUIRED_SECTIONS: Record<string, string[]> = {
  skill: ["Trigger Conditions", "Procedure", "Success Criteria"],
  agent: ["Role", "Responsibilities", "Constraints"],
  prompt: ["Instructions", "Output Format"],
};

const AMBIGUOUS_PHRASES = ["必要に応じて", "適切に", "など", "場合によって"];
const FENCE = /^ {0,3}(```|~~~)/;
const HEADING = /^(#{1,6})[ \t]+(.+?)\s*#*\s*$/;

type HeadingEntry = {
  level: number;
  text: string;
  line: number;
  index: number;
};

export function lintMarkdown(
  content: string,
  kind: string,
  filePath: string
): LintResult {
  const headings = collectHeadings(content);
  const issues: LintIssue[] = [];

  const required = REQUIRED_SECTIONS[kind] ?? [];
  for (const heading of required) {
    if (!headings.some((entry) => entry.level === 2 && entry.text === heading)) {
      issues.push({
        rule: "required-section",
        severity: "warning",
        message: `Missing required section: ## ${heading}`,
      });
    }
  }

  for (const heading of headings) {
    const phrase = AMBIGUOUS_PHRASES.find((entry) =>
      heading.text.includes(entry)
    );
    if (phrase) {
      issues.push({
        rule: "ambiguous-heading",
        severity: "info",
        message: `Heading contains ambiguous phrasing: ${phrase}`,
        line: heading.line,
      });
    }
  }

  const lines = content.split("\n");
  for (const heading of headings.filter((entry) => entry.level === 2)) {
    const nextHeading = headings.find(
      (entry) => entry.index > heading.index && entry.level <= heading.level
    );
    const endIndex = nextHeading ? nextHeading.index : lines.length;
    const body = lines
      .slice(heading.index + 1, endIndex)
      .filter((line) => line.trim().length > 0);
    if (body.length === 0) {
      issues.push({
        rule: "empty-section",
        severity: "warning",
        message: `Empty section: ## ${heading.text}`,
        line: heading.line,
      });
    }
  }

  return { file: filePath, kind, issues };
}

function collectHeadings(content: string): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  let insideFence = false;
  let fenceMarker = "";

  const lines = content.split("\n");
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

    const match = line.match(HEADING);
    if (!match) {
      continue;
    }
    headings.push({
      level: match[1].length,
      text: match[2].trim().replace(/[ \t]+#+$/, "").trim(),
      line: index + 1,
      index,
    });
  }

  return headings;
}
