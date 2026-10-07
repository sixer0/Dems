// Backend task W78, static tests over the production files of `features/devices/` (client gate CLG
// item (c), AC-C-53; gateway_check/09_cp_mobile_runtime §4 answer 3, rules 1 to 5, 7 and 8;
// 04_client_integration_spec §3.2). The models are `pairing-live-static.test.ts` and W66's
// `home-more-live-static.test.ts`.
//
//  1. No production file takes the Core's actions from the simulator: no `useSimActions`, and no
//     `.actions` read on a `Sim`. The detail's four calls come from `useCoreActions()` and each goes
//     through `settle`; a Live rejection is handed to the presenter first.
//  2. The folder names no network API, no Core server address, no storage package, no Live source
//     module, and no timer or wall clock (rules 3, 4 and 7).
//  3. One LIVE idiom (rule 5): the one file that picks the LIVE wording reads `useCoreLink().source`.
//  4. The copy (rule 8): the LIVE text says nothing about a simulation, no `SIM-GAP` marker was added
//     (the folder keeps its 17 markers of `acaff20`), and the copy of Simulated mode is what it was at
//     `acaff20`.
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { devicesEn } from './i18n';

const FOLDER = __dirname;
const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path) || /(?:^|\/)(?:testing|__tests__)\//.test(path);
/** Code without its comments. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');

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
const productionRaw = raw.filter((file) => !isTest(file.name));
const production = productionRaw.map((file) => ({ name: file.name, text: code(file.source) }));
const matching = (pattern: RegExp): string[] => production.filter((file) => pattern.test(file.text)).map((file) => file.name);
const fileText = (name: string): string => production.find((file) => file.name === name)!.text;

const SIM_ACTIONS_HOOK = ['use', 'Sim', 'Actions'].join('');
/** Text inside quotes is no code: `t('devices.actions.failed')` names a translation, not a simulator. */
const unquoted = (text: string): string => text.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");

function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}
const digest = (list: unknown): string => createHash('sha256').update(JSON.stringify(list)).digest('hex');

describe('Devices takes the Core through the light Live API (CLG c, AC-C-53)', () => {
  it('reads the folder: every production file, sub-folders included', () => {
    expect(production.map((file) => file.name)).toEqual([
      'busy-state.ts',
      'device-command-dialog.tsx',
      'device-detail-screen.tsx',
      'device-detail.tsx',
      'device-ids.ts',
      'device-mic-meter.tsx',
      'device-row.tsx',
      'device-status-chip.tsx',
      'devices-model.ts',
      'devices-screen.tsx',
      'diagnostics-sheet.tsx',
      'health-chart.tsx',
      'i18n.ts',
      // E-fix row FX-M2 (E2E-T-2): the panel error boundary (the Storage folder's copy of step 77's).
      'panel-boundary.tsx',
      'sim-adapter.ts',
      'use-devices-data.ts',
      'use-pending-press.ts',
      'use-sheet-presence.tsx',
    ]);
  });

  it("no production file calls the simulator's action hook", () => {
    expect(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`).test(`const actions = ${SIM_ACTIONS_HOOK}();`)).toBe(true);
    expect(matching(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`))).toEqual([]);
  });

  it('no production file reads `.actions` of a `Sim`: every `.actions` left is a style', () => {
    const reads = production.flatMap((file) => [...unquoted(file.text).matchAll(/[\w.$\])]*\.actions\b/g)].map((match) => `${file.name}: ${match[0]}`));
    expect([...new Set(reads)]).toEqual(['device-command-dialog.tsx: styles.actions', 'device-detail.tsx: styles.actions']);
  });

  it("the detail's four calls: `useCoreActions`, each through `settle`; a Live rejection goes to the presenter first", () => {
    const detail = fileText('device-detail.tsx');
    expect(detail).toMatch(/const actions = useCoreActions\(\);/);
    expect(unquoted(detail).match(/\bactions\.\w+/g)).toEqual(['actions.runDiagnostics', 'actions.resetClip', 'actions.deviceCommand']);
    expect(detail).toMatch(/settle\(\(\) => actions\.runDiagnostics\(\), \{/);
    expect(detail).toMatch(/settle\(\(\) => actions\.resetClip\(channel\), \{/);
    // The device command is settled by the dialog (S3-2), which gets it as `onConfirm`.
    expect(detail).toMatch(/onConfirm=\{\(next\) => actions\.deviceCommand\(deviceId, next\)\}/);
    const dialog = fileText('device-command-dialog.tsx');
    expect(dialog).toMatch(/settle\(\(\) => onConfirm\(command\), \{/);
    for (const text of [detail, dialog]) expect(text).toMatch(/if \(live && presentCoreError\(error\)\) \{/);
    // AC-C-63: the success toast sits in `ok`, the close in `done`.
    expect(dialog).toMatch(/ok: \(\) => \{\s*toast\.show\(\{\s*variant: 'success'/);
    expect(dialog).toMatch(/done: \(\) => \{\s*release\(\);\s*onClose\(\);/);
    expect(matching(/\buseCoreActions\b/)).toEqual(['device-detail.tsx']);
  });
});

describe('what belongs to the runtime stays there (rules 3, 4 and 7)', () => {
  it('the folder names no network API, no Core server address, no storage package, no Live source module, no timer', () => {
    const forbidden: Record<string, RegExp> = {
      'a raw request': new RegExp(`(?<![.\\w$'"\`/-])${['fe', 'tch'].join('')}\\s*\\(`),
      'a socket constructor': new RegExp(`\\bnew\\s+${['Web', 'Socket'].join('')}\\b`),
      'the Core server address': new RegExp(`\\b${['CORE', 'SERVER'].join('_')}_\\w+|(?<![\\w.])${['44', '2'].join('')}[0-9](?!\\w)`),
      'the secure-store package or its wrapper': new RegExp(`${['expo', 'secure', 'store'].join('-')}|${['secure', 'credentials'].join('-')}`),
      AsyncStorage: new RegExp(['Async', 'Storage'].join('')),
      'the Live source or the typed client': new RegExp(`@dems/shared/(?:live/source|live/testing|client)|${['create', 'Live', 'Sim'].join('')}|${['create', 'Core', 'Client'].join('')}`),
    };
    for (const [what, pattern] of Object.entries(forbidden)) expect([what, matching(pattern)]).toEqual([what, []]);
    // Rule 7: no timer and no wall clock decides anything here. The one timer is older than this task: the
    // sheet's exit-animation unmount in `use-sheet-presence.tsx` (one of the KI-08 copies, unchanged since
    // `acaff20`), which reads no Core time.
    const timer = new RegExp(`\\b(?:${['set', 'Timeout'].join('')}|${['set', 'Interval'].join('')})\\b|${['Date', 'now'].join('\\.')}`);
    // E-fix row FX-M2 (E2E-T-2) adds the panel boundary's Retry cooldown (a UI countdown of 3/6/12 s,
    // the KI-08 boundary pattern of Home and Storage), which reads no Core time either.
    expect(matching(timer)).toEqual(['panel-boundary.tsx', 'use-sheet-presence.tsx']);
    // Through the barrel only (rule 9).
    expect(matching(/from '@\/runtime\/[^']+'/)).toEqual([]);
  });
});

describe('one LIVE idiom (rule 5)', () => {
  it('the LIVE wording is picked from `useCoreLink().source` in one file, never from a preference or the data-mode hook', () => {
    expect(matching(/\b(?:useCoreMode|getCoreLinkSource|useCoreLinkSource|useCoreLinkSourceSetting|coreLinkSource|useLive|useMobileLive)\b/)).toEqual([]);
    expect(matching(/useCoreLink\(\)\.source === 'LIVE'/)).toEqual(['device-detail.tsx']);
    // The rest get it as a plain value (the dialog and the sheet are portalled).
    expect(matching(/\buseCoreLink\b/)).toEqual(['device-detail.tsx']);
  });
});

describe('the copy (rule 8; §3.2)', () => {
  it('the text LIVE mode adds says nothing about a simulation; the texts it replaces did', () => {
    const live = leaves(devicesEn.live);
    expect(live).toHaveLength(8);
    expect(live.filter((leaf) => /simulat|demo\b|mock/i.test(leaf.text))).toEqual([]);
    expect(devicesEn.actions.testSignalBody).toMatch(/^Simulated\./);
    expect(devicesEn.actions.restartBody).toMatch(/^Simulated\./);
  });

  it('no `SIM-GAP` marker was added: the folder keeps the 17 markers of `acaff20` (KI-07 stays 13 IDs / 62 markers)', () => {
    const marker = new RegExp(`${['SIM', 'GAP'].join('-')}-M\\d+-\\d+`, 'g');
    const counts: Record<string, number> = {};
    for (const file of raw) for (const match of file.source.match(marker) ?? []) counts[match] = (counts[match] ?? 0) + 1;
    expect(counts).toEqual({ [`${['SIM', 'GAP'].join('-')}-M84-1`]: 6, [`${['SIM', 'GAP'].join('-')}-M84-2`]: 8, [`${['SIM', 'GAP'].join('-')}-M84-3`]: 3 });
  });

  it('the copy of Simulated mode is as it was at `acaff20`: 44 texts, one digest', () => {
    // The digest of the same list built from `git show acaff20:apps/mobile/src/features/devices/i18n.ts`.
    const simulated = leaves(devicesEn).filter((leaf) => !leaf.key.startsWith('live.'));
    expect(simulated).toHaveLength(44);
    expect(digest(simulated)).toBe('46379c8315ea224ddaf79c307c1839c951e2ef31d2353a415a7514aa4b34c4ec');
  });
});
