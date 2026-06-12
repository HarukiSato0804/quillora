import type { Heading } from "../parser/parseHeadings";
import type { BundleEntry } from "../bundle/buildContextBundle";
import type { MarkdownFileKind, WorkspaceIndex } from "../store/workspaceFileStore";
import { ContextBundlePanel } from "./ContextBundlePanel";
import { LintPanel } from "./LintPanel";
import { ReferencePanel } from "./ReferencePanel";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

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
  workspaceIndex,
  workspaceFiles,
  activeContent,
  activeFilePath,
  activeKind,
  selectedBundlePaths,
  activeTab,
  onHeadingClick,
  onLineClick,
  onTabChange,
  onOpenWorkspaceFile,
  onToggleBundleFile,
  onRefreshWorkspace,
  onCopyBundle,
  onSaveBundle,
}: SidebarProps) {
  const bundleEntries: BundleEntry[] = workspaceFiles.map((file) => ({
    path: file.path,
    relativePath: file.relativePath,
    content: file.content,
  }));

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
        <button
          type="button"
          className={
            activeTab === "refs"
              ? "sidebar-tab sidebar-tab-active"
              : "sidebar-tab"
          }
          onClick={() => onTabChange("refs")}
        >
          REFS
        </button>
        <button
          type="button"
          className={
            activeTab === "lint"
              ? "sidebar-tab sidebar-tab-active"
              : "sidebar-tab"
          }
          onClick={() => onTabChange("lint")}
        >
          LINT
        </button>
        <button
          type="button"
          className={
            activeTab === "bundle"
              ? "sidebar-tab sidebar-tab-active"
              : "sidebar-tab"
          }
          onClick={() => onTabChange("bundle")}
        >
          BUNDLE
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
          selectedBundlePaths={selectedBundlePaths}
          onOpenFile={onOpenWorkspaceFile}
          onToggleBundleFile={onToggleBundleFile}
          onRefresh={onRefreshWorkspace}
        />
      )}
      {activeTab === "refs" && (
        <ReferencePanel
          files={workspaceFiles}
          workspaceRoot={workspaceIndex?.rootPath ?? null}
          onOpenFile={onOpenWorkspaceFile}
        />
      )}
      {activeTab === "lint" && (
        <LintPanel
          content={activeContent}
          filePath={activeFilePath}
          kind={activeKind}
          onLineClick={onLineClick}
        />
      )}
      {activeTab === "bundle" && (
        <ContextBundlePanel
          files={bundleEntries}
          selectedPaths={selectedBundlePaths}
          onToggleFile={onToggleBundleFile}
          onCopyBundle={onCopyBundle}
          onSaveBundle={onSaveBundle}
        />
      )}
    </aside>
  );
}
