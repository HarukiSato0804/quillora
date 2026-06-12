import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  isDirty,
  type DocumentId,
  type OpenDocument,
  type PaneId,
} from "../store/workspaceStore";

const TAB_DRAG_MIME = "application/x-markflow-tab";

type DraggedTab = {
  paneId: PaneId;
  documentId: DocumentId;
};

type TabContextMenu = {
  x: number;
  y: number;
  paneId: PaneId;
  documentId: DocumentId;
};

type TabsBarProps = {
  paneId: PaneId;
  documents: OpenDocument[];
  activeDocumentId: DocumentId | null;
  onActivate: (id: DocumentId) => void;
  onClose: (id: DocumentId) => void;
  onSplitRight: (paneId: PaneId, documentId: DocumentId) => void;
  onSplitDown: (paneId: PaneId, documentId: DocumentId) => void;
  onMoveTab: (
    sourcePaneId: PaneId,
    documentId: DocumentId,
    targetPaneId: PaneId,
    targetIndex: number
  ) => void;
  onCopyTab: (
    documentId: DocumentId,
    targetPaneId: PaneId,
    targetIndex: number
  ) => void;
  onTabDragStart: (dragged: DraggedTab) => void;
  onTabDragEnd: () => void;
};

export function TabsBar({
  paneId,
  documents,
  activeDocumentId,
  onActivate,
  onClose,
  onSplitRight,
  onSplitDown,
  onMoveTab,
  onCopyTab,
  onTabDragStart,
  onTabDragEnd,
}: TabsBarProps) {
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<TabContextMenu | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const dismissOnPointerDown = (event: PointerEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setContextMenu(null);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };
    document.addEventListener("pointerdown", dismissOnPointerDown);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnPointerDown);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [contextMenu]);

  const readDraggedTab = (dataTransfer: DataTransfer): DraggedTab | null => {
    const raw = dataTransfer.getData(TAB_DRAG_MIME);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as DraggedTab;
    } catch {
      return null;
    }
  };

  const tabIndexForEvent = (
    event: DragEvent<HTMLElement>,
    index: number
  ): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX < rect.left + rect.width / 2 ? index : index + 1;
  };

  const handleDrop = (
    event: DragEvent<HTMLElement>,
    targetIndex: number
  ) => {
    const dragged = readDraggedTab(event.dataTransfer);
    setInsertIndex(null);
    if (!dragged) {
      return;
    }
    event.preventDefault();
    if (event.altKey) {
      onCopyTab(dragged.documentId, paneId, targetIndex);
    } else {
      onMoveTab(dragged.paneId, dragged.documentId, paneId, targetIndex);
    }
  };

  return (
    <>
      <div
        className="tabs-bar"
        role="tablist"
        onDragOver={(event) => {
          if (!Array.from(event.dataTransfer.types).includes(TAB_DRAG_MIME)) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
          setInsertIndex(documents.length);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setInsertIndex(null);
          }
        }}
        onDrop={(event) => handleDrop(event, insertIndex ?? documents.length)}
      >
        {documents.map((doc) => {
          const active = doc.id === activeDocumentId;
          const index = documents.findIndex((entry) => entry.id === doc.id);
          return (
            <div
              key={doc.id}
              role="tab"
              aria-selected={active}
              className={[
                active ? "tab tab-active" : "tab",
                insertIndex === index ? "tab-insert-before" : "",
                insertIndex === index + 1 ? "tab-insert-after" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={doc.path ?? "Untitled"}
              draggable
              onDragStart={(event) => {
                const dragged = { paneId, documentId: doc.id } satisfies DraggedTab;
                event.dataTransfer.effectAllowed = "copyMove";
                event.dataTransfer.setData(TAB_DRAG_MIME, JSON.stringify(dragged));
                onTabDragStart(dragged);
              }}
              onDragEnd={() => {
                setInsertIndex(null);
                onTabDragEnd();
              }}
              onDragOver={(event) => {
                if (!Array.from(event.dataTransfer.types).includes(TAB_DRAG_MIME)) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
                setInsertIndex(tabIndexForEvent(event, index));
              }}
              onDrop={(event) => {
                event.stopPropagation();
                handleDrop(event, tabIndexForEvent(event, index));
              }}
              onClick={() => onActivate(doc.id)}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  onClose(doc.id);
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  paneId,
                  documentId: doc.id,
                });
              }}
            >
              <span className="tab-title">{doc.title}</span>
              {isDirty(doc) && (
                <span className="tab-dirty" aria-label="unsaved changes">
                  ●
                </span>
              )}
              <button
                className="tab-close"
                aria-label={`Close ${doc.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(doc.id);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onSplitRight(contextMenu.paneId, contextMenu.documentId);
              setContextMenu(null);
            }}
          >
            Split Right
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onSplitDown(contextMenu.paneId, contextMenu.documentId);
              setContextMenu(null);
            }}
          >
            Split Down
          </button>
        </div>
      )}
    </>
  );
}
