/**
 * The reader of the capture program's own device list on macOS (task 4 row N6; design 2.3 row
 * L3; review SM-03, SM-10 (2)): from the diagnostics of the list row to the AUDIO entries, each
 * an INDEX and a name. Pure: the text is HANDED IN by the unit that owns the production door.
 *
 * It is another reader than `adapters/local/device-list.ts` (the development path), which keeps
 * names only and passes over what it does not know. Here the INDEX is the fact (it is what the
 * helper is started with), so the list is read whole or not at all.
 *
 * THE FORM, as measured on this Mac (form only). Every line of the list carries one tag, the same
 * on every line of one run; the video section stands first with indexes of its own:
 *
 *   [AVFoundation indev @ 0x<hex>] AVFoundation video devices:
 *   [AVFoundation indev @ 0x<hex>] [0] <name>
 *   [AVFoundation indev @ 0x<hex>] AVFoundation audio devices:
 *   [AVFoundation indev @ 0x<hex>] [0] <name>
 *   [AVFoundation indev @ 0x<hex>] [1] <name>
 *   (lines of the program's own error: the list call ends with an error status by design)
 *
 * THE RULES. The audio section line stands EXACTLY ONCE. No line before it is an audio entry.
 * After it, every line with the tag is an entry `[<n>] <name>`: the tag is the section line's own
 * (a name that carries a line break and a made-up entry would have to guess an address), `<n>` is
 * canonical decimal and is 0, 1, 2 ... in that order with no gap (so: no index twice, none out of
 * order), at most 32 entries, the name not empty. Once a line WITHOUT the tag has been seen, no
 * entry may follow. An over-long line after the section line is not passed over.
 *
 * Any of these broken REFUSES THE WHOLE LIST with a closed word: an index is never taken from a
 * list that was read in part. A last line without a line end is a cut line and states nothing
 * (the rule of the Linux texts; this program ends its lines).
 *
 * A NAME leaves this file RAW, for the tie's comparison alone; it is device text and reaches no
 * result, log or error.
 */
import { CARD_LISTING_LIMITS } from './card-listing';

/** Indexes 0 to 31: the closed set the helper row takes (static rule SR-15). */
export const MACOS_HELPER_LIST_MAX_ENTRIES = CARD_LISTING_LIMITS.cardIndexMax + 1;

export const MacosHelperListRefusal = {
  NOT_TEXT: 'NOT_TEXT',
  TOO_LONG: 'TOO_LONG',
  /** No audio section line: the program did not list (or the text was cut before it). */
  NO_AUDIO_SECTION: 'NO_AUDIO_SECTION',
  SECTION_REPEATED: 'SECTION_REPEATED',
  /** A tagged line after the section line that is no entry, or an over-long line there. */
  ENTRY_FORM: 'ENTRY_FORM',
  /** A tagged line whose tag is not the section line's. */
  TAG_DIFFERS: 'TAG_DIFFERS',
  /** An index that is not the next one: twice, out of order, a gap. (An index not in canonical decimal is no entry: `ENTRY_FORM`.) */
  INDEX_ORDER: 'INDEX_ORDER',
  /** An entry after a line that is none. */
  ENTRY_AFTER_OTHER_TEXT: 'ENTRY_AFTER_OTHER_TEXT',
  TOO_MANY_ENTRIES: 'TOO_MANY_ENTRIES',
} as const;
export type MacosHelperListRefusal = (typeof MacosHelperListRefusal)[keyof typeof MacosHelperListRefusal];

export interface MacosHelperAudioEntry {
  /** The number the helper row is started with (`none:<n>`). Of THIS listing only. */
  readonly index: number;
  /** RAW text of the list. For the tie's comparison only. */
  readonly name: string;
}

export type MacosHelperList = { readonly ok: true; readonly entries: readonly MacosHelperAudioEntry[] } | { readonly ok: false; readonly reason: MacosHelperListRefusal };

const TAGGED = /^(\[AVFoundation indev @ 0x[0-9a-f]{1,16}\]) (.*)$/;
const AUDIO_SECTION = 'AVFoundation audio devices:';
const ENTRY = /^\[(0|[1-9][0-9]?)\] (.+)$/;

/** Reads the diagnostics of the list row. See the head of the file for every rule. */
export function parseMacosHelperList(text: unknown): MacosHelperList {
  const refuse = (reason: MacosHelperListRefusal): MacosHelperList => Object.freeze({ ok: false, reason });
  if (typeof text !== 'string') return refuse(MacosHelperListRefusal.NOT_TEXT);
  if (text.length > CARD_LISTING_LIMITS.textCharacters) return refuse(MacosHelperListRefusal.TOO_LONG);
  const lines = text.split('\n');
  // The last part has no line end: a cut line, or the empty rest after the last line end.
  lines.pop();
  if (lines.length > CARD_LISTING_LIMITS.lines) return refuse(MacosHelperListRefusal.TOO_LONG);
  const entries: MacosHelperAudioEntry[] = [];
  let tag: string | null = null;
  let otherTextSeen = false;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    const long = line.length > CARD_LISTING_LIMITS.lineCharacters;
    const tagged = long ? null : TAGGED.exec(line);
    const isSection = tagged !== null && tagged[2] === AUDIO_SECTION;
    if (tag === null) {
      // Before the audio section: the video section and whatever the program says first. Nothing of it is an audio entry.
      if (isSection) tag = tagged[1] ?? '';
      continue;
    }
    if (isSection) return refuse(MacosHelperListRefusal.SECTION_REPEATED);
    if (long) return refuse(MacosHelperListRefusal.ENTRY_FORM);
    if (tagged === null) {
      // A line of the list in any form, with a tag that is not of the form: not passed over as "other text".
      if (line.startsWith('[AVFoundation indev')) return refuse(MacosHelperListRefusal.TAG_DIFFERS);
      otherTextSeen = true;
      continue;
    }
    if (tagged[1] !== tag) return refuse(MacosHelperListRefusal.TAG_DIFFERS);
    const entry = ENTRY.exec(tagged[2] ?? '');
    if (entry === null) return refuse(MacosHelperListRefusal.ENTRY_FORM);
    if (otherTextSeen) return refuse(MacosHelperListRefusal.ENTRY_AFTER_OTHER_TEXT);
    if (Number(entry[1]) !== entries.length) return refuse(MacosHelperListRefusal.INDEX_ORDER);
    if (entries.length >= MACOS_HELPER_LIST_MAX_ENTRIES) return refuse(MacosHelperListRefusal.TOO_MANY_ENTRIES);
    entries.push(Object.freeze({ index: entries.length, name: entry[2] ?? '' }));
  }
  if (tag === null) return refuse(MacosHelperListRefusal.NO_AUDIO_SECTION);
  return Object.freeze({ ok: true, entries: Object.freeze(entries) });
}
