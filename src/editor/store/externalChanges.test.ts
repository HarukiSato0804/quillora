import { describe, expect, it } from "vitest";
import {
  activeDocument,
  addDocuments,
  applyDiskStates,
  createWorkspace,
  externalChangeState,
  isDirty,
  newUntitledDocument,
  reloadDocumentFromDisk,
  updateDocumentText,
} from "./workspaceStore";

function fileWorkspace() {
  return addDocuments(createWorkspace(), [
    { path: "/a.md", text: "A", fileMtimeMs: 100, id: "a" },
  ]);
}

describe("externalChangeState", () => {
  it("is clean for untitled documents", () => {
    const ws = newUntitledDocument(createWorkspace(), { id: "u" });
    expect(externalChangeState(activeDocument(ws)!, null)).toBe("clean");
  });

  it("is clean when the disk mtime has not advanced", () => {
    const doc = activeDocument(fileWorkspace())!;
    expect(externalChangeState(doc, 100)).toBe("clean");
    expect(externalChangeState(doc, 50)).toBe("clean");
  });

  it("is changed-on-disk when the file changed and the doc is clean", () => {
    const doc = activeDocument(fileWorkspace())!;
    expect(externalChangeState(doc, 200)).toBe("changed-on-disk");
  });

  it("is conflict when the file changed and the doc is dirty", () => {
    const ws = updateDocumentText(fileWorkspace(), "a", "edited");
    expect(externalChangeState(activeDocument(ws)!, 200)).toBe("conflict");
  });

  it("is deleted-on-disk when the file is missing", () => {
    const doc = activeDocument(fileWorkspace())!;
    expect(externalChangeState(doc, null)).toBe("deleted-on-disk");
  });
});

describe("applyDiskStates", () => {
  it("updates per-document states and leaves untouched docs identical", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", fileMtimeMs: 100, id: "a" },
      { path: "/b.md", text: "B", fileMtimeMs: 100, id: "b" },
    ]);
    ws = applyDiskStates(ws, [
      { path: "/a.md", mtimeMs: 200 },
      { path: "/b.md", mtimeMs: 100 },
    ]);
    expect(ws.documents[0].externalState).toBe("changed-on-disk");
    expect(ws.documents[1].externalState).toBe("clean");
  });

  it("marks deleted files", () => {
    const ws = applyDiskStates(fileWorkspace(), [
      { path: "/a.md", mtimeMs: null },
    ]);
    expect(ws.documents[0].externalState).toBe("deleted-on-disk");
  });
});

describe("reloadDocumentFromDisk", () => {
  it("replaces content, clears dirty and external state, bumps version", () => {
    let ws = applyDiskStates(fileWorkspace(), [
      { path: "/a.md", mtimeMs: 200 },
    ]);
    ws = reloadDocumentFromDisk(ws, "a", "new content", 200);
    const doc = activeDocument(ws)!;
    expect(doc.text).toBe("new content");
    expect(isDirty(doc)).toBe(false);
    expect(doc.externalState).toBe("clean");
    expect(doc.fileMtimeMs).toBe(200);
    expect(doc.externalVersion).toBe(1);
  });
});
