import type { Heading } from "../parser/parseHeadings";

type SidebarProps = {
  headings: Heading[];
  outlineVisible: boolean;
};

export function Sidebar({ headings, outlineVisible }: SidebarProps) {
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
                  className="sidebar-item"
                  style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }}
                >
                  {heading.text || "(empty heading)"}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
