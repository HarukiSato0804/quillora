import { describe, expect, it } from "vitest";
import { parseTaskListItems } from "./parseTaskListItems";

describe("parseTaskListItems", () => {
  it("detects unchecked task with dash", () => {
    const items = parseTaskListItems("- [ ] todo");
    expect(items).toHaveLength(1);
    expect(items[0].checked).toBe(false);
    expect(items[0].marker).toBe("-");
  });

  it("detects checked task with lowercase x", () => {
    const items = parseTaskListItems("- [x] done");
    expect(items).toHaveLength(1);
    expect(items[0].checked).toBe(true);
  });

  it("detects checked task with uppercase X", () => {
    const items = parseTaskListItems("- [X] done");
    expect(items).toHaveLength(1);
    expect(items[0].checked).toBe(true);
  });

  it("detects task list with * and + markers", () => {
    const items = parseTaskListItems("* [ ] a\n+ [ ] b");
    expect(items).toHaveLength(2);
    expect(items[0].marker).toBe("*");
    expect(items[1].marker).toBe("+");
  });

  it("detects empty task item", () => {
    const items = parseTaskListItems("- [ ]");
    expect(items).toHaveLength(1);
    expect(items[0].checked).toBe(false);
  });

  it("detects indented task item", () => {
    const items = parseTaskListItems("  - [ ] nested");
    expect(items).toHaveLength(1);
    expect(items[0].indent).toBe(2);
  });

  it("skips fenced code blocks", () => {
    const items = parseTaskListItems("```\n- [ ] hidden\n```\n- [ ] visible");
    expect(items).toHaveLength(1);
    expect(items[0].from).toBeGreaterThan(15);
  });

  it("does not detect plain unordered list as task", () => {
    const items = parseTaskListItems("- plain item");
    expect(items).toHaveLength(0);
  });

  it("checkboxFrom/checkboxTo covers exactly [ ] or [x]", () => {
    const doc = "- [ ] todo";
    const items = parseTaskListItems(doc);
    expect(doc.slice(items[0].checkboxFrom, items[0].checkboxTo)).toBe("[ ]");
  });

  it("checkboxFrom/checkboxTo for checked item covers [x]", () => {
    const doc = "- [x] done";
    const items = parseTaskListItems(doc);
    expect(doc.slice(items[0].checkboxFrom, items[0].checkboxTo)).toBe("[x]");
  });

  it("handles Japanese task text", () => {
    const items = parseTaskListItems("- [ ] タスク完了");
    expect(items).toHaveLength(1);
    expect(items[0].checked).toBe(false);
  });
});
