import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import { headingDecorations } from "./extensions/headingDecorations";
import { inlineDecorations } from "./extensions/inlineDecorations";
import { imageDecorations } from "./extensions/imageDecorations";
import { mathDecorations } from "./extensions/mathDecorations";
import { tableDecorations } from "./extensions/tableDecorations";
import { mermaidDecorations } from "./extensions/mermaidDecorations";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  imageBaseDir: string | null;
};

export function MarkdownEditor({
  value,
  onChange,
  imageBaseDir,
}: MarkdownEditorProps) {
  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      headingDecorations(),
      inlineDecorations(),
      imageDecorations({ baseDir: imageBaseDir, toAssetUrl: convertFileSrc }),
      mathDecorations(),
      tableDecorations(),
      mermaidDecorations(),
      EditorView.lineWrapping,
    ],
    [imageBaseDir]
  );

  return (
    <CodeMirror
      className="markdown-editor"
      value={value}
      onChange={onChange}
      extensions={extensions}
      height="100%"
      autoFocus
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: true,
      }}
    />
  );
}
