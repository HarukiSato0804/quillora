import { describe, expect, it } from "vitest";
import { dirname, parseImages, resolveImageUrl } from "./parseImages";

describe("parseImages", () => {
  it("returns nothing for plain text", () => {
    expect(parseImages("no images here")).toEqual([]);
  });

  it("parses an image with alt and url", () => {
    const spans = parseImages("before ![logo](images/logo.png) after");
    expect(spans).toEqual([
      {
        from: 7,
        to: 31,
        alt: "logo",
        url: "images/logo.png",
      },
    ]);
  });

  it("allows empty alt text", () => {
    expect(parseImages("![](a.png)")).toEqual([
      { from: 0, to: 10, alt: "", url: "a.png" },
    ]);
  });

  it("parses multiple images on one line", () => {
    const spans = parseImages("![a](1.png) ![b](2.png)");
    expect(spans.map((s) => s.url)).toEqual(["1.png", "2.png"]);
  });
});

describe("resolveImageUrl", () => {
  const toAsset = (path: string) => `asset:${path}`;

  it("passes through http and https urls", () => {
    expect(resolveImageUrl("https://x.test/a.png", null, toAsset)).toBe(
      "https://x.test/a.png"
    );
  });

  it("converts absolute paths", () => {
    expect(resolveImageUrl("/tmp/a.png", null, toAsset)).toBe(
      "asset:/tmp/a.png"
    );
  });

  it("resolves relative paths against the base directory", () => {
    expect(resolveImageUrl("img/a.png", "/docs", toAsset)).toBe(
      "asset:/docs/img/a.png"
    );
  });

  it("returns null for relative paths without a base directory", () => {
    expect(resolveImageUrl("img/a.png", null, toAsset)).toBeNull();
  });
});

describe("dirname", () => {
  it("returns the parent directory", () => {
    expect(dirname("/a/b/c.md")).toBe("/a/b");
  });

  it("returns / for files at the root", () => {
    expect(dirname("/c.md")).toBe("/");
  });
});
