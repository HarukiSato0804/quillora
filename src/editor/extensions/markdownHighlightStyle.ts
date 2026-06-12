import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

const MONO = '"SF Mono", Menlo, Monaco, monospace';

// Overrides CodeMirror's default highlight style so the document reads
// like an editor preview rather than a browser default page: headings are
// not underlined, links keep their color without underlining the syntax,
// and only code is monospace.
const markflowHighlight = HighlightStyle.define([
  { tag: tags.heading, textDecoration: "none" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.monospace, fontFamily: MONO, fontSize: "0.92em" },
  { tag: tags.link, color: "#0969da", textDecoration: "none" },
  { tag: tags.url, color: "#9ca3af" },
  { tag: tags.quote, color: "#57606a" },
  { tag: tags.processingInstruction, color: "#9ca3af" },
  { tag: tags.comment, color: "#6e7781", fontStyle: "italic" },
  { tag: tags.keyword, color: "#cf222e" },
  { tag: tags.string, color: "#0a3069" },
  { tag: [tags.number, tags.bool], color: "#0550ae" },
  { tag: [tags.function(tags.variableName), tags.definition(tags.variableName)], color: "#8250df" },
]);

export function markdownHighlight(): Extension {
  return syntaxHighlighting(markflowHighlight);
}
