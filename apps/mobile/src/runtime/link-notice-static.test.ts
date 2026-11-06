// Row M0 (finding CPM1-3 of the CP-M1 review), static rule: no production file under
// `apps/mobile/src/features/**` writes a rule of its own for the "Core server unreachable" notice.
// The one rule is `runtime/link-notice.ts`; a screen calls `offlineNoticeAfter` (through `@/runtime`).
//
// A copy of the rule has to decide what the link's transients and its down states do. So this file
// looks, in the CODE of every production file under `features/` (comments are not code; test files
// and `testing/` folders are not production), for:
//
//  C1. a transient link state by name: `CONNECTING` or `RESYNCING`. A screen that names one decides
//      what a transient does, which is the no-flicker half of the rule (the Pair screen's copy had
//      `case LiveLinkState.CONNECTING:`; the banner's shape is `heartbeat === 'CONNECTING'`).
//      A screen that wants to word a transient reads `coreLinkViewOf(link) === 'settling'`.
//  C2. a `case` label on `STALE`: a switch over the link's down states (the Login screen's copy had
//      `case 'STALE':` and kept the transient through its `default`). STALE is a word of the two link
//      vocabularies only, so the check does not fire on a camera or a device that is OFFLINE.
//  C3. `OFFLINE` and `STALE` in one expression or one list on one line, joined by `||` or by `,`:
//      the down set written out as an if-chain, an `includes`, a `Set` or a one-line table. A type
//      union (`'ONLINE' | 'STALE' | 'OFFLINE'`, one bar) is no rule and does not fire.
//
// ONE NAMED ALLOWANCE under C1 (integration pass D11): the CAMERA chip of the Session Live strip
// (row 139 / pass D7, D84). While a recording has no durable fragment yet its camera chips read
// "Connecting" - the chip VALUE `'CONNECTING'` of a video track in
// `features/session-live/session-live.math.ts` (the strip's model) and
// `features/session-live/status-strip.tsx` (its label). That word is a state of a camera of the
// recording, taken from `captureDurable` of the session; it is not the link's transient and decides
// nothing about the offline notice. The allowance is by file AND by shape: in those two files, a
// line that holds the quoted literal and names nothing of a link (`link`, `heartbeat`,
// `LiveLinkState`, `RESYNCING`). Everything else fires as before: the same word in any other file,
// an unquoted member (`LiveLinkState.CONNECTING`), a line that reads a link. The number of allowed
// lines is pinned, so a new use is seen.
//
// What it cannot see, by design: a copy that names neither a transient nor STALE (for example one
// that keys on the two-valued `coreLink.state` and on `heartbeat === 'LIVE'`); a table spread over
// several lines; names assembled from parts; a copy outside `features/` (the runtime's own banner,
// `connection-banner.ts`, is held to the same answer by `link-notice.test.ts` instead); a screen that
// calls the runtime's view and adds a time window of its own. Those are review items.
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(__dirname, '..');
const FEATURES = join(SRC, 'features');

/** Code without its comments. The `//` of a URL is no comment. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');

function sourceFiles(folder: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name)) found.push(path);
  }
  return found;
}

const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path) || /(?:^|\/)(?:testing|__tests__)\//.test(path);
const rel = (path: string): string => relative(SRC, path).split(sep).join('/');

const production = sourceFiles(FEATURES)
  .map((path) => ({ path: rel(path), text: code(readFileSync(path, 'utf8')) }))
  .filter((file) => !isTest(file.path))
  .sort((a, b) => a.path.localeCompare(b.path));

const CHECKS: Record<string, RegExp> = {
  'C1 a transient link state by name': /\b(?:CONNECTING|RESYNCING)\b/,
  'C2 a case label on STALE': /\bcase\s+(?:[\w$]+\.)?['"]?STALE\b/,
  'C3 OFFLINE and STALE in one expression or list': /\bOFFLINE\b[^;\n]*(?:\|\||,)[^;\n]*\bSTALE\b|\bSTALE\b[^;\n]*(?:\|\||,)[^;\n]*\bOFFLINE\b/,
};

/** The two files of the Session Live strip whose camera chip may read 'CONNECTING' (the allowance of C1). */
const CAMERA_CHIP_FILES: readonly string[] = ['features/session-live/session-live.math.ts', 'features/session-live/status-strip.tsx'];
const CHIP_LITERAL = /'CONNECTING'/;
const LINK_WORD = /link|heartbeat|RESYNCING/i;

/** True for a line of the camera chip: in one of the two files, the quoted chip value, and nothing of a link on the line. */
function isCameraChipLine(path: string, line: string): boolean {
  if (!CAMERA_CHIP_FILES.includes(path) || LINK_WORD.test(line)) return false;
  // Every `CONNECTING` of the line is the quoted literal: an unquoted member (`X.CONNECTING`) is not the chip.
  return CHIP_LITERAL.test(line) && (line.match(/\bCONNECTING\b/g) ?? []).length === (line.match(/'CONNECTING'/g) ?? []).length;
}

/** `path:line: text` of every line of `files` that a check finds; the camera chip lines are left out of C1. */
function hitsIn(files: readonly { path: string; text: string }[], pattern: RegExp, allowChip: boolean): string[] {
  return files.flatMap((file) =>
    file.text.split('\n').flatMap((line, index) => (pattern.test(line) && !(allowChip && isCameraChipLine(file.path, line)) ? [`${file.path}:${index + 1}: ${line.trim()}`] : [])),
  );
}

const hits = (pattern: RegExp): string[] => hitsIn(production, pattern, pattern === CHECKS['C1 a transient link state by name']);

const fires = (pattern: RegExp, text: string): boolean => code(text).split('\n').some((line) => pattern.test(line));

describe('no screen writes its own offline-notice rule (CPM1-3; the one rule is runtime/link-notice.ts)', () => {
  it('reads every production file under features/, sub-folders included', () => {
    expect(production.length).toBeGreaterThan(150);
    expect(production.some((file) => file.path === 'features/pairing/pairing-live-model.ts')).toBe(true);
    expect(production.some((file) => file.path === 'features/login/login-live-model.ts')).toBe(true);
    expect(production.some((file) => file.path.startsWith('features/session-live/'))).toBe(true);
    expect(production.some((file) => /\/testing\//.test(file.path) || /\.test\.tsx?$/.test(file.path))).toBe(false);
  });

  it('the checks find both former copies and the shapes a new copy would take', () => {
    // The Pair screen's copy (`features/pairing/pairing-live-model.ts:51-62` at commit b90a3c6).
    const pairingCopy = `export function offlineNoticeAfter(shown: boolean, link: LiveLinkState | null): boolean {
  switch (link) {
    case LiveLinkState.OFFLINE:
    case LiveLinkState.STALE:
      return true;
    case LiveLinkState.CONNECTING:
    case LiveLinkState.RESYNCING:
      return shown;
    default:
      return false;
  }
}`;
    // The Login screen's copy (`features/login/login-live-model.ts:79-89` at commit b90a3c6).
    const loginCopy = `export function liveOfflineNoticeAfter(shown: boolean, heartbeat: HeartbeatState | undefined): boolean {
  switch (heartbeat) {
    case 'OFFLINE':
    case 'STALE':
      return true;
    case 'LIVE':
      return false;
    default:
      return shown;
  }
}`;
    const [c1, c2, c3] = Object.values(CHECKS) as [RegExp, RegExp, RegExp];
    expect([fires(c1, pairingCopy), fires(c2, pairingCopy)]).toEqual([true, true]);
    expect([fires(c1, loginCopy), fires(c2, loginCopy)]).toEqual([false, true]);
    // The banner's shape, an if-chain, an includes, a Set and a one-line table.
    expect(fires(c1, "if (link.heartbeat === 'CONNECTING') return current;")).toBe(true);
    expect(fires(c3, "if (h === 'OFFLINE' || h === 'STALE') return true;")).toBe(true);
    expect(fires(c3, "const down = ['STALE', 'OFFLINE'].includes(link);")).toBe(true);
    expect(fires(c3, 'const DOWN = new Set([LiveLinkState.OFFLINE, LiveLinkState.STALE]);')).toBe(true);
    expect(fires(c3, 'const DOWN = { OFFLINE: true, STALE: true };')).toBe(true);
  });

  it('the checks stay quiet on what is no rule', () => {
    const quiet = [
      // The Login ring and chip of HEARTBEAT mode (`features/login/login-model.ts`): a tone, not the notice.
      "if (coreLink.heartbeat === 'STALE') return 'attention';",
      "export type CoreChipKind = 'ONLINE' | 'STALE' | 'OFFLINE';",
      "if (coreLink.state === 'OFFLINE') return { kind: 'OFFLINE', tone: 'danger' };",
      "    STALE: 'Core link stale',",
      // A camera or a device that is offline.
      "const value = camera.recState ?? (camera.online ? 'REC' : 'OFFLINE');",
      // The pairing screen's own wording of the link, and a comment about the transient.
      "return link === 'connecting' ? 'connecting' : 'idle';",
      '// CONNECTING is a transient that keeps what is shown',
      // Calling the runtime's rule.
      'setOffline(offlineNoticeAfter(offline, coreLinkViewOf(link)));',
    ];
    for (const line of quiet) {
      for (const [name, pattern] of Object.entries(CHECKS)) expect([name, line, fires(pattern, line)]).toEqual([name, line, false]);
    }
  });

  it('the allowance of C1 is the camera chip and nothing else (pass D11): five lines in two files; the same word about a link, in another file, or as a member still fires', () => {
    const c1 = CHECKS['C1 a transient link state by name'] as RegExp;
    // What is allowed today, by file: the chip's type, its value (two lines), its tone; the label of the strip.
    const allowed = production.flatMap((file) => file.text.split('\n').filter((line) => c1.test(line) && isCameraChipLine(file.path, line)).map(() => file.path));
    expect(allowed).toEqual([...Array.from({ length: 4 }, () => CAMERA_CHIP_FILES[0]), CAMERA_CHIP_FILES[1]]);

    const planted = (path: string, line: string): string[] => hitsIn([{ path, text: code(line) }], c1, true);
    const [math, strip] = CAMERA_CHIP_FILES as [string, string];
    // CONTROL: the chip's own lines are quiet in the two files ...
    expect(planted(math, "tone: value === 'OFFLINE' ? 'danger' : value === 'CONNECTING' ? 'info' : TRACK_TONE[value],")).toEqual([]);
    expect(planted(strip, ": chip.value === 'CONNECTING'")).toEqual([]);
    // ... and fire anywhere else: the allowance is by name.
    expect(planted('features/session-live/use-monitor.ts', ": chip.value === 'CONNECTING'")).toHaveLength(1);
    expect(planted('features/login/login-live-model.ts', "if (value === 'CONNECTING') return shown;")).toHaveLength(1);
    // A copy of the notice rule inside the two files still fires: it reads a link, or names the member, or the other transient.
    expect(planted(math, "if (link.heartbeat === 'CONNECTING') return current;")).toHaveLength(1);
    expect(planted(math, "if (coreLink.state === 'CONNECTING') return shown;")).toHaveLength(1);
    expect(planted(strip, 'case LiveLinkState.CONNECTING:')).toHaveLength(1);
    expect(planted(strip, "if (state === 'CONNECTING' || state === 'RESYNCING') return shown;")).toHaveLength(1);
    expect(planted(math, "const settling = value === 'CONNECTING' || other === TrackState.CONNECTING;")).toHaveLength(1);
  });

  for (const [name, pattern] of Object.entries(CHECKS)) {
    it(`no production file under features/ holds ${name}`, () => {
      expect(hits(pattern)).toEqual([]);
    });
  }
});
