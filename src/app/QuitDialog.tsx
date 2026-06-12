type QuitDialogProps = {
  dirtyCount: number;
  onSaveAndQuit: () => void;
  onQuitWithoutSaving: () => void;
  onCancel: () => void;
};

export function QuitDialog({
  dirtyCount,
  onSaveAndQuit,
  onQuitWithoutSaving,
  onCancel,
}: QuitDialogProps) {
  return (
    <div className="quit-dialog-backdrop" role="presentation">
      <div
        className="quit-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="Unsaved changes"
      >
        <div className="quit-dialog-title">
          {dirtyCount === 1
            ? "You have 1 document with unsaved changes."
            : `You have ${dirtyCount} documents with unsaved changes.`}
        </div>
        <div className="quit-dialog-message">
          Your changes will be lost if you don't save them.
        </div>
        <div className="quit-dialog-buttons">
          <button className="quit-dialog-discard" onClick={onQuitWithoutSaving}>
            Don't Save
          </button>
          <span className="quit-dialog-buttons-spacer" />
          <button onClick={onCancel}>Cancel</button>
          <button className="quit-dialog-primary" onClick={onSaveAndQuit}>
            Save…
          </button>
        </div>
      </div>
    </div>
  );
}
