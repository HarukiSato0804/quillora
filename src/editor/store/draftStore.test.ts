import { describe, expect, it } from "vitest";
import {
  collectDrafts,
  parseDrafts,
  recoverableDrafts,
  serializeDrafts,
  type Draft,
} from "./draftStore";
import {
  addDocuments,
  createWorkspace,
  newUntitledDocument,
  updateDocumentText,
  type WorkspaceState,
} from "./workspaceStore";

function dirtyFileWorkspace(): WorkspaceState {
  let ws = addDocuments(createWorkspace(), [
    { path: "/a.md", text: "A", id: "a", fileMtimeMs: 100 },
    { path: "/b.md", text: "B", id: "b", fileMtimeMs: 200 },
  ]);
  // Edit only /a.md so it becomes dirty; /b.md stays clean.
  ws = updateDocumentText(ws, "a", "A edited");
  return ws;
}

describe("draftStore", () => {
  it("collects drafts only for dirty file-backed documents", () => {
    const ws = dirtyFileWorkspace();
    const drafts = collectDrafts(ws, 5_000);
    expect(drafts).toEqual([
      { path: "/a.md", text: "A edited", baseMtimeMs: 100, savedAt: 5_000 },
    ]);
  });

  it("ignores untitled documents (the session store covers those)", () => {
    let ws = newUntitledDocument(createWorkspace(), { id: "u1" });
    ws = updateDocumentText(ws, "u1", "draft text");
    expect(collectDrafts(ws, 1_000)).toEqual([]);
  });

  it("round-trips drafts through serialize/parse", () => {
    const drafts = collectDrafts(dirtyFileWorkspace(), 9_000);
    expect(parseDrafts(serializeDrafts(drafts))).toEqual(drafts);
  });

  it("parses defensively", () => {
    expect(parseDrafts(null)).toEqual([]);
    expect(parseDrafts("not json")).toEqual([]);
    expect(parseDrafts(JSON.stringify({ version: 2, drafts: [] }))).toEqual([]);
    expect(parseDrafts(JSON.stringify({ version: 1 }))).toEqual([]);
    expect(
      parseDrafts(JSON.stringify({ version: 1, drafts: [{ path: 1 }] }))
    ).toEqual([]);
  });

  it("recovers only drafts that differ from current disk content", () => {
    const drafts: Draft[] = [
      { path: "/a.md", text: "A edited", baseMtimeMs: 100, savedAt: 1 },
      { path: "/b.md", text: "B", baseMtimeMs: 200, savedAt: 1 },
      { path: "/gone.md", text: "x", baseMtimeMs: null, savedAt: 1 },
    ];
    const recoverable = recoverableDrafts(drafts, [
      { path: "/a.md", text: "A" }, // disk differs from draft -> recover
      { path: "/b.md", text: "B" }, // disk matches draft -> nothing to recover
      // /gone.md absent -> dropped
    ]);
    expect(recoverable.map((d) => d.path)).toEqual(["/a.md"]);
  });
});
