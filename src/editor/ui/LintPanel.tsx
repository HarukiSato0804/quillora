import { lintMarkdown } from "../linter/lintMarkdown";
import type { MarkdownFileKind } from "../store/workspaceFileStore";

type LintPanelProps = {
  content: string;
  filePath: string | null;
  kind: MarkdownFileKind;
  onLineClick: (line: number) => void;
};

export function LintPanel({
  content,
  filePath,
  kind,
  onLineClick,
}: LintPanelProps) {
  const result = lintMarkdown(content, kind, filePath ?? "Untitled");

  return (
    <div className="sidebar-panel lint-panel">
      <div className="sidebar-title">Lint</div>
      {result.issues.length === 0 ? (
        <div className="sidebar-empty">No lint issues</div>
      ) : (
        <ul className="panel-list">
          {result.issues.map((issue, index) => (
            <li
              className={`panel-list-item lint-issue lint-${issue.severity}`}
              key={`${issue.rule}-${issue.line ?? "file"}-${index}`}
            >
              <div className="lint-issue-header">
                <span className="lint-severity">{issue.severity}</span>
                <span className="lint-rule">{issue.rule}</span>
              </div>
              <div className="panel-text">{issue.message}</div>
              {issue.line !== undefined && (
                <button
                  type="button"
                  className="panel-link lint-line"
                  onClick={() => onLineClick(issue.line!)}
                >
                  Line {issue.line}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
