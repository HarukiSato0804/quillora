import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import {
  SLASH_COMMANDS,
  applySlashCommand,
  filterSlashCommands,
  findSlashTrigger,
} from "./slashCommands";

function stateAt(text: string, pos: number): EditorState {
  const state = EditorState.create({ doc: text });
  return state.update({ selection: { anchor: pos } }).state;
}

describe("filterSlashCommands", () => {
  it("returns all commands for an empty query", () => {
    expect(filterSlashCommands("")).toHaveLength(SLASH_COMMANDS.length);
  });

  it("filters by id prefix", () => {
    const results = filterSlashCommands("ta");
    expect(results.map((c) => c.id)).toContain("table");
    expect(results.map((c) => c.id)).not.toContain("code");
  });

  it("filters by alias prefix", () => {
    const results = filterSlashCommands("ul");
    expect(results.map((c) => c.id)).toContain("bullet");
  });

  it("filters by alias prefix for 'ol'", () => {
    const results = filterSlashCommands("ol");
    expect(results.map((c) => c.id)).toContain("numbered");
  });

  it("returns empty for no matches", () => {
    expect(filterSlashCommands("zzz")).toHaveLength(0);
  });
});

describe("findSlashTrigger", () => {
  it("detects / at line start", () => {
    const state = stateAt("/table", 6);
    const trigger = findSlashTrigger(state);
    expect(trigger).toEqual({ from: 0, to: 6, query: "table" });
  });

  it("detects / after indentation", () => {
    const state = stateAt("  /ta", 5);
    const trigger = findSlashTrigger(state);
    expect(trigger).toEqual({ from: 2, to: 5, query: "ta" });
  });

  it("detects bare / with no query", () => {
    const state = stateAt("/", 1);
    const trigger = findSlashTrigger(state);
    expect(trigger).toEqual({ from: 0, to: 1, query: "" });
  });

  it("does not trigger mid-sentence", () => {
    const state = stateAt("some text /table", 16);
    expect(findSlashTrigger(state)).toBeNull();
  });

  it("does not trigger in a URL", () => {
    const state = stateAt("https://example.com/foo", 23);
    expect(findSlashTrigger(state)).toBeNull();
  });

  it("does not trigger when there is non-whitespace before /", () => {
    // cursor at end of "hello /table" — text precedes the slash
    const state = stateAt("hello /table", 12);
    expect(findSlashTrigger(state)).toBeNull();
  });

  it("does not trigger when selection is non-collapsed", () => {
    const s = EditorState.create({ doc: "/table" });
    const state = s.update({ selection: { anchor: 0, head: 6 } }).state;
    expect(findSlashTrigger(state)).toBeNull();
  });
});

describe("applySlashCommand", () => {
  it("replaces the trigger range with table markdown", () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === "table")!;
    const state = stateAt("/table", 6);
    const tx = applySlashCommand(cmd, 0, 6);
    const next = state.update(tx).state;
    expect(next.doc.toString()).toContain("| Column 1 |");
    expect(next.doc.toString()).toContain("| --- |");
  });

  it("places cursor after '- [ ] ' for todo", () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === "todo")!;
    const state = stateAt("/todo", 5);
    const tx = applySlashCommand(cmd, 0, 5);
    const next = state.update(tx).state;
    expect(next.doc.toString()).toBe("- [ ] ");
    expect(next.selection.main.anchor).toBe(6);
  });

  it("places cursor after opening fence for code block", () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === "code")!;
    const state = stateAt("/code", 5);
    const tx = applySlashCommand(cmd, 0, 5);
    const next = state.update(tx).state;
    expect(next.doc.toString()).toContain("```");
    // cursor at position 3 (after opening ```)
    expect(next.selection.main.anchor).toBe(3);
  });

  it("selects 'Column 1' in table for easy replacement", () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === "table")!;
    const state = stateAt("/table", 6);
    const tx = applySlashCommand(cmd, 0, 6);
    const next = state.update(tx).state;
    const sel = next.selection.main;
    const selected = next.sliceDoc(sel.from, sel.to);
    expect(selected).toBe("Column 1");
  });

  it("replaces text on a non-zero line correctly", () => {
    const doc = "# Heading\n\n/hr";
    const cmd = SLASH_COMMANDS.find((c) => c.id === "hr")!;
    const state = stateAt(doc, doc.length);
    const tx = applySlashCommand(cmd, 11, doc.length);
    const next = state.update(tx).state;
    expect(next.doc.toString()).toBe("# Heading\n\n---\n");
  });
});
