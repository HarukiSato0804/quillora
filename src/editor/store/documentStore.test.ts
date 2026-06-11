import { describe, expect, it } from "vitest";
import {
  createUntitledDocument,
  titleFromPath,
  windowTitle,
  withOpenedFile,
  withSavedFile,
  withText,
} from "./documentStore";

describe("documentStore", () => {
  it("creates a clean untitled document", () => {
    const doc = createUntitledDocument();
    expect(doc).toEqual({
      path: null,
      title: "Untitled",
      text: "",
      dirty: false,
      lastSavedText: "",
    });
  });

  it("marks the document dirty when text differs from last saved text", () => {
    const doc = withText(createUntitledDocument(), "hello");
    expect(doc.dirty).toBe(true);
    expect(doc.text).toBe("hello");
  });

  it("clears dirty when text is changed back to the saved text", () => {
    let doc = withText(createUntitledDocument(), "hello");
    doc = withText(doc, "");
    expect(doc.dirty).toBe(false);
  });

  it("opening a file resets dirty state and tracks the path", () => {
    const doc = withOpenedFile("/tmp/notes.md", "# Notes");
    expect(doc).toEqual({
      path: "/tmp/notes.md",
      title: "notes.md",
      text: "# Notes",
      dirty: false,
      lastSavedText: "# Notes",
    });
  });

  it("editing an opened file marks it dirty, saving clears it", () => {
    let doc = withOpenedFile("/tmp/notes.md", "# Notes");
    doc = withText(doc, "# Notes\nmore");
    expect(doc.dirty).toBe(true);

    doc = withSavedFile(doc, "/tmp/notes.md");
    expect(doc.dirty).toBe(false);
    expect(doc.lastSavedText).toBe("# Notes\nmore");
  });

  it("save-as updates the path and title", () => {
    let doc = withText(createUntitledDocument(), "draft");
    doc = withSavedFile(doc, "/tmp/draft.md");
    expect(doc.path).toBe("/tmp/draft.md");
    expect(doc.title).toBe("draft.md");
    expect(doc.dirty).toBe(false);
  });

  it("derives titles from paths", () => {
    expect(titleFromPath(null)).toBe("Untitled");
    expect(titleFromPath("/a/b/c.md")).toBe("c.md");
  });

  it("prefixes the window title with a dirty marker", () => {
    const clean = createUntitledDocument();
    expect(windowTitle(clean)).toBe("Untitled — Markflow");
    expect(windowTitle(withText(clean, "x"))).toBe("• Untitled — Markflow");
  });
});
