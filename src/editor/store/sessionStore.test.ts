import { describe, expect, it } from "vitest";
import {
  buildRestoredWorkspace,
  isPersistedWorkspace,
  serializeWorkspace,
  type PersistedWorkspace,
} from "./sessionStore";
import {
  activateDocument,
  activeDocument,
  addDocuments,
  createWorkspace,
  isDirty,
  newUntitledDocument,
  updateDocumentScroll,
  updateDocumentSelection,
  updateDocumentText,
} from "./workspaceStore";

describe("serializeWorkspace", () => {
  it("persists file docs as metadata only and untitled docs with text", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "AAA", id: "a" },
    ]);
    ws = newUntitledDocument(ws, { id: "u" });
    ws = updateDocumentText(ws, "u", "draft text");
    ws = updateDocumentSelection(ws, "a", { anchor: 1, head: 2 });
    ws = activateDocument(ws, "a");

    const persisted = serializeWorkspace(ws);
    expect(persisted.version).toBe(1);
    expect(persisted.activeDocumentPath).toBe("/a.md");
    expect(persisted.openDocuments).toEqual([
      {
        path: "/a.md",
        title: "a.md",
        selection: { anchor: 1, head: 2 },
        scrollTop: 0,
      },
      {
        path: null,
        title: "Untitled",
        textForUntitledOnly: "draft text",
        selection: null,
        scrollTop: 0,
      },
    ]);
  });

  it("skips pristine empty untitled documents", () => {
    const ws = newUntitledDocument(createWorkspace());
    expect(serializeWorkspace(ws).openDocuments).toEqual([]);
  });
});

describe("isPersistedWorkspace", () => {
  it("accepts version 1 payloads and rejects everything else", () => {
    expect(
      isPersistedWorkspace({
        version: 1,
        activeDocumentPath: null,
        openDocuments: [],
      })
    ).toBe(true);
    expect(isPersistedWorkspace({ version: 2, openDocuments: [] })).toBe(false);
    expect(isPersistedWorkspace(null)).toBe(false);
    expect(isPersistedWorkspace("{}")).toBe(false);
  });
});

describe("buildRestoredWorkspace", () => {
  const persisted: PersistedWorkspace = {
    version: 1,
    activeDocumentPath: "/a.md",
    openDocuments: [
      {
        path: "/a.md",
        title: "a.md",
        selection: { anchor: 3, head: 3 },
        scrollTop: 120,
      },
      { path: "/missing.md", title: "missing.md", selection: null, scrollTop: 0 },
      {
        path: null,
        title: "Untitled",
        textForUntitledOnly: "unsaved",
        selection: null,
        scrollTop: 0,
      },
    ],
  };

  const files = [{ path: "/a.md", text: "from disk", mtimeMs: 42 }];

  it("restores file docs from disk content with metadata", () => {
    const ws = buildRestoredWorkspace(persisted, files);
    const fileDoc = ws.documents.find((doc) => doc.path === "/a.md")!;
    expect(fileDoc.text).toBe("from disk");
    expect(fileDoc.lastSavedText).toBe("from disk");
    expect(fileDoc.fileMtimeMs).toBe(42);
    expect(fileDoc.selection).toEqual({ anchor: 3, head: 3 });
    expect(fileDoc.scrollTop).toBe(120);
    expect(isDirty(fileDoc)).toBe(false);
  });

  it("restores untitled text as unsaved content", () => {
    const ws = buildRestoredWorkspace(persisted, files);
    const untitled = ws.documents.find((doc) => doc.path === null)!;
    expect(untitled.text).toBe("unsaved");
    expect(isDirty(untitled)).toBe(true);
  });

  it("skips missing files and restores the active document", () => {
    const ws = buildRestoredWorkspace(persisted, files);
    expect(ws.documents).toHaveLength(2);
    expect(activeDocument(ws)?.path).toBe("/a.md");
  });

  it("falls back to a fresh untitled document when nothing survives", () => {
    const ws = buildRestoredWorkspace(
      {
        version: 1,
        activeDocumentPath: "/missing.md",
        openDocuments: [
          {
            path: "/missing.md",
            title: "missing.md",
            selection: null,
            scrollTop: 0,
          },
        ],
      },
      []
    );
    expect(ws.documents).toHaveLength(1);
    expect(ws.documents[0].kind).toBe("untitled");
  });
});

describe("scroll restore", () => {
  it("round-trips scroll positions through serialize/restore", () => {
    let ws = addDocuments(createWorkspace(), [
      { path: "/a.md", text: "A", id: "a" },
    ]);
    ws = updateDocumentScroll(ws, "a", 480);
    const restored = buildRestoredWorkspace(serializeWorkspace(ws), [
      { path: "/a.md", text: "A", mtimeMs: null },
    ]);
    expect(restored.documents[0].scrollTop).toBe(480);
  });
});
