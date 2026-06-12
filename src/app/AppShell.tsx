import type { ReactNode } from "react";

type AppShellProps = {
  focusMode: boolean;
  tabsBar: ReactNode;
  sidebar: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
  onNewFromTemplate: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
};

export function AppShell({
  focusMode,
  tabsBar,
  sidebar,
  statusBar,
  children,
  onNewFromTemplate,
  onOpen,
  onOpenFolder,
  onSave,
  onSaveAs,
}: AppShellProps) {
  return (
    <div className={focusMode ? "app-shell focus-mode" : "app-shell"}>
      <header className="toolbar">
        <button onClick={onNewFromTemplate}>New▾</button>
        <button onClick={onOpen}>Open…</button>
        <button onClick={onOpenFolder}>Open Folder…</button>
        <button onClick={onSave}>Save</button>
        <button onClick={onSaveAs}>Save As…</button>
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
