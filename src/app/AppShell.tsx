import type { ReactNode } from "react";

type AppShellProps = {
  sidebar: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
};

export function AppShell({
  sidebar,
  statusBar,
  children,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="toolbar">
        <button onClick={onNew}>New</button>
        <button onClick={onOpen}>Open…</button>
        <button onClick={onSave}>Save</button>
        <button onClick={onSaveAs}>Save As…</button>
      </header>
      <div className="app-body">
        {sidebar}
        <main className="editor-pane">{children}</main>
      </div>
      {statusBar}
    </div>
  );
}
