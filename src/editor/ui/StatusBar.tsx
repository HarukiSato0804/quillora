import { isDirty, type OpenDocument } from "../store/workspaceStore";

type StatusBarProps = {
  document: OpenDocument | null;
};

const EXTERNAL_STATE_LABEL: Record<string, string | null> = {
  clean: null,
  "changed-on-disk": "Changed on disk",
  "deleted-on-disk": "File deleted on disk",
  conflict: "Conflicts with disk",
};

export function StatusBar({ document }: StatusBarProps) {
  const text = document?.text ?? "";
  const path = document?.path ?? "Untitled";
  const dirty = document !== null && isDirty(document);
  const lineCount = text === "" ? 0 : text.split("\n").length;
  const externalWarning = document
    ? EXTERNAL_STATE_LABEL[document.externalState]
    : null;

  return (
    <footer className="status-bar">
      <span className="status-path" title={path}>
        {path}
      </span>
      {externalWarning && (
        <span className="status-external-warning">⚠ {externalWarning}</span>
      )}
      <span className="status-spacer" />
      <span>{text.length} chars</span>
      <span>{lineCount} lines</span>
      <span className={dirty ? "status-dirty" : "status-saved"}>
        {dirty ? "Unsaved" : "Saved"}
      </span>
    </footer>
  );
}
