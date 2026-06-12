import type { Heading } from "../parser/parseHeadings";
import type { WorkspaceIndex } from "../store/workspaceFileStore";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export type SidebarTab = "outline" | "workspace";

type SidebarProps = {
  headings: Heading[];
  outlineVisible: boolean;
  workspaceIndex: WorkspaceIndex;
  activeTab: SidebarTab;
  onHeadingClick?: (from: number) => void;
  onTabChange: (tab: SidebarTab) => void;
  onOpenWorkspaceFile: (path: string) => void;
  onRefreshWorkspace: () => void;
};

export function Sidebar({
  headings,
  outlineVisible,
  workspaceIndex,
  activeTab,
  onHeadingClick,
  onTabChange,
  onOpenWorkspaceFile,
  onRefreshWorkspace,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs" role="tablist" aria-label="Sidebar views">
        <button
          type="button"
          className={
            activeTab === "outline"
              ? "sidebar-tab sidebar-tab-active"
              : "sidebar-tab"
          }
          onClick={() => onTabChange("outline")}
        >
          Outline
        </button>
        <button
          type="button"
          className={
            activeTab === "workspace"
              ? "sidebar-tab sidebar-tab-active"
              : "sidebar-tab"
          }
          onClick={() => onTabChange("workspace")}
        >
          Workspace
        </button>
      </div>
      {activeTab === "outline" && outlineVisible && (
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
      {activeTab === "workspace" && (
        <WorkspaceSidebar
          workspaceIndex={workspaceIndex}
          onOpenFile={onOpenWorkspaceFile}
          onRefresh={onRefreshWorkspace}
        />
      )}
    </aside>
  );
}
