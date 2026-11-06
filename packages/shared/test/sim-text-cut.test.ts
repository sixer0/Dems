// SIM-GAP-1 (D53; implementation/22_contract_b.md F-1; implementation/22b_sim_text_cut_fix.md):
// the simulator bounds three user texts by UTF-16 code units. The cut must never split a
// surrogate pair (a character outside the Basic Multilingual Plane), or ill-formed text enters
// the state and, for an export destination, a hashed audit row. For every text made only of BMP
// characters the cut is exactly the `slice` it replaced, so no stored value or hash moves.
import { describe, expect, it } from 'vitest';
import {
  auditBody,
  chainHash,
  createManualClock,
  createSim,
  verifyAuditChain,
  canonicalJSON,
  type AuditRow,
  type AuditType,
} from '../src/sim';
import { cutText } from '../src/sim/text-cut';

// ── Well-formedness, by the runtime ──────────────────────────────────────────────────────
// `String.prototype.isWellFormed` is ES2024; the workspace compiles against the ES2023 lib, so it
// is reached through the prototype. Node 26 has it: a runtime without it fails here, never skips.
const nativeIsWellFormed = (String.prototype as { isWellFormed?: (this: string) => boolean }).isWellFormed;

function wellFormed(text: string): boolean {
  if (typeof nativeIsWellFormed !== 'function') throw new Error('String.prototype.isWellFormed is missing in this runtime');
  return nativeIsWellFormed.call(text);
}

/** Paths of every ill-formed string (values and object keys) inside `value`. */
function illFormedPaths(value: unknown, path = 'state', out: string[] = []): string[] {
  if (typeof value === 'string') {
    if (!wellFormed(value)) out.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => illFormedPaths(item, `${path}[${index}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (!wellFormed(key)) out.push(`${path}.<key>`);
      illFormedPaths(child, `${path}.${key}`, out);
    }
  }
  return out;
}

/** A text survives storage as UTF-8 exactly when it is well-formed. */
const utf8RoundTrip = (text: string): string => new TextDecoder().decode(new TextEncoder().encode(text));

// ── Characters ───────────────────────────────────────────────────────────────────────────
const EMOJI = '\u{1F600}'; // 😀, two code units: D83D DE00
const CJK_EXT_B = '\u{20000}'; // 𠀀, two code units: D840 DC00
const HIGH = '\ud83d';
const LOW = '\ude00';
const ASTRAL = [EMOJI, CJK_EXT_B, '\u{1D11E}', '\u{10FFFF}', '\u{10000}'] as const;
/** The three limits of the simulator: marker label, note line (before its ellipsis), export destination. */
const LIMITS = [80, 139, 120] as const;

const BMP_TEXTS = [
  'The witness confirms the statement given earlier. '.repeat(4),
  'Keterangan saksi — café, naïve, façade · “benar” '.repeat(4),
  '日本語のテキスト、東京都。한국어 텍스트 서울 '.repeat(8),
  'عربى עברית ไทย हिन्दी ελληνικά кириллица '.repeat(5),
  '�﻿​‍퟿ edge units of the BMP '.repeat(5),
  '  leading and trailing blanks  ',
  'x',
  '',
];

describe('cutText: BMP text is cut exactly as slice cut it', () => {
  it('equals slice(0, n) for every limit from 0 to past the end, on ASCII, Latin, CJK, Hangul, RTL and edge BMP units', () => {
    for (const text of BMP_TEXTS) {
      expect(wellFormed(text)).toBe(true);
      for (let limit = 0; limit <= text.length + 2; limit += 1) {
        expect(cutText(text, limit), `${JSON.stringify(text.slice(0, 12))} at ${limit}`).toBe(text.slice(0, limit));
      }
    }
  });

  it('equals slice at the three limits of the simulator, with and without the trim the call sites apply', () => {
    for (const text of BMP_TEXTS) {
      for (const limit of LIMITS) {
        expect(cutText(text, limit)).toBe(text.slice(0, limit));
        expect(cutText(text.trim(), limit)).toBe(text.trim().slice(0, limit));
      }
    }
  });

  it('the units next to the surrogate range (U+D7FF, U+E000) are ordinary units: no step back', () => {
    expect(cutText('ab퟿cd', 3)).toBe('ab퟿');
    expect(cutText('ab퟿cd', 3)).toBe('ab');
  });
});

describe('cutText: a text that fits is returned unchanged', () => {
  it('the empty string, at any limit', () => {
    for (const limit of [0, 1, 80, 139, 120]) expect(cutText('', limit)).toBe('');
  });

  it('a text shorter than the limit, or exactly as long, with or without astral characters', () => {
    for (const limit of LIMITS) {
      const shorter = `short ${EMOJI} text`;
      expect(cutText(shorter, limit)).toBe(shorter);
      const exact = 'a'.repeat(limit);
      expect(cutText(exact, limit)).toBe(exact);
      // A pair that ends exactly at the limit is whole: nothing is cut.
      const exactWithPair = `${'a'.repeat(limit - 2)}${EMOJI}`;
      expect(exactWithPair).toHaveLength(limit);
      expect(cutText(exactWithPair, limit)).toBe(exactWithPair);
      // Only astral characters, exactly at the limit.
      const allAstral = EMOJI.repeat(Math.floor(limit / 2));
      expect(cutText(allAstral, allAstral.length)).toBe(allAstral);
    }
  });
});

describe('cutText: an astral character at the cut', () => {
  it('a pair lying across the limit is left out whole, for each limit and each astral character', () => {
    for (const limit of LIMITS) {
      for (const astral of ASTRAL) {
        const head = 'a'.repeat(limit - 1);
        const text = `${head}${astral} and the rest`;
        // Positive control: the cut this helper replaced produced ill-formed text here.
        expect(wellFormed(text)).toBe(true);
        expect(wellFormed(text.slice(0, limit))).toBe(false);

        const cut = cutText(text, limit);
        expect(cut).toBe(head);
        expect(cut).toHaveLength(limit - 1);
        expect(wellFormed(cut)).toBe(true);
        expect(utf8RoundTrip(cut)).toBe(cut);
      }
    }
  });

  it('a pair wholly before the limit is kept: the result is the slice', () => {
    for (const limit of LIMITS) {
      for (const astral of ASTRAL) {
        const text = `${'a'.repeat(limit - 2)}${astral}tail after the pair`;
        const cut = cutText(text, limit);
        expect(cut).toBe(text.slice(0, limit));
        expect(cut).toBe(`${'a'.repeat(limit - 2)}${astral}`);
        expect(cut).toHaveLength(limit);
        expect(wellFormed(cut)).toBe(true);
      }
    }
  });

  it('a pair wholly after the limit does not move the cut: the result is the slice', () => {
    for (const limit of LIMITS) {
      for (const astral of ASTRAL) {
        const text = `${'a'.repeat(limit)}${astral}tail`;
        const cut = cutText(text, limit);
        expect(cut).toBe(text.slice(0, limit));
        expect(cut).toBe('a'.repeat(limit));
        expect(wellFormed(cut)).toBe(true);
      }
    }
  });

  it('a text of astral characters only: an odd limit drops one unit, an even limit drops none', () => {
    const text = EMOJI.repeat(100); // 200 code units
    expect(cutText(text, 80)).toBe(EMOJI.repeat(40));
    expect(cutText(text, 139)).toBe(EMOJI.repeat(69)); // 138 units
    expect(cutText(text, 120)).toBe(EMOJI.repeat(60));
    expect(cutText(text, 81)).toBe(EMOJI.repeat(40));
  });

  it('for every limit: a prefix, within the limit, well-formed, and the longest such prefix', () => {
    const text = `ab${EMOJI}c${CJK_EXT_B}${EMOJI}日本${EMOJI}é\u{10FFFF}z${EMOJI}${EMOJI}end`;
    expect(wellFormed(text)).toBe(true);
    let shortened = 0;
    for (let limit = 0; limit <= text.length + 1; limit += 1) {
      const cut = cutText(text, limit);
      expect(text.startsWith(cut)).toBe(true);
      expect(cut.length).toBeLessThanOrEqual(limit);
      expect(wellFormed(cut), `limit ${limit}`).toBe(true);
      if (limit >= text.length) {
        expect(cut).toBe(text);
      } else if (cut.length < limit) {
        // One unit short, and only because the plain slice would have split a pair.
        expect(cut).toHaveLength(limit - 1);
        expect(wellFormed(text.slice(0, limit))).toBe(false);
        shortened += 1;
      } else {
        expect(cut).toBe(text.slice(0, limit));
      }
    }
    // Exactly one limit falls inside each astral character of the text (seven of them).
    const astralCount = Array.from(text).filter((character) => character.length === 2).length;
    expect(astralCount).toBe(7);
    expect(shortened).toBe(astralCount);
  });

  it('cuts between code points, not grapheme clusters (out of scope): half a flag is still well-formed text', () => {
    const flag = '\u{1F1EE}\u{1F1E9}'; // two regional indicators, four code units
    const cut = cutText(`${flag} Indonesia`, 2);
    expect(cut).toBe('\u{1F1EE}');
    expect(wellFormed(cut)).toBe(true);
    expect(cutText(`${flag} Indonesia`, 3)).toBe('\u{1F1EE}');
    expect(cutText(`${flag} Indonesia`, 4)).toBe(flag);
  });
});

describe('cutText: small and odd limits', () => {
  it('a limit of 0 gives the empty string', () => {
    expect(cutText('abc', 0)).toBe('');
    expect(cutText(`${EMOJI}abc`, 0)).toBe('');
  });

  it('a limit of 1 gives one BMP unit, and nothing when the text starts with a pair', () => {
    expect(cutText('abc', 1)).toBe('a');
    expect(cutText(`${EMOJI}abc`, 1)).toBe('');
    expect(cutText(`a${EMOJI}`, 1)).toBe('a');
    expect(cutText(`a${EMOJI}`, 2)).toBe('a');
    expect(cutText(`${EMOJI}abc`, 2)).toBe(EMOJI);
    expect(cutText(`${EMOJI}abc`, 3)).toBe(`${EMOJI}a`);
  });

  it('a limit that is not a positive number gives the empty string; a fraction is rounded down; Infinity cuts nothing', () => {
    expect(cutText('abc', -1)).toBe('');
    expect(cutText('abc', Number.NaN)).toBe('');
    expect(cutText('abc', Number.NEGATIVE_INFINITY)).toBe('');
    expect(cutText('abcdef', 2.9)).toBe('ab');
    expect(cutText(`a${EMOJI}b`, 2.5)).toBe('a');
    expect(cutText('abc', Number.POSITIVE_INFINITY)).toBe('abc');
  });
});

describe('cutText: text that is already ill-formed is not repaired', () => {
  it('a lone surrogate inside the prefix stays where it is (the result is the slice)', () => {
    for (const lone of [HIGH, LOW]) {
      const text = `ab${lone}cdefgh`;
      const cut = cutText(text, 5);
      expect(cut).toBe(text.slice(0, 5));
      expect(cut).toBe(`ab${lone}cd`);
      expect(wellFormed(cut)).toBe(false);
    }
  });

  it('a lone low surrogate at the limit is cut like any other unit', () => {
    const text = `abc${LOW}def`;
    expect(cutText(text, 3)).toBe('abc');
    expect(cutText(text, 4)).toBe(`abc${LOW}`);
  });

  it('a lone high surrogate just before the limit stays: the helper does not remove what the input held', () => {
    const text = `abc${HIGH}xyz`;
    expect(cutText(text, 4)).toBe(`abc${HIGH}`);
    expect(cutText(text, 3)).toBe('abc');
  });

  it('a lone high surrogate followed by a real pair: only the real pair is kept whole', () => {
    const text = `a${HIGH}${EMOJI}b`; // a, lone D83D, D83D DE00, b
    expect(cutText(text, 3)).toBe(`a${HIGH}`); // the limit falls inside the real pair
    expect(cutText(text, 2)).toBe(`a${HIGH}`); // the limit falls after the lone unit: nothing to keep whole
    expect(cutText(text, 4)).toBe(`a${HIGH}${EMOJI}`);
  });

  it('adds no lone surrogate of its own: every lone surrogate of the result is one of the input', () => {
    const lone = (text: string) => {
      let count = 0;
      for (let index = 0; index < text.length; index += 1) {
        const unit = text.charCodeAt(index);
        const high = unit >= 0xd800 && unit <= 0xdbff;
        const low = unit >= 0xdc00 && unit <= 0xdfff;
        const next = text.charCodeAt(index + 1);
        if (high && next >= 0xdc00 && next <= 0xdfff) index += 1;
        else if (high || low) count += 1;
      }
      return count;
    };
    const text = `${LOW}a${HIGH}${EMOJI}b${HIGH}c${LOW}${LOW}${EMOJI}${HIGH}`;
    expect(lone(text)).toBe(6);
    for (let limit = 0; limit <= text.length; limit += 1) {
      const cut = cutText(text, limit);
      // The result never ends with the high half of a pair that the input completes.
      const last = cut.charCodeAt(cut.length - 1);
      const following = text.charCodeAt(cut.length);
      const endsInsidePair = last >= 0xd800 && last <= 0xdbff && following >= 0xdc00 && following <= 0xdfff;
      expect(endsInsidePair, `limit ${limit}`).toBe(false);
      // So every lone surrogate of the result is a lone surrogate of the input, and none is removed
      // from the part that is kept: the result is the plain slice, or the slice less one unit.
      expect(lone(cut), `limit ${limit}`).toBeLessThanOrEqual(lone(text));
      expect([text.slice(0, limit), text.slice(0, Math.max(0, limit - 1))]).toContain(cut);
    }
  });
});

// ── Through the real simulator ───────────────────────────────────────────────────────────

const START = 1_790_823_600_000; // 2026-10-01 10:00 WIB, as the F-1 reproduction and the hash baseline
const EVIDENCE_ID = 'EV-20260930-0004';

function harness() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'recording' });
  const state = () => sim.store.getState();
  const lastAudit = (type: AuditType): AuditRow => {
    const row = state().audit.rows.findLast((candidate) => candidate.type === type);
    if (!row) throw new Error(`no ${type} audit row`);
    return row;
  };
  const asInvestigator = () => expect(sim.actions.signInWithBiometric('OPR-001')).toMatchObject({ ok: true });
  const asSupervisor = () => expect(sim.actions.signInWithSecurityKey()).toMatchObject({ ok: true });
  return { sim, clock, state, lastAudit, asInvestigator, asSupervisor };
}

/** The audit row is hashed over well-formed text, and its hashed form survives UTF-8 storage. */
function expectStorableRow(row: AuditRow) {
  const hashed = canonicalJSON(auditBody(row));
  expect(wellFormed(hashed)).toBe(true);
  expect(utf8RoundTrip(hashed)).toBe(hashed);
  expect(chainHash(row.prevHash, auditBody(row))).toBe(row.hash);
  // What a UTF-8 store gives back hashes to the stored hash.
  const stored = JSON.parse(utf8RoundTrip(JSON.stringify(row))) as AuditRow;
  expect(chainHash(stored.prevHash, auditBody(stored))).toBe(row.hash);
}

describe('the recording scenario holds no ill-formed text before any input', () => {
  it('every string of the state is well-formed and the audit chain verifies', () => {
    const h = harness();
    expect(illFormedPaths(h.state())).toEqual([]);
    expect(verifyAuditChain(h.state().audit)).toMatchObject({ ok: true });
  });
});

describe('addMarker: a label with an astral character at code units 80 and 81', () => {
  const head = 'm'.repeat(79);
  const label = `  ${head}${EMOJI} and the rest of a long label  `;

  it('the plain slice would have left a lone surrogate (positive control)', () => {
    expect(wellFormed(label)).toBe(true);
    expect(wellFormed(label.trim().slice(0, 80))).toBe(false);
  });

  it('the state, the event and the audit row hold well-formed text; the label is 79 code units', () => {
    const h = harness();
    h.asInvestigator();
    h.sim.actions.addMarker(label);

    const item = h.state().session?.timeline.findLast((entry) => entry.kind === 'MARKER');
    expect(item?.label).toBe(head);
    expect(item?.params).toMatchObject({ label: head });

    const row = h.lastAudit('MARKER_ADDED');
    expect(row.details.label).toBe(head);
    expect(row.message).toBe(`Marker added: ${head}`);
    expectStorableRow(row);

    const event = h.state().events.findLast((entry) => entry.type === 'MARKER_ADDED');
    expect(event?.message).toBe(`Marker added · ${head}`);
    expect(wellFormed(event?.message ?? '')).toBe(true);

    expect(illFormedPaths(h.state())).toEqual([]);
    expect(verifyAuditChain(h.state().audit)).toMatchObject({ ok: true });
  });

  it('a pair that ends exactly at code unit 80 is kept, and one that starts at 81 is cut whole', () => {
    const h = harness();
    h.asInvestigator();
    h.sim.actions.addMarker(`${'m'.repeat(78)}${EMOJI}tail`);
    expect(h.lastAudit('MARKER_ADDED').details.label).toBe(`${'m'.repeat(78)}${EMOJI}`);
    h.sim.actions.addMarker(`${'m'.repeat(80)}${EMOJI}tail`);
    expect(h.lastAudit('MARKER_ADDED').details.label).toBe('m'.repeat(80));
    expect(illFormedPaths(h.state())).toEqual([]);
    expect(verifyAuditChain(h.state().audit)).toMatchObject({ ok: true });
  });
});

describe('addNote: a note with an astral character at code units 139 and 140', () => {
  const head = 'a'.repeat(138);
  const note = `${head}${EMOJI} and the rest of a long note`;

  it('the plain slice would have left a lone surrogate (positive control)', () => {
    expect(wellFormed(note)).toBe(true);
    expect(wellFormed(note.slice(0, 139))).toBe(false);
  });

  it('the timeline line is well-formed (138 units and the ellipsis); the note itself is kept whole', () => {
    const h = harness();
    h.asInvestigator();
    h.sim.actions.addNote(note);

    const item = h.state().session?.timeline.findLast((entry) => entry.kind === 'NOTE');
    expect(item?.detail).toBe(`${head}…`);
    expect(wellFormed(item?.detail ?? '')).toBe(true);
    expect(item?.params).toMatchObject({ length: note.length });
    expect(h.state().session?.notes.at(-1)?.text).toBe(note);

    const row = h.lastAudit('NOTE_ADDED');
    expect(row.details).toMatchObject({ length: note.length });
    expectStorableRow(row);
    const event = h.state().events.findLast((entry) => entry.type === 'NOTE_ADDED');
    expect(wellFormed(event?.message ?? '')).toBe(true);

    expect(illFormedPaths(h.state())).toEqual([]);
    expect(verifyAuditChain(h.state().audit)).toMatchObject({ ok: true });
  });

  it('a note of at most 140 code units is not cut, whatever it holds', () => {
    const h = harness();
    h.asInvestigator();
    const fits = `${'a'.repeat(138)}${EMOJI}`; // exactly 140 code units
    h.sim.actions.addNote(fits);
    expect(h.state().session?.timeline.findLast((entry) => entry.kind === 'NOTE')?.detail).toBe(fits);
    expect(illFormedPaths(h.state())).toEqual([]);
  });
});

describe('export: a destination with an astral character at code units 120 and 121', () => {
  const head = 'd'.repeat(119);
  const destination = `  ${head}${EMOJI} and more  `;
  const reason = 'Case file transfer';

  it('the plain slice would have left a lone surrogate (positive control)', () => {
    expect(wellFormed(destination)).toBe(true);
    expect(wellFormed(destination.trim().slice(0, 120))).toBe(false);
  });

  it('exportEvidence: the audit row, the custody entry and the event are well-formed and the chain verifies', () => {
    const h = harness();
    h.asSupervisor();
    expect(h.sim.actions.exportEvidence(EVIDENCE_ID, { reason, destination })).toMatchObject({ ok: true, status: 202 });

    const row = h.lastAudit('EVIDENCE_EXPORTED');
    expect(row.details.destination).toBe(head);
    expect(row.details.reason).toBe(reason);
    expectStorableRow(row);

    const custody = h.state().evidence.find((item) => item.id === EVIDENCE_ID)?.custody.at(-1);
    expect(custody).toMatchObject({ action: 'EXPORTED', detail: head });
    const event = h.state().events.findLast((entry) => entry.type === 'EVIDENCE_EXPORTED');
    expect(illFormedPaths(event)).toEqual([]);

    expect(illFormedPaths(h.state())).toEqual([]);
    expect(verifyAuditChain(h.state().audit)).toMatchObject({ ok: true, head: row.hash });
  });

  it('exportAudit and exportLogs: the AUDIT_EXPORTED rows are well-formed and the chain verifies', () => {
    const h = harness();
    h.asSupervisor();
    expect(h.sim.actions.exportAudit({ reason: 'Quarterly audit review', destination })).toMatchObject({ ok: true, status: 202 });
    const auditRow = h.lastAudit('AUDIT_EXPORTED');
    expect(auditRow.details.destination).toBe(head);
    expectStorableRow(auditRow);

    expect(h.sim.actions.exportLogs({ reason: 'Support bundle for review', destination })).toMatchObject({ ok: true, status: 202 });
    const logRow = h.lastAudit('AUDIT_EXPORTED');
    expect(logRow.seq).toBeGreaterThan(auditRow.seq);
    expect(logRow.details).toMatchObject({ destination: head, scope: 'LOGS' });
    expectStorableRow(logRow);

    expect(illFormedPaths(h.state())).toEqual([]);
    expect(verifyAuditChain(h.state().audit)).toMatchObject({ ok: true, head: logRow.hash });
  });

  it('the audit chain still verifies after more rows follow such an export', () => {
    const h = harness();
    h.asSupervisor();
    h.sim.actions.exportEvidence(EVIDENCE_ID, { reason, destination });
    h.sim.actions.exportAudit({ reason: 'Quarterly audit review', destination });
    h.sim.actions.signOut();
    h.asInvestigator();
    h.sim.actions.addMarker(`${'m'.repeat(79)}${EMOJI}tail`);
    h.sim.actions.addNote(`${'a'.repeat(138)}${EMOJI} and the rest`);

    const log = h.state().audit;
    expect(verifyAuditChain(log)).toMatchObject({ ok: true, checked: log.rows.length });
    // The whole log, stored as UTF-8 and read back, is the log that was hashed.
    const stored = JSON.parse(utf8RoundTrip(JSON.stringify(log))) as typeof log;
    expect(stored).toEqual(log);
    expect(verifyAuditChain(stored)).toMatchObject({ ok: true, head: log.head });
    expect(illFormedPaths(h.state())).toEqual([]);
  });
});

// ── Regression pin: no existing hash moves ───────────────────────────────────────────────

describe('regression pin: for BMP text the stored values and the audit hashes are what slice produced', () => {
  // The texts of implementation/assets/22b_hash_baseline.ts, each longer than its limit.
  const ASCII_LABEL = `  ${'Marker label '.repeat(9)}  `;
  const BMP_LABEL = 'Keterangan saksi — café, naïve, 日本語、한국어 · '.repeat(4);
  const ASCII_NOTE = 'The witness confirms the statement given earlier. '.repeat(5);
  const BMP_NOTE = 'Saksi menyatakan “benar” — façade, 東京都、서울 · '.repeat(6);
  const ASCII_DESTINATION = `  ${'/mnt/usb/CASE-FILES/export-'.repeat(6)}  `;
  const BMP_DESTINATION = 'Jaksa Penuntut Umum — Kejaksaan Negeri · 東京 · '.repeat(4);

  /** The hash of `row` with its text replaced by what the old expression gives. */
  const oldWayHash = (row: AuditRow, patch: { message?: string; details: AuditRow['details'] }) =>
    chainHash(row.prevHash, { ...auditBody(row), ...patch, details: { ...row.details, ...patch.details } });

  it('the inputs are ASCII or BMP only, and longer than their limits', () => {
    for (const text of [ASCII_LABEL, ASCII_NOTE, ASCII_DESTINATION]) expect(/^[\x20-\x7e]+$/.test(text)).toBe(true);
    for (const text of [BMP_LABEL, BMP_NOTE, BMP_DESTINATION]) expect(/[\ud800-\udfff]/.test(text)).toBe(false);
    for (const text of [ASCII_LABEL, BMP_LABEL]) expect(text.trim().length).toBeGreaterThan(80);
    for (const text of [ASCII_NOTE, BMP_NOTE]) expect(text.trim().length).toBeGreaterThan(140);
    for (const text of [ASCII_DESTINATION, BMP_DESTINATION]) expect(text.trim().length).toBeGreaterThan(120);
  });

  it('a marker label: the row hash equals the hash computed with label.trim().slice(0, 80)', () => {
    for (const label of [ASCII_LABEL, BMP_LABEL]) {
      const h = harness();
      h.asInvestigator();
      h.sim.actions.addMarker(label);
      const old = label.trim().slice(0, 80);
      const row = h.lastAudit('MARKER_ADDED');
      expect(row.details.label).toBe(old);
      expect(row.hash).toBe(oldWayHash(row, { message: `Marker added: ${old}`, details: { label: old } }));
      expect(h.state().session?.timeline.findLast((entry) => entry.kind === 'MARKER')?.label).toBe(old);
    }
  });

  it('a note: the timeline line equals `${body.slice(0, 139)}…`', () => {
    for (const note of [ASCII_NOTE, BMP_NOTE]) {
      const h = harness();
      h.asInvestigator();
      h.sim.actions.addNote(note);
      const body = note.trim();
      const detail = h.state().session?.timeline.findLast((entry) => entry.kind === 'NOTE')?.detail;
      expect(detail).toBe(`${body.slice(0, 139)}…`);
      expect(detail).toHaveLength(140);
    }
  });

  it('an export destination: the row hash equals the hash computed with destination.trim().slice(0, 120)', () => {
    for (const destination of [ASCII_DESTINATION, BMP_DESTINATION]) {
      const old = destination.trim().slice(0, 120);
      expect(old).toHaveLength(120);
      const h = harness();
      h.asSupervisor();

      h.sim.actions.exportEvidence(EVIDENCE_ID, { reason: 'Case file transfer', destination });
      const evidenceRow = h.lastAudit('EVIDENCE_EXPORTED');
      expect(evidenceRow.details.destination).toBe(old);
      expect(evidenceRow.hash).toBe(oldWayHash(evidenceRow, { details: { destination: old } }));
      expect(h.state().evidence.find((item) => item.id === EVIDENCE_ID)?.custody.at(-1)?.detail).toBe(old);

      h.sim.actions.exportAudit({ reason: 'Quarterly audit review', destination });
      const auditRow = h.lastAudit('AUDIT_EXPORTED');
      expect(auditRow.details.destination).toBe(old);
      expect(auditRow.hash).toBe(oldWayHash(auditRow, { details: { destination: old } }));

      h.sim.actions.exportLogs({ reason: 'Support bundle for review', destination });
      const logRow = h.lastAudit('AUDIT_EXPORTED');
      expect(logRow.details.destination).toBe(old);
      expect(logRow.hash).toBe(oldWayHash(logRow, { details: { destination: old } }));

      expect(verifyAuditChain(h.state().audit)).toMatchObject({ ok: true });
    }
  });

  it('the hashes captured from the code BEFORE the fix (assets/22b_hash_baseline_before.txt) are unchanged', () => {
    // These literals were printed by implementation/assets/22b_hash_baseline.ts running against
    // the simulator as it was at acaff20 (slice at all four cut sites). The same journey must
    // give the same chain. They move only if the recording scenario or the audit rows of these
    // actions change by design, which is a recorded decision, not a side effect.
    // Re-pinned by audit fix row 83 (DF-03; decisions D15(c), D22(5)): the recording scenario's pre-check
    // now holds twelve items (and draws twelve seeded durations), so every later row of the chain moves.
    // Probe on the host: with only row 83's sources reverted to HEAD the old literals pass; the row count
    // stays 230. acaff20 values, in order: 470b91cf.., bd6edf6e.., 5bdb082c.., 10d0de9e.., 2519943c..,
    // 535dd739.., e0603b5a.., f4968a78.., 3b2efcd0.. (head).
    const h = harness();
    const hashOf = (type: AuditType) => h.lastAudit(type).hash;
    h.asInvestigator();
    h.sim.actions.addMarker(ASCII_LABEL);
    expect(hashOf('MARKER_ADDED')).toBe('8b57b9d9a521622bcb89be4e00b5d55ea09c40c30fda49f01e9c8d4d117404d5');
    h.sim.actions.addMarker(BMP_LABEL);
    expect(hashOf('MARKER_ADDED')).toBe('9d1b2f9e87c83da5db8d4f4ed6cf7e4d1d48d8b9e31064ae89e874fe3ded98ec');
    h.sim.actions.addNote(ASCII_NOTE);
    expect(hashOf('NOTE_ADDED')).toBe('3118c8853599af7739b1aa42185e2eeab4e72ffbc9e5ee95b8794602b63bd9dd');
    h.sim.actions.addNote(BMP_NOTE);
    expect(hashOf('NOTE_ADDED')).toBe('330a2d82cdc0b6cfd6c4872ff7b61d4f1376d4db5b8d96a6e67a1c88469eda5e');
    h.sim.actions.signOut();
    h.asSupervisor();
    h.sim.actions.exportEvidence(EVIDENCE_ID, { reason: 'Case file transfer', destination: ASCII_DESTINATION });
    expect(hashOf('EVIDENCE_EXPORTED')).toBe('b645ca14fafb54e6fdf14cb5665cb1a1c2ee27e21285094ee9d1997fc86172f4');
    h.sim.actions.exportEvidence(EVIDENCE_ID, { reason: 'Case file transfer', destination: BMP_DESTINATION });
    expect(hashOf('EVIDENCE_EXPORTED')).toBe('ce74b7782ec4c249adca4590b4f3a7ef6a017e7352580f6154a092a38b3999c1');
    h.sim.actions.exportAudit({ reason: 'Quarterly audit review', destination: ASCII_DESTINATION });
    expect(hashOf('AUDIT_EXPORTED')).toBe('18fe27c73416f6c5de040eadd7ca8433c31ccf4a05a419e18c032998c3fd2aeb');
    h.sim.actions.exportAudit({ reason: 'Quarterly audit review', destination: BMP_DESTINATION });
    expect(hashOf('AUDIT_EXPORTED')).toBe('f3498c09aa981a0c1e54d25cb536b450b8c08c6ce2e32aa2041765887852a615');
    h.sim.actions.exportLogs({ reason: 'Support bundle for review', destination: ASCII_DESTINATION });
    expect(hashOf('AUDIT_EXPORTED')).toBe('e2389c387caf52692f8dedacee85bfb47539541d014db89cb4048b3f6bbd6664');

    const log = h.state().audit;
    expect(log.head).toBe('e2389c387caf52692f8dedacee85bfb47539541d014db89cb4048b3f6bbd6664');
    expect(log.total).toBe(230);
    expect(verifyAuditChain(log)).toMatchObject({ ok: true, checked: 230 });
  });
});
