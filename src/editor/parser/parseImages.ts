export type ImageSpan = {
  from: number;
  to: number;
  alt: string;
  url: string;
};

const IMAGE = /!\[([^\]\n]*)\]\(([^()\n]+)\)/g;

export function parseImages(lineText: string): ImageSpan[] {
  const spans: ImageSpan[] = [];
  for (const match of lineText.matchAll(IMAGE)) {
    spans.push({
      from: match.index,
      to: match.index + match[0].length,
      alt: match[1],
      url: match[2].trim(),
    });
  }
  return spans;
}

// Resolves a Markdown image URL to something the webview can load.
// Returns null when the URL cannot be resolved (e.g. a relative path in an
// unsaved document).
export function resolveImageUrl(
  url: string,
  baseDir: string | null,
  toAssetUrl: (absolutePath: string) => string
): string | null {
  if (/^(https?|data|asset):/i.test(url)) {
    return url;
  }
  if (url.startsWith("/")) {
    return toAssetUrl(url);
  }
  if (baseDir) {
    return toAssetUrl(`${baseDir}/${url}`);
  }
  return null;
}

export function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index > 0 ? path.slice(0, index) : "/";
}
