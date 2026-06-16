import { describe, expect, it } from "vitest";
import {
  canEditRef,
  driveMimeTypeForName,
  isDriveRef,
  isLocalRef,
  providerLabel,
  refKey,
  type DocumentRef,
} from "./storageProvider";

const localRef: DocumentRef = { provider: "local", path: "/notes/a.md" };
const driveRef: DocumentRef = {
  provider: "gdrive",
  drive: {
    fileId: "1AbC",
    name: "a.md",
    mimeType: "text/markdown",
    canEdit: true,
  },
};

describe("storageProvider", () => {
  it("picks text/plain for .txt and text/markdown otherwise", () => {
    expect(driveMimeTypeForName("notes.txt")).toBe("text/plain");
    expect(driveMimeTypeForName("notes.md")).toBe("text/markdown");
    expect(driveMimeTypeForName("notes.markdown")).toBe("text/markdown");
    expect(driveMimeTypeForName("README")).toBe("text/markdown");
    expect(driveMimeTypeForName("NOTES.TXT")).toBe("text/plain");
  });

  it("narrows refs by provider", () => {
    expect(isLocalRef(localRef)).toBe(true);
    expect(isDriveRef(localRef)).toBe(false);
    expect(isDriveRef(driveRef)).toBe(true);
    expect(isLocalRef(driveRef)).toBe(false);
  });

  it("treats local files as always editable and honors Drive canEdit", () => {
    expect(canEditRef(localRef)).toBe(true);
    expect(canEditRef(driveRef)).toBe(true);
    expect(
      canEditRef({
        provider: "gdrive",
        drive: { ...driveRef.drive, canEdit: false },
      })
    ).toBe(false);
  });

  it("builds provider-aware dedupe keys", () => {
    expect(refKey(localRef)).toBe("local:/notes/a.md");
    expect(refKey(driveRef)).toBe("gdrive:1AbC");
    expect(refKey({ provider: "local", path: null })).toBeNull();
  });

  it("labels providers for display", () => {
    expect(providerLabel("local")).toBe("Local");
    expect(providerLabel("gdrive")).toBe("Google Drive");
  });
});
