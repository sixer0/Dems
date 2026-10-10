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
//     added; the copy of Simulated mode is what it was at `acaff20`.
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { en } from '@dems/shared/i18n';
import { evidenceEn } from './i18n';

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
/** The copy that only Live mode shows. */
const LIVE_KEYS = [
  // Fix wave K, driver M2 (re-gates 81 / 89 / 94): the sentences added after `acaff20`. Simulated mode's copy is unchanged.
  'waveK.transcript.deniedCaseScope',
  'waveK.transcript.revisionReason',
  'waveK.transcript.model.title',
  'waveK.transcript.model.name',
  'waveK.transcript.model.version',
  'waveK.transcript.model.quantisation',
  'waveK.transcript.model.hash',
  'waveK.transcript.model.notStated',
  'waveK.export.requiresRole',
  'waveK.export.nothingSent',
  'waveK.export.requestNote',
  'waveK.export.request',
  'waveK.export.controlRequiresRole',
  'waveK.export.noArchive',
  'waveK.export.archiveNotStated',
  // Fix wave K, M1 (G94b-01), moved under the evidence tree by the final small fixes: the sealed player's no-seek sentence (`sealed-player-i18n.ts`).
  'player.noSeek',
  'media.checking',
  'media.unavailable',
  'integrity.coreLabel',
  'integrity.coreNote',
  'integrity.bundledResult',
  'integrity.bundledDiffers',
  'actions.manifestToastLive',
  'play.bundled',
  'export.deniedBodyUnrecorded',
  'export.zipNoteLive',
  // Closing-fix CF-M2 (R-T-2): the Live card's heading per the Core's stored verification.
  'integrity.failedOnCore',
  'integrity.notVerifiedYet',
  'integrity.coreNotRun',
  // Wave H C2 (G94-14 / G81-10): the Metadata tab's line for a recording of this Core (no "DEMO package" is spoken of).
  'metadata.coreRecordOnly',
];

function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}
const digest = (list: unknown): string => createHash('sha256').update(JSON.stringify(list)).digest('hex');

describe('Evidence takes the Core through the light Live API (CLG c, AC-C-53)', () => {
  it('reads the folder: every production file, sub-folders included', () => {
    expect(production.map((file) => file.name)).toEqual([
      'archive-dialog.tsx',
      // Blueprint row 92 (M8-W3): playback of the sealed files, the audio-source band, the transcript, the export job, the badge.
      'audio-source-band.tsx',
      'detail-intent.ts',
      'development-source.tsx',
      'evidence-chips.tsx',
      'evidence-detail-screen.tsx',
      'evidence-detail.tsx',
      'evidence-list-screen.tsx',
      'evidence-media.ts',
      'evidence-model.ts',
      'evidence-row.tsx',
      'export-job-model.ts',
      'export-job-status.tsx',
      'export-job.ts',
      'export-sheet.tsx',
      // Wave H C2 (G94-05, finding 4, the one reader of the item facts): three files, added by delta.
      'finished-exports.tsx',
      'i18n.ts',
      'integrity-tab.tsx',
      'interrupted-line.tsx',
      'item-facts.ts',
      'item-v2.ts',
      'live-integrity-tab.tsx',
      'media-session.ts',
      'media-tab.tsx',
      // Closing-fix CF-M2 (R-T-1): a kit Menu item's title and reason stacked.
      'menu-item-text.tsx',
      'metadata-tab.tsx',
      'play-sheet.tsx',
      'sealed-playback.ts',
      // Wave K M1 (G94b-01): the one sentence of the sealed player for a stream without a seek index.
      'sealed-player-i18n.ts',
      'sealed-player.tsx',
      // CF2-B (RF-T-1): the always-mounted selection glow of the list rows.
      'selection-glow.tsx',
      'sheet-frame.tsx',
      'sim-adapter.ts',
      'transcript-model.ts',
      'transcript-pane.tsx',
      'transcript-revise-sheet.tsx',
      'transcript.ts',
      'use-clock-due.ts',
      'use-core-verify.ts',
      'use-evidence-data.ts',
      'use-evidence-media-ref.ts',
      'use-evidence-playback.ts',
      'use-scramble.ts',
      // Blueprint row 87: the v2 answer of operation 41 (the one reader of this app) and its view.
      'verify-v2-report.tsx',
      'verify-v2.ts',
    ]);
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
    expect(matching(/useCoreLink\(\)\.source === 'LIVE'/)).toEqual(['archive-dialog.tsx', 'evidence-detail.tsx', 'export-sheet.tsx']);
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

  it('the Live copy says nothing about a simulation', () => {
    const live = all.filter((leaf) => LIVE_KEYS.includes(leaf.key));
    expect(live.map((leaf) => leaf.key).sort()).toEqual([...LIVE_KEYS].sort());
    expect(live.filter((leaf) => /simulat/i.test(leaf.text))).toEqual([]);
    // Closing copy round (D162 DN-5): the Live success toast is the shared `evidence.live.export.success`.
    expect(/simulat/i.test(en.evidence.live.export.success)).toBe(false);
  });

  it('the copy of Simulated mode is the copy of `acaff20` (185 texts, the same digest)', () => {
    const simulated = all.filter((leaf) => !LIVE_KEYS.includes(leaf.key));
    expect(simulated).toHaveLength(185);
    expect(digest(simulated)).toBe('649c9a0468cb49be63070a5d666fc2e83d5dcdb27818c5c32d56a501b44f034b');
  });

  it('no SIM-GAP marker was added: the folder holds the eight of `acaff20`', () => {
    // Put together, so that this file adds no marker to the count (KI-07: 13 IDs, 62 markers).
    const marker = (n: number): string => ['SIM', 'GAP', 'M83', String(n)].join('-');
    const markers = raw.flatMap((file) => file.source.match(/SIM-GAP-M\d+-\d+/g) ?? []);
    expect(markers.sort()).toEqual([...Array<string>(6).fill(marker(1)), ...Array<string>(2).fill(marker(2))]);
  });
});
