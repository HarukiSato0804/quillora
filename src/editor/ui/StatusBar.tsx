import { isDirty, type OpenDocument } from "../store/workspaceStore";

type StatusBarProps = {
  document: OpenDocument | null;
};

export function StatusBar({ document }: StatusBarProps) {
  const text = document?.text ?? "";
  const path = document?.path ?? "Untitled";
  const dirty = document !== null && isDirty(document);
  const lineCount = text === "" ? 0 : text.split("\n").length;

  return (
    <footer className="status-bar">
      <span className="status-path" title={path}>
        {path}
      </span>
      <span className="status-spacer" />
      <span>{text.length} chars</span>
      <span>{lineCount} lines</span>
      <span className={dirty ? "status-dirty" : "status-saved"}>
        {dirty ? "Unsaved" : "Saved"}
      </span>
    </footer>
  );
}
