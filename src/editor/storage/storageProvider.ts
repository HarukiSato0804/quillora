// Storage provider abstraction. Documents can live on the local filesystem
// (the only provider today) or in Google Drive (issue #1). This module owns the
// vocabulary shared between the frontend store and the Drive integration so the
// UI layer never hardcodes provider-specific assumptions.

export type StorageProvider = "local" | "gdrive";

// MIME types we round-trip through Drive. Drive stores Markdown either as
// `text/markdown` or, for older files, `text/plain`; both open as Markdown here.
export type DriveMimeType = "text/markdown" | "text/plain";

// Metadata we track for a document backed by Google Drive. Mirrors the shape in
// issue #1 but split out so the local-only fields stay on OpenDocument.
export type DriveFileMeta = {
  fileId: string;
  name: string;
  mimeType: DriveMimeType;
  // Drive's modifiedTime / headRevisionId as of the last sync, used later for
  // conflict detection. Optional because a freshly created file may lack them.
  modifiedTime?: string;
  revisionId?: string;
  canEdit: boolean;
};

// A provider-tagged reference to a document's backing store. `local` documents
// carry a filesystem path; `gdrive` documents carry Drive metadata.
export type DocumentRef =
  | { provider: "local"; path: string | null }
  | { provider: "gdrive"; drive: DriveFileMeta };

const MARKDOWN_MIME: DriveMimeType = "text/markdown";
const PLAIN_MIME: DriveMimeType = "text/plain";

// Drive does not infer Markdown from a `.md` extension, so we pick the MIME type
// ourselves. `.txt` stays `text/plain`; everything else we treat as Markdown.
export function driveMimeTypeForName(name: string): DriveMimeType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ext === "txt" ? PLAIN_MIME : MARKDOWN_MIME;
}

export function isLocalRef(ref: DocumentRef): ref is { provider: "local"; path: string | null } {
  return ref.provider === "local";
}

export function isDriveRef(ref: DocumentRef): ref is { provider: "gdrive"; drive: DriveFileMeta } {
  return ref.provider === "gdrive";
}

// Whether the user can write back to this document. Local files are always
// editable; Drive files honor the `canEdit` capability Drive reports.
export function canEditRef(ref: DocumentRef): boolean {
  return isDriveRef(ref) ? ref.drive.canEdit : true;
}

// A stable, provider-aware identity for deduping open documents. Two tabs for
// the same Drive file id (or same local path) should resolve to one document.
export function refKey(ref: DocumentRef): string | null {
  if (isDriveRef(ref)) {
    return `gdrive:${ref.drive.fileId}`;
  }
  return ref.path ? `local:${ref.path}` : null;
}

// Display label for the storage provider, used in status bar / tab affordances.
export function providerLabel(provider: StorageProvider): string {
  return provider === "gdrive" ? "Google Drive" : "Local";
}
