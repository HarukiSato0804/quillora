import type { EditorView } from "@codemirror/view";
import {
  type DocumentId,
  type LayoutNode,
  type PaneId,
  type SplitId,
  type WorkspaceState,
} from "../store/workspaceStore";
import { EditorPaneView } from "./EditorPaneView";
import { ResizeHandle } from "./ResizeHandle";

type SplitPaneLayoutProps = {
  workspace: WorkspaceState;
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
  onResizeEnd: (splitId: SplitId, ratio: number) => void;
};

export function SplitPaneLayout(props: SplitPaneLayoutProps) {
  return <div className="split-layout">{renderNode(props.workspace.layout, props)}</div>;
}

function renderNode(node: LayoutNode, props: SplitPaneLayoutProps) {
  if (node.type === "pane") {
    const pane = props.workspace.panes.find((entry) => entry.id === node.paneId);
    if (!pane) {
      return null;
    }
    return (
      <EditorPaneView
        key={pane.id}
        workspace={props.workspace}
        pane={pane}
        active={props.workspace.activePaneId === pane.id}
        typewriterMode={props.typewriterMode}
        onActivatePane={props.onActivatePane}
        onActivateDocument={props.onActivateDocument}
        onCloseDocument={props.onCloseDocument}
        onChangeDocument={props.onChangeDocument}
        onMoveTab={props.onMoveTab}
        onCopyTab={props.onCopyTab}
        onViewReady={props.onViewReady}
      />
    );
  }

  return (
    <div
      key={node.id}
      className={`split-layout split-layout-${node.direction}`}
    >
      <div className="split-child" style={{ flexBasis: `${node.ratio * 100}%` }}>
        {renderNode(node.first, props)}
      </div>
      <ResizeHandle
        splitId={node.id}
        direction={node.direction}
        onResizeEnd={props.onResizeEnd}
      />
      <div
        className="split-child"
        style={{ flexBasis: `${(1 - node.ratio) * 100}%` }}
      >
        {renderNode(node.second, props)}
      </div>
    </div>
  );
}
