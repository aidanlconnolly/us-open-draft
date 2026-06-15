export type SortDir = "asc" | "desc";

export function compare<T>(a: T, b: T, dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") {
    return dir === "asc" ? a - b : b - a;
  }
  const sa = String(a);
  const sb = String(b);
  return dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
}
