import { describe, expect, it } from "vitest";
import {
  classifyDroppedPath,
  classifyDroppedPaths,
  extractPathsFromDataTransfer,
  fileUriToPath,
  splitDroppedPaths,
} from "./dropClassification";
import { planOpenPaths } from "./openPipeline";
import { addDocuments, createWorkspace } from "../store/workspaceStore";

describe("classifyDroppedPath", () => {
  it("classifies markdown files", () => {
    expect(classifyDroppedPath("/notes/a.md")).toEqual({
      type: "markdown",
      path: "/notes/a.md",
    });
    expect(classifyDroppedPath("/notes/a.TXT").type).toBe("markdown");
  });

  it("classifies images", () => {
    expect(classifyDroppedPath("/pics/cat.PNG").type).toBe("image");
    expect(classifyDroppedPath("/pics/cat.jpeg").type).toBe("image");
  });

  it("classifies extensionless paths as directories", () => {
    expect(classifyDroppedPath("/Users/me/Documents").type).toBe("directory");
  });

  it("respects an explicit directory hint", () => {
    expect(classifyDroppedPath("/odd/folder.md", { isDirectory: true })).toEqual(
      { type: "directory", path: "/odd/folder.md" }
    );
  });

  it("classifies everything else as unsupported", () => {
    expect(classifyDroppedPath("/bin/tool.exe").type).toBe("unsupported");
  });

  it("classifies batches in order", () => {
    expect(
      classifyDroppedPaths(["/a.md", "/b.png", "/dir", "/c.zip"]).map(
        (item) => item.type
      )
    ).toEqual(["markdown", "image", "directory", "unsupported"]);
  });
});

describe("splitDroppedPaths", () => {
  it("sends markdown to the pipeline and reports the rest", () => {
    const split = splitDroppedPaths(["/a.md", "/b.png", "/dir", "/c.zip"]);
    expect(split.markdownPaths).toEqual(["/a.md"]);
    expect(split.problems).toHaveLength(3);
    expect(split.problems[0]).toContain("/b.png");
  });

  it("opens multiple markdown files as multiple targets", () => {
    const split = splitDroppedPaths(["/a.md", "/b.markdown"]);
    expect(split.markdownPaths).toEqual(["/a.md", "/b.markdown"]);
    expect(split.problems).toEqual([]);
  });

  it("duplicate and already-open drops are handled by the open pipeline", () => {
    const workspace = addDocuments(createWorkspace(), [
      { path: "/open.md", text: "A", id: "open" },
    ]);
    const split = splitDroppedPaths(["/open.md", "/new.md", "/new.md"]);
    const plan = planOpenPaths(workspace, split.markdownPaths);
    expect(plan.toRead).toEqual(["/new.md"]);
    expect(plan.entries[0]).toEqual({
      kind: "already-open",
      path: "/open.md",
      id: "open",
    });
  });
});

describe("fileUriToPath", () => {
  it("decodes POSIX file URIs", () => {
    expect(fileUriToPath("file:///Users/me/My%20Note.md")).toBe(
      "/Users/me/My Note.md"
    );
  });

  it("accepts localhost file URIs", () => {
    expect(fileUriToPath("file://localhost/Users/me/a.md")).toBe(
      "/Users/me/a.md"
    );
  });

  it("returns an empty string for non-file URIs", () => {
    expect(fileUriToPath("https://example.com/a.md")).toBe("");
  });
});

describe("extractPathsFromDataTransfer", () => {
  function dataTransfer(
    types: string[],
    data: string
  ): DataTransfer {
    return {
      types,
      getData: (type: string) => (type === "text/uri-list" ? data : ""),
    } as DataTransfer;
  }

  it("extracts decoded file paths from text/uri-list", () => {
    const dt = dataTransfer(
      ["text/uri-list"],
      "# comment\nfile:///Users/me/A%20Note.md\r\nfile:///tmp/b.md"
    );
    expect(extractPathsFromDataTransfer(dt)).toEqual([
      "/Users/me/A Note.md",
      "/tmp/b.md",
    ]);
  });

  it("ignores drops without text/uri-list", () => {
    expect(extractPathsFromDataTransfer(dataTransfer(["Files"], ""))).toEqual(
      []
    );
  });
});
