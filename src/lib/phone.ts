/**
 * Normalize raw phone input into canonical international format (`+998...` or `+<digits>`).
 * Returns empty string if input has fewer than 7 digits.
 */
export function normalizeAuthPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 9) {
    return `+998${digits}`;
  }
  if (digits.length >= 7) {
    return `+${digits}`;
  }
  return "";
}
