export type BundleEntry = {
  path: string;
  relativePath: string;
  content: string;
};

export type ContextBundle = {
  entries: BundleEntry[];
  totalChars: number;
  estimatedTokens: number;
  markdown: string;
};

export function buildContextBundle(entries: BundleEntry[]): ContextBundle {
  const totalChars = entries.reduce(
    (total, entry) => total + entry.content.length,
    0
  );
  const markdown = [
    "# Context Bundle",
    "",
    ...entries.flatMap((entry) => [
      `## File: ${entry.relativePath || entry.path}`,
      "",
      "```md",
      entry.content,
      "```",
      "",
    ]),
  ].join("\n");

  return {
    entries,
    totalChars,
    estimatedTokens: Math.ceil(totalChars / 4),
    markdown,
  };
}
