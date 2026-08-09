export function toIso(date: Date | string | null | undefined): string {
  if (date === null || date === undefined) return "";
  if (typeof date === "string") return date;
  return date.toISOString();
}

export function toIsoOrNull(
  date: Date | string | null | undefined
): string | null {
  if (date === null || date === undefined) return null;
  if (typeof date === "string") return date;
  return date.toISOString();
}
