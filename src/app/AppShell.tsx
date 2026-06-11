import type { ReactNode } from "react";

type AppShellProps = {
  focusMode: boolean;
  tabsBar: ReactNode;
  sidebar: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
};

export function AppShell({
  focusMode,
  tabsBar,
  sidebar,
  statusBar,
  children,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
}: AppShellProps) {
  return (
    <div className={focusMode ? "app-shell focus-mode" : "app-shell"}>
      <header className="toolbar">
        <button onClick={onNew}>New</button>
        <button onClick={onOpen}>Open…</button>
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
