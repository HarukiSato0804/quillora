import type { DocumentState } from "../store/documentStore";

type StatusBarProps = {
  document: DocumentState;
};

export function StatusBar({ document }: StatusBarProps) {
  const lineCount = document.text === "" ? 0 : document.text.split("\n").length;

  return (
    <footer className="status-bar">
      <span className="status-path" title={document.path ?? "Untitled"}>
        {document.path ?? "Untitled"}
      </span>
      <span className="status-spacer" />
      <span>{document.text.length} chars</span>
      <span>{lineCount} lines</span>
      <span className={document.dirty ? "status-dirty" : "status-saved"}>
        {document.dirty ? "Unsaved" : "Saved"}
      </span>
    </footer>
  );
}
