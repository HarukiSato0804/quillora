import { describe, expect, it } from "vitest";
import { getTemplateById, TEMPLATES, type TemplateId } from "./markdownTemplates";

describe("markdown templates", () => {
  it("contains all template ids", () => {
    const ids = TEMPLATES.map((template) => template.id);
    const expected: TemplateId[] = [
      "skill",
      "agent",
      "prompt",
      "design",
      "adr",
      "changelog",
      "blank",
    ];
    expect(ids).toEqual(expected);
  });

  it("keeps non-blank template content populated", () => {
    for (const template of TEMPLATES) {
      expect(template.content.trim().length).toBeGreaterThan(0);
    }
  });

  it("includes skill frontmatter type", () => {
    expect(getTemplateById("skill")?.content).toContain("type: skill");
  });

  it("returns templates by id", () => {
    expect(getTemplateById("skill")?.defaultFilename).toBe("skill.md");
  });
});
