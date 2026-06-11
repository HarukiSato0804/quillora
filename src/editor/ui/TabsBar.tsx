import {
  isDirty,
  type DocumentId,
  type OpenDocument,
} from "../store/workspaceStore";

type TabsBarProps = {
  documents: OpenDocument[];
  activeDocumentId: DocumentId | null;
  onActivate: (id: DocumentId) => void;
  onClose: (id: DocumentId) => void;
};

export function TabsBar({
  documents,
  activeDocumentId,
  onActivate,
  onClose,
}: TabsBarProps) {
  return (
    <div className="tabs-bar" role="tablist">
      {documents.map((doc) => {
        const active = doc.id === activeDocumentId;
        return (
          <div
            key={doc.id}
            role="tab"
            aria-selected={active}
            className={active ? "tab tab-active" : "tab"}
            title={doc.path ?? "Untitled"}
            onClick={() => onActivate(doc.id)}
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                onClose(doc.id);
              }
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
  );
}
