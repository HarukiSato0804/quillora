export type TemplateId =
  | "skill"
  | "agent"
  | "prompt"
  | "design"
  | "adr"
  | "changelog"
  | "blank";

export type MarkdownTemplate = {
  id: TemplateId;
  label: string;
  defaultFilename: string;
  content: string;
};

export const TEMPLATES: MarkdownTemplate[] = [
  {
    id: "skill",
    label: "Skill Spec",
    defaultFilename: "skill.md",
    content:
      "---\ntype: skill\nname: \nstatus: draft\n---\n\n# Skill: \n\n## Trigger Conditions\n\n- \n\n## Procedure\n\n1. \n\n## Constraints\n\n- \n",
  },
  {
    id: "agent",
    label: "Agent Spec",
    defaultFilename: "agent.md",
    content:
      "---\ntype: agent\nname: \nstatus: draft\n---\n\n# Agent: \n\n## Role\n\n## Tools\n\n## Workflow\n\n1. \n",
  },
  {
    id: "prompt",
    label: "Prompt",
    defaultFilename: "prompt.md",
    content: "---\ntype: prompt\n---\n\n# Prompt\n\n## System\n\n## Instructions\n\n",
  },
  {
    id: "design",
    label: "Design Doc",
    defaultFilename: "design.md",
    content:
      "---\ntype: design\n---\n\n# Design: \n\n## Background\n\n## Goals\n\n## Non-goals\n\n## Architecture\n\n## Open Questions\n\n",
  },
  {
    id: "adr",
    label: "ADR",
    defaultFilename: "ADR.md",
    content:
      "# ADR: \n\n## Status\n\nProposed\n\n## Context\n\n## Decision\n\n## Consequences\n\n",
  },
  {
    id: "changelog",
    label: "Changelog",
    defaultFilename: "CHANGELOG.md",
    content:
      "# Changelog\n\n## [Unreleased]\n\n### Added\n\n### Changed\n\n### Fixed\n\n",
  },
  {
    id: "blank",
    label: "Blank",
    defaultFilename: "untitled.md",
    content: "# Untitled\n\n",
  },
];

export function getTemplateById(
  id: TemplateId
): MarkdownTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}
