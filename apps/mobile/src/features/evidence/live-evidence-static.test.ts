// Backend task W74, static tests over the production files of `features/evidence/` (client gate CLG
// item (c), AC-C-53; gateway_check/09_cp_mobile_runtime §4 answer 3, rules 1, 3, 4, 5, 7 and 8;
// gateway_check/09a_m0_link_rule §10). The model is `pairing-live-static.test.ts`.
//
//  1. No production file takes the Core's actions from the simulator: no `useSimActions`, and no
//     `.actions` read on a `Sim`. The calls come from `useCoreActions()` and go through `settle`;
//     operation 40 goes through `useMobileLive()?.client.call` only.
//  2. The folder names no network API, no Core server address, no storage package, no Live source
//     module, no credential module (rules 3 and 4), and no raw state of the Core link (M0 rule).
//  3. One LIVE idiom (rule 5): a file that picks a LIVE behaviour reads `useCoreLink().source`, or
//     takes `live` from a caller that does; nothing derives the mode from the data-mode hook.
//  4. The Live waits run on the store's clock (rule 7): the files written for Live mode hold no
//     `setTimeout`, `setInterval` or `Date.now`.
//  5. The copy (rule 8): the Live text says nothing about a simulation; no `SIM-GAP` marker was
//     added; only the sentences of Simulated mode speak of a simulation.
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { en } from '@dems/shared/i18n';
import { evidenceEn } from './i18n';
import { expectScanIsTheFolder } from '@/runtime/testing/static-scan';

const FOLDER = __dirname;
const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path) || /(?:^|\/)(?:testing|__tests__)\//.test(path);
/** Code without its comments. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');
/** Text inside quotes is no code: `t('features.evidence.actions.archived')` names a translation, not a simulator. */
const unquoted = (text: string): string => text.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const raw = sourceFiles(FOLDER)
  .map((path) => ({ name: relative(FOLDER, path).split(sep).join('/'), source: readFileSync(path, 'utf8') }))
  .sort((a, b) => a.name.localeCompare(b.name));
const production = raw.filter((file) => !isTest(file.name)).map((file) => ({ name: file.name, text: code(file.source) }));
const matching = (pattern: RegExp): string[] => production.filter((file) => pattern.test(file.text)).map((file) => file.name);
const fileText = (name: string): string => production.find((file) => file.name === name)!.text;

const SIM_ACTIONS_HOOK = ['use', 'Sim', 'Actions'].join('');
/** The files written for Live mode by this row. */
const LIVE_FILES = ['live-integrity-tab.tsx', 'use-clock-due.ts', 'use-core-verify.ts', 'use-evidence-media-ref.ts'];
/**
 * The sentences of Simulated mode that speak of the simulation (they are true there). Every other
 * sentence of the folder says nothing about one, so a sentence added later is held to the rule without
 * being listed. (Until the consolidation of the suite, D233, this file listed the Live keys instead
 * and pinned the rest by a digest of the copy "as at acaff20".)
 */
const SIMULATED_MODE_SENTENCES = [
  'integrity.simulatedLabel',
  'integrity.signatureSimulated',
  'integrity.noPackage',
  'actions.manifestToast',
  'play.simulated',
  'export.sourceSimulated',
  'export.zipNote',
];

function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}

describe('Evidence takes the Core through the light Live API (CLG c, AC-C-53)', () => {
  it('reads the folder: every production file, sub-folders included', () => {
    // Rule R1 (`@/runtime/testing/static-scan`): the scan is the folder's production sources, by a second walk; not a list.
    expectScanIsTheFolder(production.map((file) => file.name), FOLDER);
  });

  it('no production file names the simulator\'s actions hook or reads `.actions` (rule 1)', () => {
    expect(matching(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`))).toEqual([]);
    // `styles.actions` is a style sheet entry, not the simulator's actions.
    expect(production.filter((file) => /(?<!\bstyles)\.actions\b/.test(unquoted(file.text))).map((file) => file.name)).toEqual([]);
  });

  it('the Core\'s actions come from `useCoreActions()` and are settled', () => {
    expect(matching(/\buseCoreActions\(\)/)).toEqual(['evidence-detail.tsx', 'evidence-list-screen.tsx', 'export-sheet.tsx', 'integrity-tab.tsx', 'use-core-verify.ts']);
    for (const name of ['archive-dialog.tsx', 'export-sheet.tsx', 'sim-adapter.ts', 'use-core-verify.ts']) expect(fileText(name)).toMatch(/\bsettle\(/);
  });

  it('operation 40 is the one operation called through the Live client, from one file (rule 1)', () => {
    // Row 92 (M8-W3) adds the reads and commands of the sealed item that are no simulator action: the export job
    // (87), the media session (88) and the transcript (84, 85, 86), each through `useMobileLive()`'s client.
    expect(matching(/\.client\.call\(/)).toEqual(['export-job.ts', 'media-session.ts', 'transcript.ts', 'use-evidence-media-ref.ts']);
    expect(fileText('use-evidence-media-ref.ts')).toMatch(/client\.call\('getEvidence'/);
  });
});

describe('No network, no address, no storage, no credential, no raw link state (rules 3 and 4; M0)', () => {
  it('names no network API and no Core server address', () => {
    expect(matching(/\bfetch\(|XMLHttpRequest|new WebSocket|127\.0\.0\.1|localhost|https?:\/\//)).toEqual([]);
  });

  it('imports no storage package, no Live source module and no credential module', () => {
    expect(matching(/from '(?:expo-secure-store|@react-native-async-storage\/async-storage|@dems\/shared\/live\/source[^']*|@\/runtime\/secure-credentials)'/)).toEqual([]);
    expect(matching(/from '@\/runtime\/[^']+'/)).toEqual([]);
  });

  it('names no raw state of the Core link and no rule of its own (the link notice is the runtime\'s)', () => {
    expect(matching(/\b(?:CONNECTING|RESYNCING|STALE)\b/)).toEqual([]);
  });
});

describe('One LIVE idiom (rule 5)', () => {
  it('the files that pick a LIVE behaviour read `useCoreLink().source`; none reads the data-mode hook', () => {
    expect(matching(/useCoreLink\(\)\.source === 'LIVE'/)).toEqual([
      'archive-dialog.tsx',
      // Fix wave Q (CP-05): `useSimulatedCoreLink` - the Summary's rule for the demonstration mark, for list rows.
      'evidence-chips.tsx',
      'evidence-detail.tsx',
      'export-sheet.tsx',
    ]);
    expect(matching(/\buseCoreMode\b|\buseLive\b\(/)).toEqual([]);
  });
});

describe('The Live waits run on the store\'s clock (rule 7)', () => {
  it('the files written for Live mode hold no timer of their own', () => {
    for (const name of LIVE_FILES) expect([name, /\bsetTimeout\b|\bsetInterval\b|Date\.now/.test(fileText(name))]).toEqual([name, false]);
  });
});

describe('The copy (rule 8)', () => {
  const all = leaves(evidenceEn);

  it('the copy speaks of a simulation only in the sentences of Simulated mode: the Live copy says nothing about one', () => {
    expect(all.length).toBeGreaterThan(0);
    const speaking = all.filter((leaf) => /simulat/i.test(leaf.text)).map((leaf) => leaf.key);
    // The control: the sentences of Simulated mode are found (the pattern reads the tree).
    expect(speaking.length).toBeGreaterThan(0);
    expect(speaking.filter((key) => !SIMULATED_MODE_SENTENCES.includes(key))).toEqual([]);
    // Closing copy round (D162 DN-5): the Live success toast is the shared `evidence.live.export.success`.
    expect(/simulat/i.test(en.evidence.live.export.success)).toBe(false);
  });

  it('no SIM-GAP marker was added: the folder holds the eight of `acaff20`', () => {
    // Put together, so that this file adds no marker to the count (KI-07: 13 IDs, 62 markers).
    const marker = (n: number): string => ['SIM', 'GAP', 'M83', String(n)].join('-');
    const markers = raw.flatMap((file) => file.source.match(/SIM-GAP-M\d+-\d+/g) ?? []);
    expect(markers.sort()).toEqual([...Array<string>(6).fill(marker(1)), ...Array<string>(2).fill(marker(2))]);
  });
});
