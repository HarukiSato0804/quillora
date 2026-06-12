import type { EditorView } from "@codemirror/view";
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
  typewriterMode: boolean;
  onActivatePane: (paneId: PaneId) => void;
  onActivateDocument: (paneId: PaneId, documentId: DocumentId) => void;
  onCloseDocument: (paneId: PaneId, documentId: DocumentId) => void;
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
  onViewReady: (paneId: PaneId, view: EditorView) => void;
};

export function EditorPaneView({
  workspace,
  pane,
  active,
  typewriterMode,
  onActivatePane,
  onActivateDocument,
  onCloseDocument,
  onChangeDocument,
  onMoveTab,
  onCopyTab,
  onViewReady,
}: EditorPaneViewProps) {
  const documents = paneDocuments(workspace, pane.id);
  const activeDocument =
    documents.find((doc) => doc.id === pane.activeDocumentId) ?? null;

  return (
    <section
      className={active ? "editor-pane-view is-active" : "editor-pane-view"}
      onPointerDownCapture={() => onActivatePane(pane.id)}
    >
      <TabsBar
        paneId={pane.id}
        documents={documents}
        activeDocumentId={activeDocument?.id ?? null}
        onActivate={(documentId) => onActivateDocument(pane.id, documentId)}
        onClose={(documentId) => onCloseDocument(pane.id, documentId)}
        onMoveTab={onMoveTab}
        onCopyTab={onCopyTab}
      />
      {activeDocument ? (
        <MarkdownEditor
          value={activeDocument.text}
          onChange={(text) => onChangeDocument(activeDocument.id, text)}
          imageBaseDir={activeDocument.path ? dirname(activeDocument.path) : null}
          typewriterMode={typewriterMode}
          onViewReady={(view) => onViewReady(pane.id, view)}
        />
      ) : (
        <div className="editor-pane-empty" aria-label="Empty pane" />
      )}
    </section>
  );
}
