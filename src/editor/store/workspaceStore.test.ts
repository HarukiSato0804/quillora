import { describe, expect, it } from "vitest";
import {
  activateDocument,
  activateDocumentInPane,
  activeDocument,
  activeDocumentId,
  addDocuments,
  closeDocumentInPane,
  closePane,
  copyDocumentReferenceToPaneAt,
  createWorkspace,
  detectLineEnding,
  findDocumentByCanonicalPath,
  isDirty,
  markDocumentSaved,
  moveDocumentToPane,
  moveDocumentToPaneAt,
  newUntitledDocument,
  normalizeLayout,
  paneDocuments,
  removeDocuments,
  reorderDocumentInPane,
  splitPaneHorizontal,
  splitPaneVertical,
  updateDocumentScroll,
  updateDocumentSelection,
  updateDocumentText,
  updateSplitRatio,
  windowTitle,
  type WorkspaceState,
} from "./workspaceStore";

const NOW = 1_000;

function withUntitled(id = "u1"): WorkspaceState {
  return newUntitledDocument(createWorkspace(), { id, now: NOW });
}

function paneIds(ws: WorkspaceState): string[] {
  return ws.panes.map((pane) => pane.id);
}

describe("workspaceStore", () => {
  it("creates an untitled document and activates it in the active pane", () => {
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
    expect(activeDocumentId(ws)).toBe("u1");
    expect(ws.panes[0].documentIds).toEqual(["u1"]);
    expect(isDirty(doc!)).toBe(false);
  });

  it("adds file documents to the active pane and activates the last one", () => {
    const ws = addDocuments(
      createWorkspace(),
      [
        { path: "/a.md", text: "A", id: "a" },
        { path: "/b.md", text: "B", id: "b" },
      ],
      { now: NOW }
    );
    expect(ws.documents.map((d) => d.id)).toEqual(["a", "b"]);
    expect(ws.panes[0].documentIds).toEqual(["a", "b"]);
    expect(activeDocumentId(ws)).toBe("b");
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
    expect(activeDocumentId(ws)).toBe("a");
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
    expect(activeDocumentId(ws)).toBe("a");
  });

  it("activateDocument updates lastActivatedAt and ignores unknown ids", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
    ]);
    ws = activateDocument(ws, "a", 2_000);
    expect(activeDocumentId(ws)).toBe("a");
    expect(activeDocument(ws)!.lastActivatedAt).toBe(2_000);
    expect(activateDocument(ws, "missing")).toBe(ws);
  });

  it("activateDocument does not reorder tabs when activating an existing tab", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
      { path: "/c.md", text: "C", id: "c" },
    ]);
    ws = activateDocument(ws, "b");
    expect(ws.panes[0].documentIds).toEqual(["a", "b", "c"]);
    expect(activeDocumentId(ws)).toBe("b");
    ws = activateDocument(ws, "a");
    expect(ws.panes[0].documentIds).toEqual(["a", "b", "c"]);
    expect(activeDocumentId(ws)).toBe("a");
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
    expect(activeDocumentId(ws)).toBe("c");
  });

  it("removing the last active document falls back to the previous one", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
    ]);
    ws = removeDocuments(ws, ["b"]);
    expect(activeDocumentId(ws)).toBe("a");
  });

  it("removing an inactive document keeps the active one", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
    ]);
    ws = removeDocuments(ws, ["a"]);
    expect(activeDocumentId(ws)).toBe("b");
  });

  it("removing every document clears the active id but keeps a pane", () => {
    const ws = removeDocuments(withUntitled(), ["u1"]);
    expect(ws.documents).toEqual([]);
    expect(activeDocumentId(ws)).toBeNull();
    expect(ws.panes).toHaveLength(1);
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
    expect(windowTitle(null)).toBe("Quillora");
    let ws = withUntitled();
    expect(windowTitle(activeDocument(ws))).toBe("Untitled — Quillora");
    ws = updateDocumentText(ws, "u1", "x");
    expect(windowTitle(activeDocument(ws))).toBe("• Untitled — Quillora");
  });

  it("splits panes horizontally and vertically with document references", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
    ]);
    ws = splitPaneHorizontal(ws);
    expect(ws.panes).toHaveLength(2);
    expect(ws.layout.type).toBe("split");
    expect(ws.layout.type === "split" ? ws.layout.direction : null).toBe(
      "horizontal"
    );
    expect(paneDocuments(ws, ws.activePaneId).map((doc) => doc.id)).toEqual([
      "a",
    ]);

    ws = splitPaneVertical(ws);
    expect(ws.panes).toHaveLength(3);
    expect(paneIds(ws)).toContain(ws.activePaneId);
  });

  it("moves documents between panes without duplicating within a pane", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
    ]);
    const sourcePane = ws.activePaneId;
    ws = splitPaneHorizontal(ws);
    const targetPane = ws.activePaneId;
    ws = moveDocumentToPane(ws, "a", targetPane);
    ws = moveDocumentToPane(ws, "a", targetPane);
    expect(ws.panes.find((pane) => pane.id === sourcePane)!.documentIds).toEqual([
      "b",
    ]);
    expect(ws.panes.find((pane) => pane.id === targetPane)!.documentIds).toEqual([
      "b",
      "a",
    ]);
  });

  it("supports pane-aware activation and close document references", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
    ]);
    const firstPane = ws.activePaneId;
    ws = splitPaneHorizontal(ws);
    const secondPane = ws.activePaneId;
    ws = activateDocumentInPane(ws, firstPane, "a");
    expect(activeDocumentId(ws)).toBe("a");
    ws = closeDocumentInPane(ws, secondPane, "b");
    expect(ws.documents.map((doc) => doc.id)).toEqual(["a", "b"]);
    // Empty panes are auto-removed; secondPane no longer exists
    expect(ws.panes.find((pane) => pane.id === secondPane)).toBeUndefined();
    expect(ws.panes).toHaveLength(1);
  });

  it("closes a pane and removes documents that have no remaining references", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
    ]);
    const firstPane = ws.activePaneId;
    ws = splitPaneHorizontal(ws);
    const secondPane = ws.activePaneId;
    ws = moveDocumentToPaneAt(ws, firstPane, "a", secondPane, 0);
    ws = closePane(ws, secondPane);
    expect(ws.panes).toHaveLength(1);
    expect(ws.documents.map((doc) => doc.id)).toEqual(["b"]);
  });

  it("updates and normalizes split ratios", () => {
    let ws = splitPaneHorizontal(withUntitled());
    const splitId = ws.layout.type === "split" ? ws.layout.id : "";
    ws = updateSplitRatio(ws, splitId, 0.95);
    expect(ws.layout.type === "split" ? ws.layout.ratio : null).toBe(0.85);
    ws = updateSplitRatio(ws, splitId, 0.05);
    expect(ws.layout.type === "split" ? ws.layout.ratio : null).toBe(0.15);
  });

  it("normalizes layouts by deduping pane document ids and removing missing docs", () => {
    const ws = normalizeLayout({
      ...withUntitled("u1"),
      panes: [
        {
          id: "pane-root",
          documentIds: ["u1", "u1", "missing"],
          activeDocumentId: "missing",
        },
      ],
    });
    expect(ws.panes[0].documentIds).toEqual(["u1"]);
    expect(ws.panes[0].activeDocumentId).toBe("u1");
  });

  it("reorders, moves, and copies document references for tab drag-and-drop", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
      { path: "/b.md", text: "B", id: "b" },
      { path: "/c.md", text: "C", id: "c" },
    ]);
    const firstPane = ws.activePaneId;
    ws = reorderDocumentInPane(ws, firstPane, "c", 0);
    expect(ws.panes[0].documentIds).toEqual(["c", "a", "b"]);

    ws = splitPaneHorizontal(ws);
    const secondPane = ws.activePaneId;
    ws = moveDocumentToPaneAt(ws, firstPane, "a", secondPane, 0);
    expect(ws.panes.find((pane) => pane.id === firstPane)!.documentIds).toEqual([
      "c",
      "b",
    ]);
    expect(ws.panes.find((pane) => pane.id === secondPane)!.documentIds).toEqual([
      "a",
      "c",
    ]);

    ws = copyDocumentReferenceToPaneAt(ws, "b", secondPane, 1);
    ws = copyDocumentReferenceToPaneAt(ws, "b", secondPane, 1);
    expect(ws.panes.find((pane) => pane.id === secondPane)!.documentIds).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
