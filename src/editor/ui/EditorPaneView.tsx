import type { EditorView } from "@codemirror/view";
import type { DragEvent } from "react";
import { MarkdownEditor } from "../MarkdownEditor";
import { dirname } from "../parser/parseImages";
import {
  paneDocuments,
  type DocumentId,
  type EditorPane,
  type PaneId,
  type WorkspaceState,
} from "../store/workspaceStore";
import { TabsBar } from "./TabsBar";

type EditorPaneViewProps = {
  workspace: WorkspaceState;
  pane: EditorPane;
  active: boolean;
  draggedTab: { paneId: PaneId; documentId: DocumentId } | null;
  typewriterMode: boolean;
  onActivatePane: (paneId: PaneId) => void;
  onActivateDocument: (paneId: PaneId, documentId: DocumentId) => void;
  onCloseDocument: (paneId: PaneId, documentId: DocumentId) => void;
  onClosePane: (paneId: PaneId) => void;
  onSplitRight: (paneId: PaneId, documentId: DocumentId) => void;
  onSplitDown: (paneId: PaneId, documentId: DocumentId) => void;
  onChangeDocument: (documentId: DocumentId, text: string) => void;
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
  onTabDragStart: (dragged: { paneId: PaneId; documentId: DocumentId }) => void;
  onTabDragEnd: () => void;
  onDropTabOnEdge: (
    sourcePaneId: PaneId,
    documentId: DocumentId,
    targetPaneId: PaneId,
    edge: "left" | "right" | "top" | "bottom"
  ) => void;
  onViewReady: (paneId: PaneId, view: EditorView) => void;
};

export function EditorPaneView({
  workspace,
  pane,
  active,
  draggedTab,
  typewriterMode,
  onActivatePane,
  onActivateDocument,
  onCloseDocument,
  onClosePane,
  onSplitRight,
  onSplitDown,
  onChangeDocument,
  onMoveTab,
  onCopyTab,
  onTabDragStart,
  onTabDragEnd,
  onDropTabOnEdge,
  onViewReady,
}: EditorPaneViewProps) {
  const documents = paneDocuments(workspace, pane.id);
  const activeDocument =
    documents.find((doc) => doc.id === pane.activeDocumentId) ?? null;
  const canClosePane = workspace.panes.length >= 2;

  const handleEdgeDrop = (
    event: DragEvent<HTMLDivElement>,
    edge: "left" | "right" | "top" | "bottom"
  ) => {
    if (!draggedTab) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onDropTabOnEdge(draggedTab.paneId, draggedTab.documentId, pane.id, edge);
    onTabDragEnd();
  };

  return (
    <section
      className={active ? "editor-pane-view is-active" : "editor-pane-view"}
      onPointerDownCapture={() => onActivatePane(pane.id)}
    >
      <div className="editor-pane-header">
        <TabsBar
          paneId={pane.id}
          documents={documents}
          activeDocumentId={activeDocument?.id ?? null}
          onActivate={(documentId) => onActivateDocument(pane.id, documentId)}
          onClose={(documentId) => onCloseDocument(pane.id, documentId)}
          onSplitRight={onSplitRight}
          onSplitDown={onSplitDown}
          onMoveTab={onMoveTab}
          onCopyTab={onCopyTab}
          onTabDragStart={onTabDragStart}
          onTabDragEnd={onTabDragEnd}
        />
        {canClosePane && (
          <button
            type="button"
            className="pane-close"
            aria-label="Close pane"
            onClick={(event) => {
              event.stopPropagation();
              onClosePane(pane.id);
            }}
          >
            ×
          </button>
        )}
      </div>
      {activeDocument ? (
        <MarkdownEditor
          key={`${pane.id}:${activeDocument.id}`}
          value={activeDocument.text}
          onChange={(text) => onChangeDocument(activeDocument.id, text)}
          imageBaseDir={activeDocument.path ? dirname(activeDocument.path) : null}
          typewriterMode={typewriterMode}
          onViewReady={(view) => onViewReady(pane.id, view)}
        />
      ) : (
        <div className="editor-pane-empty" aria-label="Empty pane" />
      )}
      {draggedTab && (
        <div className="pane-edge-drop-zones" aria-hidden="true">
          {(["left", "right", "top", "bottom"] as const).map((edge) => (
            <div
              key={edge}
              className={`pane-edge-drop-zone pane-edge-drop-zone-${edge}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => handleEdgeDrop(event, edge)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
