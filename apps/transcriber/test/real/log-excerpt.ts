// The excerpt of a server log that may be kept as evidence (fix round 1, navigator finding N-4).
//
// D230: no speed or duration figure anywhere. The oMLX server prints how long a request took, and
// its line timestamps would give the same figure by subtraction. An excerpt therefore keeps WHAT
// happened and drops WHEN and HOW LONG: the leading timestamp of every line goes, and so does every
// number with a time or rate unit. Credentials are blanked by the shared rule set on top.
import { redactCredentialText } from '@dems/shared/api';

/** The lines worth keeping: the device the engine runs on, and one line per request and refusal. */
const KEPT = /Device\(|STT transcribe|TTS synthesize|\/v1\/audio\/|\/v1\/models/;
const LEADING_TIMESTAMP = /^\s*\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?\s*(?:-\s*)?/;
const CLOCK = /\b\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g;
/** A number with a time or rate unit, with the separator before it: `, 9.99s`, ` in 120 ms`, `35.2 tokens/s`, `0.4x`. */
const TIMING = /(?:,\s*|\s+in\s+|\s+took\s+|\s+)?\b\d+(?:\.\d+)?\s*(?:ms|msec|s|sec|secs|seconds?|min|minutes?|x|(?:tok(?:ens)?|chars?|it|samples?|frames?)\s*\/\s*s(?:ec)?)\b/gi;

/** One line with its timestamp and every timing figure removed. */
export function stripTimingFields(line: string): string {
  return line.replace(LEADING_TIMESTAMP, '').replace(CLOCK, '').replace(TIMING, '');
}

/** True when a text still holds something that reads as a duration, a clock time or a rate. */
export function holdsTimingFigure(text: string): boolean {
  return new RegExp(TIMING.source, 'i').test(text) || new RegExp(CLOCK.source).test(text) || /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text);
}

/** The excerpt of a whole log: kept lines only, stripped, blanked. Throws rather than return a line that still holds a figure. */
export function excerptServerLog(log: string): string[] {
  const lines = log
    .split('\n')
    .filter((line) => KEPT.test(line))
    .map((line) => redactCredentialText(stripTimingFields(line)).trimEnd());
  const left = lines.find(holdsTimingFigure);
  if (left !== undefined) throw new Error('a timing figure survived the excerpt step; the excerpt is not written');
  return lines;
}
