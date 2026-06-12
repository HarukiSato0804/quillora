import { describe, expect, it } from "vitest";
import { isSupportedMarkdownPath, planOpenPaths } from "./openPipeline";
import {
  addDocuments,
  createWorkspace,
} from "../store/workspaceStore";

describe("isSupportedMarkdownPath", () => {
  it("accepts md, markdown, mdx, and txt with any case", () => {
    expect(isSupportedMarkdownPath("/a/b.md")).toBe(true);
    expect(isSupportedMarkdownPath("/a/B.MD")).toBe(true);
    expect(isSupportedMarkdownPath("/a/b.markdown")).toBe(true);
    expect(isSupportedMarkdownPath("/a/b.mdx")).toBe(true);
    expect(isSupportedMarkdownPath("/a/b.MDX")).toBe(true);
    expect(isSupportedMarkdownPath("/a/b.txt")).toBe(true);
  });

  it("rejects other extensions, extensionless, and dotfiles", () => {
    expect(isSupportedMarkdownPath("/a/image.png")).toBe(false);
    expect(isSupportedMarkdownPath("/a/README")).toBe(false);
    expect(isSupportedMarkdownPath("/a/.md")).toBe(false);
    expect(isSupportedMarkdownPath("/a.md/file.png")).toBe(false);
  });
});

describe("planOpenPaths", () => {
  const workspace = addDocuments(createWorkspace(), [
    { path: "/open.md", text: "A", id: "open" },
  ]);

  it("classifies new paths as reads", () => {
    const plan = planOpenPaths(workspace, ["/new.md"]);
    expect(plan.entries).toEqual([{ kind: "read", path: "/new.md" }]);
    expect(plan.toRead).toEqual(["/new.md"]);
  });

  it("dedupes repeated paths", () => {
    const plan = planOpenPaths(workspace, ["/new.md", "/new.md", "/new.md"]);
    expect(plan.toRead).toEqual(["/new.md"]);
  });

  it("detects already-open documents", () => {
    const plan = planOpenPaths(workspace, ["/open.md"]);
    expect(plan.entries).toEqual([
      { kind: "already-open", path: "/open.md", id: "open" },
    ]);
    expect(plan.toRead).toEqual([]);
  });

  it("handles mixed new and already-open paths in selection order", () => {
    const plan = planOpenPaths(workspace, ["/new.md", "/open.md", "/b.txt"]);
    expect(plan.entries.map((entry) => entry.kind)).toEqual([
      "read",
      "already-open",
      "read",
    ]);
    expect(plan.toRead).toEqual(["/new.md", "/b.txt"]);
  });

  it("rejects unsupported files", () => {
    const plan = planOpenPaths(workspace, ["/image.png", "/new.md"]);
    expect(plan.unsupported).toEqual(["/image.png"]);
    expect(plan.toRead).toEqual(["/new.md"]);
  });
});
