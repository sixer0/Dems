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

/** `path:line: text` of every line of the code that a check finds. */
function hits(pattern: RegExp): string[] {
  return production.flatMap((file) =>
    file.text.split('\n').flatMap((line, index) => (pattern.test(line) ? [`${file.path}:${index + 1}: ${line.trim()}`] : [])),
  );
}

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

  for (const [name, pattern] of Object.entries(CHECKS)) {
    it(`no production file under features/ holds ${name}`, () => {
      expect(hits(pattern)).toEqual([]);
    });
  }
});
