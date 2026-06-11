import { describe, expect, it } from "vitest";
import {
  activateDocument,
  activeDocument,
  addDocuments,
  createWorkspace,
  detectLineEnding,
  findDocumentByCanonicalPath,
  isDirty,
  markDocumentSaved,
  newUntitledDocument,
  removeDocuments,
  updateDocumentScroll,
  updateDocumentSelection,
  updateDocumentText,
  windowTitle,
  type WorkspaceState,
} from "./workspaceStore";

const NOW = 1_000;

function withUntitled(id = "u1"): WorkspaceState {
  return newUntitledDocument(createWorkspace(), { id, now: NOW });
}

describe("workspaceStore", () => {
  it("creates an untitled document and activates it", () => {
    const ws = withUntitled();
    const doc = activeDocument(ws);
    expect(doc).toMatchObject({
      id: "u1",
      kind: "untitled",
      path: null,
      title: "Untitled",
      text: "",
      lastSavedText: "",
      encoding: "utf-8",
      lineEnding: "lf",
      openedAt: NOW,
      lastActivatedAt: NOW,
    });
    expect(ws.activeDocumentId).toBe("u1");
    expect(isDirty(doc!)).toBe(false);
  });

  it("adds file documents and activates the last one", () => {
    const ws = addDocuments(
      createWorkspace(),
      [
        { path: "/a.md", text: "A", id: "a" },
        { path: "/b.md", text: "B", id: "b" },
      ],
      { now: NOW }
    );
    expect(ws.documents.map((d) => d.id)).toEqual(["a", "b"]);
    expect(ws.activeDocumentId).toBe("b");
    expect(ws.documents[0]).toMatchObject({
      kind: "file",
      title: "a.md",
      lastSavedText: "A",
    });
  });

  it("activates an existing tab instead of opening a duplicate path", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
    ]);
    ws = addDocuments(ws, [{ path: "/a.md", text: "stale", id: "dup" }]);
    expect(ws.documents).toHaveLength(2);
    expect(ws.activeDocumentId).toBe("a");
    expect(findDocumentByCanonicalPath(ws, "/a.md")!.text).toBe("A");
  });

  it("activates the last relevant document for a mixed new/existing batch", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
    ]);
    ws = addDocuments(ws, [
      { path: "/b.md", text: "B", id: "b" },
      { path: "/a.md", text: "stale" },
    ]);
    expect(ws.documents).toHaveLength(2);
    expect(ws.activeDocumentId).toBe("a");
  });

  it("activateDocument updates lastActivatedAt and ignores unknown ids", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
    ]);
    ws = activateDocument(ws, "a", 2_000);
    expect(ws.activeDocumentId).toBe("a");
    expect(activeDocument(ws)!.lastActivatedAt).toBe(2_000);
    expect(activateDocument(ws, "missing")).toBe(ws);
  });

  it("updates the active document text and derives dirty state", () => {
    let ws = withUntitled();
    ws = updateDocumentText(ws, "u1", "hello");
    expect(activeDocument(ws)!.text).toBe("hello");
    expect(isDirty(activeDocument(ws)!)).toBe(true);

    ws = updateDocumentText(ws, "u1", "");
    expect(isDirty(activeDocument(ws)!)).toBe(false);
  });

  it("tracks selection and scroll per document", () => {
    let ws = withUntitled();
    ws = updateDocumentSelection(ws, "u1", { anchor: 1, head: 3 });
    ws = updateDocumentScroll(ws, "u1", 120);
    expect(activeDocument(ws)).toMatchObject({
      selection: { anchor: 1, head: 3 },
      scrollTop: 120,
    });
  });

  it("marking saved converts untitled to file and clears dirty", () => {
    let ws = withUntitled();
    ws = updateDocumentText(ws, "u1", "draft");
    ws = markDocumentSaved(ws, "u1", "/notes/draft.md", "draft", 5_000);
    const doc = activeDocument(ws)!;
    expect(doc).toMatchObject({
      kind: "file",
      path: "/notes/draft.md",
      title: "draft.md",
      lastSavedText: "draft",
      fileMtimeMs: 5_000,
    });
    expect(isDirty(doc)).toBe(false);
  });

  it("removing the active document activates the next one after it", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
      { path: "/c.md", text: "C", id: "c" },
    ]);
    ws = activateDocument(ws, "b");
    ws = removeDocuments(ws, ["b"]);
    expect(ws.documents.map((d) => d.id)).toEqual(["a", "c"]);
    expect(ws.activeDocumentId).toBe("c");
  });

  it("removing the last active document falls back to the previous one", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
    ]);
    ws = removeDocuments(ws, ["b"]);
    expect(ws.activeDocumentId).toBe("a");
  });

  it("removing an inactive document keeps the active one", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
    ]);
    ws = removeDocuments(ws, ["a"]);
    expect(ws.activeDocumentId).toBe("b");
  });

  it("removing every document clears the active id", () => {
    const ws = removeDocuments(withUntitled(), ["u1"]);
    expect(ws.documents).toEqual([]);
    expect(ws.activeDocumentId).toBeNull();
  });

  it("detects line endings of opened files", () => {
    expect(detectLineEnding("a\nb")).toBe("lf");
    expect(detectLineEnding("a\r\nb")).toBe("crlf");
    const ws = addDocuments(createWorkspace(), [
      { path: "/win.md", text: "a\r\nb", id: "w" },
    ]);
    expect(activeDocument(ws)!.lineEnding).toBe("crlf");
  });

  it("builds the window title from the active document", () => {
    expect(windowTitle(null)).toBe("Markflow");
    let ws = withUntitled();
    expect(windowTitle(activeDocument(ws))).toBe("Untitled — Markflow");
    ws = updateDocumentText(ws, "u1", "x");
    expect(windowTitle(activeDocument(ws))).toBe("• Untitled — Markflow");
  });
});
