// Only same-origin paths may be used as post-auth redirect targets. Protocol-relative paths
// ("//host"), backslash tricks ("/\host", which browsers read as "//host"), control characters
// (tabs and newlines are stripped by URL parsers) and anything that resolves to another origin
// fall back to the supplied path.
const PLACEHOLDER_ORIGIN = "http://clinic-redirect.invalid";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || CONTROL_CHARACTERS.test(value)) return fallback;
  try {
    const resolved = new URL(value, PLACEHOLDER_ORIGIN);
    return resolved.origin === PLACEHOLDER_ORIGIN ? value : fallback;
  } catch {
    return fallback;
  }
}
