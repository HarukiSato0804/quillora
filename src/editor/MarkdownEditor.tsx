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
import { typewriterScroll } from "./extensions/typewriterScroll";
import { codeBlockDecorations } from "./extensions/codeBlockDecorations";
import { listDecorations } from "./extensions/listDecorations";
import { taskListDecorations } from "./extensions/taskListDecorations";
import { horizontalRuleDecorations } from "./extensions/horizontalRuleDecorations";
import { markdownHighlight } from "./extensions/markdownHighlightStyle";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  imageBaseDir: string | null;
  typewriterMode: boolean;
  onViewReady?: (view: EditorView) => void;
};

export function MarkdownEditor({
  value,
  onChange,
  imageBaseDir,
  typewriterMode,
  onViewReady,
}: MarkdownEditorProps) {
  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      markdownHighlight(),
      codeBlockDecorations(),
      taskListDecorations(),
      listDecorations(),
      horizontalRuleDecorations(),
      headingDecorations(),
      inlineDecorations(),
      imageDecorations({ baseDir: imageBaseDir, toAssetUrl: convertFileSrc }),
      mathDecorations(),
      tableDecorations(),
      mermaidDecorations(),
      ...(typewriterMode ? [typewriterScroll()] : []),
      EditorView.lineWrapping,
    ],
    [imageBaseDir, typewriterMode]
  );

  return (
    <CodeMirror
      className="markdown-editor"
      value={value}
      onChange={onChange}
      onCreateEditor={(view) => onViewReady?.(view)}
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
