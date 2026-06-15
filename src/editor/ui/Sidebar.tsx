import type { Heading } from "../parser/parseHeadings";
import type { MarkdownFileKind, WorkspaceIndex } from "../store/workspaceFileStore";

export type SidebarTab = "outline" | "workspace" | "refs" | "lint" | "bundle";

type SidebarProps = {
  headings: Heading[];
  outlineVisible: boolean;
  workspaceIndex: WorkspaceIndex;
  workspaceFiles: { path: string; relativePath: string; content: string }[];
  activeContent: string;
  activeFilePath: string | null;
  activeKind: MarkdownFileKind;
  selectedBundlePaths: Set<string>;
  activeTab: SidebarTab;
  onHeadingClick?: (from: number) => void;
  onLineClick: (line: number) => void;
  onTabChange: (tab: SidebarTab) => void;
  onOpenWorkspaceFile: (path: string) => void;
  onToggleBundleFile: (path: string) => void;
  onRefreshWorkspace: () => void;
  onCopyBundle: (markdown: string) => Promise<void>;
  onSaveBundle: (markdown: string) => Promise<void>;
};

export function Sidebar({
  headings,
  outlineVisible,
  onHeadingClick,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      {outlineVisible && (
        <>
          <div className="sidebar-title">Outline</div>
          {headings.length === 0 ? (
            <div className="sidebar-empty">No headings</div>
          ) : (
            <ul className="sidebar-list">
              {headings.map((heading) => (
                <li
                  key={`${heading.line}-${heading.text}`}
                  className="sidebar-list-item"
                >
                  <button
                    type="button"
                    className="sidebar-item"
                    style={{
                      marginLeft: `${(heading.level - 1) * 12}px`,
                      width: `calc(100% - ${(heading.level - 1) * 12}px)`,
                    }}
                    onClick={() => onHeadingClick?.(heading.from)}
                  >
                    {heading.text || "(empty heading)"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
