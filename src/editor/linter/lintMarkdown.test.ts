import { describe, expect, it } from "vitest";
import { lintMarkdown } from "./lintMarkdown";

describe("lintMarkdown", () => {
  it("warns when skill.md is missing Trigger Conditions", () => {
    const result = lintMarkdown(
      ["## Procedure", "Do it.", "## Success Criteria", "Done."].join("\n"),
      "skill",
      "skill.md"
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        rule: "required-section",
        severity: "warning",
        message: "Missing required section: ## Trigger Conditions",
      })
    );
  });

  it("warns when skill.md is missing Procedure", () => {
    const result = lintMarkdown(
      ["## Trigger Conditions", "When asked.", "## Success Criteria", "Done."].join(
        "\n"
      ),
      "skill",
      "skill.md"
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        message: "Missing required section: ## Procedure",
      })
    );
  });

  it("warns when agent.md is missing Role", () => {
    const result = lintMarkdown(
      ["## Responsibilities", "Work.", "## Constraints", "Stay scoped."].join("\n"),
      "agent",
      "agent.md"
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({ message: "Missing required section: ## Role" })
    );
  });

  it("warns when prompt.md is missing Instructions", () => {
    const result = lintMarkdown("## Output Format\nText.", "prompt", "prompt.md");

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        message: "Missing required section: ## Instructions",
      })
    );
  });

  it("warns on empty sections", () => {
    const result = lintMarkdown(
      ["## Filled", "Text.", "## Empty", "## Next", "Text."].join("\n"),
      "unknown",
      "notes.md"
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        rule: "empty-section",
        severity: "warning",
        line: 3,
      })
    );
  });

  it("reports ambiguous heading phrasing as info", () => {
    const result = lintMarkdown("## 必要に応じて確認\nText.", "unknown", "notes.md");

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        rule: "ambiguous-heading",
        severity: "info",
        line: 1,
      })
    );
  });

  it("does not emit required-section warnings for a valid skill.md", () => {
    const result = lintMarkdown(
      [
        "## Trigger Conditions",
        "When requested.",
        "## Procedure",
        "Do the work.",
        "## Success Criteria",
        "The work is done.",
      ].join("\n"),
      "skill",
      "skill.md"
    );

    expect(result.issues.filter((issue) => issue.rule === "required-section")).toEqual(
      []
    );
  });
});
