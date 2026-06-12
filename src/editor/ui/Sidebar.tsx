import type { Heading } from "../parser/parseHeadings";

type SidebarProps = {
  headings: Heading[];
  outlineVisible: boolean;
  onHeadingClick?: (from: number) => void;
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
