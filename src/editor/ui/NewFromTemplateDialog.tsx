import { useState } from "react";
import {
  getTemplateById,
  TEMPLATES,
  type TemplateId,
} from "../templates/markdownTemplates";

type NewFromTemplateDialogProps = {
  onCreate: (templateId: TemplateId) => void;
  onSaveAs: (templateId: TemplateId) => void;
  onCancel: () => void;
};

export function NewFromTemplateDialog({
  onCreate,
  onSaveAs,
  onCancel,
}: NewFromTemplateDialogProps) {
  const [selectedId, setSelectedId] = useState<TemplateId>("skill");
  const selected = getTemplateById(selectedId);

  return (
    <div className="template-dialog-backdrop" role="presentation">
      <div
        className="template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-dialog-title"
      >
        <div id="template-dialog-title" className="template-dialog-title">
          New from Template
        </div>
        <div className="template-list">
          {TEMPLATES.map((template) => (
            <button
              type="button"
              key={template.id}
              className={
                template.id === selectedId
                  ? "template-item template-item-active"
                  : "template-item"
              }
              onClick={() => setSelectedId(template.id)}
              onDoubleClick={() => onCreate(template.id)}
            >
              <span className="template-label">{template.label}</span>
              <span className="template-filename">
                {template.defaultFilename}
              </span>
            </button>
          ))}
        </div>
        <div className="template-dialog-buttons">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <div className="template-dialog-buttons-spacer" />
          <button
            type="button"
            onClick={() => selected && onSaveAs(selected.id)}
            disabled={!selected}
          >
            Save As…
          </button>
          <button
            type="button"
            className="template-dialog-primary"
            onClick={() => selected && onCreate(selected.id)}
            disabled={!selected}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
