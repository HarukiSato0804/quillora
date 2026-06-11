import {
  EditorState,
  RangeSetBuilder,
  StateField,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import { parseImages, resolveImageUrl } from "../parser/parseImages";

export type ImageDecorationOptions = {
  baseDir: string | null;
  toAssetUrl: (absolutePath: string) => string;
};

class ImageWidget extends WidgetType {
  constructor(
    private readonly src: string,
    private readonly alt: string
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-md-image";
    const img = document.createElement("img");
    img.src = this.src;
    img.alt = this.alt;
    img.title = this.alt;
    wrapper.appendChild(img);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

const FENCE = /^ {0,3}(```|~~~)/;

export function buildImageDecorations(
  state: EditorState,
  options: ImageDecorationOptions
): DecorationSet {
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  const builder = new RangeSetBuilder<Decoration>();

  let insideFence = false;
  let fenceMarker = "";

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber);

    const fenceMatch = line.text.match(FENCE);
    if (fenceMatch) {
      if (!insideFence) {
        insideFence = true;
        fenceMarker = fenceMatch[1];
      } else if (fenceMatch[1] === fenceMarker) {
        insideFence = false;
      }
      continue;
    }
    if (insideFence || lineNumber === cursorLine) {
      continue;
    }

    for (const span of parseImages(line.text)) {
      const src = resolveImageUrl(span.url, options.baseDir, options.toAssetUrl);
      if (!src) {
        continue;
      }
      builder.add(
        line.from + span.from,
        line.from + span.to,
        Decoration.replace({ widget: new ImageWidget(src, span.alt) })
      );
    }
  }

  return builder.finish();
}

export function imageDecorations(options: ImageDecorationOptions): Extension {
  const field = StateField.define<DecorationSet>({
    create: (state) => buildImageDecorations(state, options),
    update(decorations, transaction) {
      if (transaction.docChanged || transaction.selection) {
        return buildImageDecorations(transaction.state, options);
      }
      return decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
  return [field];
}
