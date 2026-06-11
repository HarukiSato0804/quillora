export type DocumentState = {
  path: string | null;
  title: string;
  text: string;
  dirty: boolean;
  lastSavedText: string;
};

export function titleFromPath(path: string | null): string {
  if (path === null) {
    return "Untitled";
  }
  const segments = path.split("/");
  return segments[segments.length - 1] || "Untitled";
}

export function createUntitledDocument(): DocumentState {
  return {
    path: null,
    title: "Untitled",
    text: "",
    dirty: false,
    lastSavedText: "",
  };
}

export function withText(state: DocumentState, text: string): DocumentState {
  return {
    ...state,
    text,
    dirty: text !== state.lastSavedText,
  };
}

export function withOpenedFile(path: string, contents: string): DocumentState {
  return {
    path,
    title: titleFromPath(path),
    text: contents,
    dirty: false,
    lastSavedText: contents,
  };
}

export function withSavedFile(
  state: DocumentState,
  path: string
): DocumentState {
  return {
    ...state,
    path,
    title: titleFromPath(path),
    dirty: false,
    lastSavedText: state.text,
  };
}

export function windowTitle(state: DocumentState): string {
  const marker = state.dirty ? "• " : "";
  return `${marker}${state.title} — Markflow`;
}
