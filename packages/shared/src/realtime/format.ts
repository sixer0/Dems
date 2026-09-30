/**
 * Display-time formatting shared by both apps. Deterministic arithmetic (no `Intl`), so it
 * behaves the same in browsers, Node and Hermes.
 */

/** Demo display offset: UTC+07:00 (WIB, no DST; D28). */
export const DISPLAY_UTC_OFFSET_MINUTES = 420;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** `HH:mm:ss` of an ISO-8601 instant at a fixed UTC offset; `--:--:--` when absent or invalid. */
export function formatClock(
  iso: string | null | undefined,
  offsetMinutes: number = DISPLAY_UTC_OFFSET_MINUTES,
): string {
  if (!iso) return '--:--:--';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '--:--:--';
  const shifted = new Date(ms + offsetMinutes * 60_000);
  return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}`;
}
