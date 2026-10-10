// Defensive JSON extraction for Gemma replies: strip ``` fences, find the outermost object, parse.
export function parseModelJson<T = any>(raw: string): T | null {
  if (!raw) return null;
  let s = raw.trim();
  const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    /* fall through */
  }
  const start = s.search(/[{[]/);
  if (start < 0) return null;
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  const end = s.lastIndexOf(close);
  if (end <= start) return null;
  const slice = s.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    // common Gemma slip: trailing commas
    try {
      return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1')) as T;
    } catch {
      return null;
    }
  }
}
