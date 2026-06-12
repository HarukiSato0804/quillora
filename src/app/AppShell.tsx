import type { ReactNode } from "react";

type AppShellProps = {
  focusMode: boolean;
  tabsBar: ReactNode;
  sidebar: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
  canSplit: boolean;
  onNewFromTemplate: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onImportFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSplitRight: () => void;
  onSplitDown: () => void;
};

export function AppShell({
  focusMode,
  tabsBar,
  sidebar,
  statusBar,
  children,
  canSplit,
  onNewFromTemplate,
  onOpen,
  onOpenFolder,
  onImportFolder,
  onSave,
  onSaveAs,
  onSplitRight,
  onSplitDown,
}: AppShellProps) {
  return (
    <div className={focusMode ? "app-shell focus-mode" : "app-shell"}>
      <header className="toolbar">
        <button className="btn-secondary" onClick={onNewFromTemplate}>New▾</button>
        <button className="btn-secondary" onClick={onOpen}>Open…</button>
        <button className="btn-secondary" onClick={onOpenFolder}>Open Folder…</button>
        <button className="btn-secondary" onClick={onImportFolder}>Import Folder…</button>
        <button className="btn-primary" onClick={onSave}>Save</button>
        <button className="btn-secondary" onClick={onSaveAs}>Save As…</button>
        <span className="toolbar-sep" />
        <button className="btn-accent" onClick={onSplitRight} disabled={!canSplit} title="Split Right (⌘\)">Split Right</button>
        <button className="btn-accent" onClick={onSplitDown} disabled={!canSplit} title="Split Down (⌘⇧\)">Split Down</button>
      </header>
      {tabsBar}
      <div className="app-body">
        {sidebar}
        <main className="editor-pane">{children}</main>
      </div>
      {statusBar}
    </div>
  );
}
