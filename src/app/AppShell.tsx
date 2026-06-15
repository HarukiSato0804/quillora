import type { ReactNode } from "react";

type AppShellProps = {
  focusMode: boolean;
  tabsBar: ReactNode;
  sidebar: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
};

export function AppShell({
  focusMode,
  tabsBar,
  sidebar,
  statusBar,
  children,
  sidebarVisible,
  onToggleSidebar,
}: AppShellProps) {
  return (
    <div className={focusMode ? "app-shell focus-mode" : "app-shell"}>
      <header className="toolbar">
        <button
          className="btn-icon"
          onClick={onToggleSidebar}
          aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
        >
          ◧
        </button>
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
