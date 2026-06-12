import { useMemo } from "react";
import { buildReferenceGraph } from "../refgraph/buildReferenceGraph";

type ReferencePanelProps = {
  files: { path: string; relativePath: string; content: string }[];
  workspaceRoot: string | null;
  onOpenFile: (path: string) => void;
};

export function ReferencePanel({
  files,
  workspaceRoot,
  onOpenFile,
}: ReferencePanelProps) {
  const graph = useMemo(
    () =>
      workspaceRoot
        ? buildReferenceGraph(
            files.map((file) => ({ path: file.path, content: file.content })),
            workspaceRoot
          )
        : null,
    [files, workspaceRoot]
  );
  const relativeByPath = useMemo(
    () => new Map(files.map((file) => [file.path, file.relativePath])),
    [files]
  );

  if (!workspaceRoot || !graph) {
    return (
      <div className="sidebar-panel">
        <div className="sidebar-empty">Open a folder to inspect references.</div>
      </div>
    );
  }

  const referencesByFile = new Map<string, typeof graph.references>();
  for (const reference of graph.references) {
    const entries = referencesByFile.get(reference.sourceFile) ?? [];
    entries.push(reference);
    referencesByFile.set(reference.sourceFile, entries);
  }

  return (
    <div className="sidebar-panel reference-panel">
      <div className="sidebar-title">Broken References</div>
      {graph.brokenReferences.length === 0 ? (
        <div className="sidebar-empty">No broken references</div>
      ) : (
        <ul className="panel-list">
          {graph.brokenReferences.map((reference, index) => (
            <li className="panel-list-item" key={`${reference.sourceFile}-${index}`}>
              <button
                type="button"
                className="panel-link"
                onClick={() => onOpenFile(reference.sourceFile)}
                title={reference.sourceFile}
              >
                {relativeByPath.get(reference.sourceFile) ?? reference.sourceFile}
              </button>
              <div className="panel-meta">
                Line {reference.link.line}: {reference.link.target}
              </div>
              <div className="panel-status panel-status-error">
                {reference.status}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="sidebar-title panel-section-title">Reference Graph</div>
      {referencesByFile.size === 0 ? (
        <div className="sidebar-empty">No references found</div>
      ) : (
        Array.from(referencesByFile.entries()).map(([sourceFile, references]) => (
          <div className="panel-group" key={sourceFile}>
            <button
              type="button"
              className="panel-link panel-group-title"
              onClick={() => onOpenFile(sourceFile)}
              title={sourceFile}
            >
              {relativeByPath.get(sourceFile) ?? sourceFile}
            </button>
            <ul className="panel-list">
              {references.map((reference, index) => (
                <li
                  className="panel-list-item panel-list-item-compact"
                  key={`${sourceFile}-${reference.link.line}-${index}`}
                >
                  <div className="panel-meta">
                    {reference.link.kind} L{reference.link.line}
                  </div>
                  {reference.resolvedPath ? (
                    <button
                      type="button"
                      className="panel-link"
                      onClick={() => onOpenFile(reference.resolvedPath!)}
                      title={reference.resolvedPath}
                    >
                      {relativeByPath.get(reference.resolvedPath) ??
                        reference.resolvedPath}
                    </button>
                  ) : (
                    <span className="panel-text">{reference.link.target}</span>
                  )}
                  <div
                    className={
                      reference.status === "missing-file" ||
                      reference.status === "missing-heading"
                        ? "panel-status panel-status-error"
                        : "panel-status"
                    }
                  >
                    {reference.status}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
