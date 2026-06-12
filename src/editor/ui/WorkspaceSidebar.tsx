import {
  groupByKind,
  type MarkdownFileEntry,
  type MarkdownFileKind,
  type WorkspaceIndex,
} from "../store/workspaceFileStore";

type WorkspaceSidebarProps = {
  workspaceIndex: WorkspaceIndex;
  selectedBundlePaths?: Set<string>;
  onOpenFile: (path: string) => void;
  onToggleBundleFile?: (path: string) => void;
  onRefresh: () => void;
};

const GROUPS: Array<{ kind: MarkdownFileKind; label: string }> = [
  { kind: "skill", label: "Skills" },
  { kind: "agent", label: "Agents" },
  { kind: "prompt", label: "Prompts" },
  { kind: "design", label: "Design Docs" },
  { kind: "task", label: "Tasks" },
  { kind: "runbook", label: "Runbooks" },
  { kind: "adr", label: "ADRs" },
  { kind: "changelog", label: "Changelogs" },
  { kind: "unknown", label: "Other" },
];

export function WorkspaceSidebar({
  workspaceIndex,
  selectedBundlePaths,
  onOpenFile,
  onToggleBundleFile,
  onRefresh,
}: WorkspaceSidebarProps) {
  if (!workspaceIndex) {
    return (
      <div className="workspace-sidebar">
        <div className="workspace-sidebar-actions">
          <button type="button" onClick={onRefresh}>
            Refresh
          </button>
        </div>
        <div className="sidebar-empty">Open a folder to scan Markdown files.</div>
      </div>
    );
  }

  const grouped = groupByKind(workspaceIndex.files);
  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    files: grouped[group.kind],
  })).filter((group) => group.files.length > 0);

  return (
    <div className="workspace-sidebar">
      <div className="workspace-root" title={workspaceIndex.rootPath}>
        {workspaceIndex.rootPath}
      </div>
      <div className="workspace-sidebar-actions">
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      {visibleGroups.length === 0 ? (
        <div className="sidebar-empty">No Markdown files found</div>
      ) : (
        visibleGroups.map((group) => (
          <div className="workspace-group" key={group.kind}>
            <div className="workspace-group-title">{group.label}</div>
            {group.files.map((file) => (
              <WorkspaceFileButton
                file={file}
                key={file.path}
                selected={selectedBundlePaths?.has(file.path) ?? false}
                onOpenFile={onOpenFile}
                onToggleBundleFile={onToggleBundleFile}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function WorkspaceFileButton({
  file,
  selected,
  onOpenFile,
  onToggleBundleFile,
}: {
  file: MarkdownFileEntry;
  selected: boolean;
  onOpenFile: (path: string) => void;
  onToggleBundleFile?: (path: string) => void;
}) {
  return (
    <div className="workspace-file-row">
      {onToggleBundleFile && (
        <input
          aria-label={`Select ${file.relativePath} for bundle`}
          checked={selected}
          onChange={() => onToggleBundleFile(file.path)}
          type="checkbox"
        />
      )}
      <button
        type="button"
        className="workspace-file-item"
        title={file.relativePath}
        onClick={() => onOpenFile(file.path)}
      >
        {file.relativePath}
      </button>
    </div>
  );
}
