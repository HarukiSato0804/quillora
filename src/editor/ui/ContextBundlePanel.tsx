import { useMemo, useState } from "react";
import {
  buildContextBundle,
  type BundleEntry,
} from "../bundle/buildContextBundle";

type ContextBundlePanelProps = {
  files: BundleEntry[];
  selectedPaths: Set<string>;
  onToggleFile: (path: string) => void;
  onCopyBundle: (markdown: string) => Promise<void>;
  onSaveBundle: (markdown: string) => Promise<void>;
};

export function ContextBundlePanel({
  files,
  selectedPaths,
  onToggleFile,
  onCopyBundle,
  onSaveBundle,
}: ContextBundlePanelProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const selectedEntries = useMemo(
    () => files.filter((file) => selectedPaths.has(file.path)),
    [files, selectedPaths]
  );
  const bundle = useMemo(
    () => buildContextBundle(selectedEntries),
    [selectedEntries]
  );

  const runAction = async (
    label: string,
    action: (markdown: string) => Promise<void>
  ) => {
    setStatus(null);
    try {
      await action(bundle.markdown);
      setStatus(label);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed");
    }
  };

  return (
    <div className="sidebar-panel bundle-panel">
      <div className="sidebar-title">Bundle Files</div>
      {files.length === 0 ? (
        <div className="sidebar-empty">Open a folder to select files.</div>
      ) : (
        <ul className="bundle-file-list">
          {files.map((file) => (
            <li className="bundle-file-item" key={file.path}>
              <label title={file.relativePath}>
                <input
                  type="checkbox"
                  checked={selectedPaths.has(file.path)}
                  onChange={() => onToggleFile(file.path)}
                />
                <span>{file.relativePath}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="bundle-stats">
        <div>{bundle.totalChars.toLocaleString()} chars</div>
        <div>{bundle.estimatedTokens.toLocaleString()} estimated tokens</div>
      </div>

      <div className="bundle-actions">
        <button
          type="button"
          onClick={() => setPreviewOpen((open) => !open)}
          disabled={selectedEntries.length === 0}
        >
          Preview Bundle
        </button>
        <button
          type="button"
          onClick={() => void runAction("Copied bundle", onCopyBundle)}
          disabled={selectedEntries.length === 0}
        >
          Copy to Clipboard
        </button>
        <button
          type="button"
          onClick={() => void runAction("Saved bundle", onSaveBundle)}
          disabled={selectedEntries.length === 0}
        >
          Save as .md
        </button>
      </div>

      {status && <div className="panel-meta bundle-status">{status}</div>}

      {previewOpen && selectedEntries.length > 0 && (
        <pre className="bundle-preview">{bundle.markdown}</pre>
      )}
    </div>
  );
}
