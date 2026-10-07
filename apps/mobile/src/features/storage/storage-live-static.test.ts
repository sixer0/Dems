// Backend task W79, static tests over the production files of `features/storage/` (client gate CLG item
// (c), AC-C-53; gateway_check/09_cp_mobile_runtime §4 answer 3, rules 1 to 5, 7 to 9;
// gateway_check/09b_m1_mobile_consolidation §8; 04_client_integration_spec §3.2, §8.6 S2-6). The model is
// W78's `features/devices/devices-live-static.test.ts`.
//
//  1. No production file takes the Core's actions from the simulator: no `useSimActions`, and no
//     `.actions` read on a `Sim`. The one call (operation 55) comes from `useCoreActions()` and goes
//     through `settle`; a Live rejection is handed to the presenter first.
//  2. The pending control is the runtime's: `usePendingPress`, `busyState` and `PendingSpinner` from
//     `@/runtime`, never a copy of the hook in this folder.
//  3. The folder names no network API, no Core server address, no storage package, no Live source module,
//     and no new timer or wall clock (rules 3, 4 and 7).
//  4. One LIVE idiom (rule 5): the one file that picks the LIVE wording reads `useCoreLink().source`.
//  5. The copy (rule 8): the LIVE text says nothing about a simulation, no `SIM-GAP` marker was added or
//     removed (KI-07 stays 13 IDs / 62 markers), and the copy of Simulated mode is what it was at `acaff20`.
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { en } from '@dems/shared/i18n';
import { storageEn } from './i18n';

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
const production = raw.filter((file) => !isTest(file.name)).map((file) => ({ name: file.name, text: code(file.source) }));
const matching = (pattern: RegExp): string[] => production.filter((file) => pattern.test(file.text)).map((file) => file.name);
const fileText = (name: string): string => production.find((file) => file.name === name)!.text;

const SIM_ACTIONS_HOOK = ['use', 'Sim', 'Actions'].join('');
/** Text inside quotes is no code: `t('common.actions.retry')` names a translation, not a simulator. */
const unquoted = (text: string): string => text.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");

function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}
const digest = (list: unknown): string => createHash('sha256').update(JSON.stringify(list)).digest('hex');

describe('Storage takes the Core through the light Live API (CLG c, AC-C-53)', () => {
  it('reads the folder: every production file, sub-folders included (no new production file)', () => {
    expect(production.map((file) => file.name)).toEqual([
      'capacity-card.tsx',
      'capacity-ring.tsx',
      'i18n.ts',
      'manage-storage-sheet.tsx',
      'panel-boundary.tsx',
      'sim-adapter.ts',
      'storage-activity.tsx',
      'storage-kpis.tsx',
      'storage-model.ts',
      'storage-motion.ts',
      'storage-screen.tsx',
      'use-held-value.ts',
      'use-sheet-presence.tsx',
      'use-storage-alerts.ts',
      'use-storage-data.ts',
    ]);
  });

  it("no production file calls the simulator's action hook", () => {
    expect(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`).test(`const actions = ${SIM_ACTIONS_HOOK}();`)).toBe(true);
    expect(matching(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`))).toEqual([]);
  });

  it('no production file reads `.actions` of a `Sim` (translation keys in quotes are no reads)', () => {
    const reads = production.flatMap((file) => [...unquoted(file.text).matchAll(/[\w.$\])]*\.actions\b/g)].map((match) => `${file.name}: ${match[0]}`));
    expect(reads).toEqual([]);
  });

  it('S2-6: the one call is `useCoreActions` through `settle`; the presenter first in LIVE; toast and close in `ok`, idle in `done`', () => {
    const screen = fileText('storage-screen.tsx');
    expect(screen).toMatch(/const actions = useCoreActions\(\);/);
    expect(unquoted(screen).match(/\bactions\.\w+/g)).toEqual(['actions.setStoragePolicy']);
    expect(screen).toMatch(/settle\(\(\) => actions\.setStoragePolicy\(\{ retentionPolicy: draft\.retentionPolicy, autoArchive: draft\.autoArchive \}\), \{/);
    expect(screen).toMatch(/if \(live && presentCoreError\(error\)\) \{/);
    // LB-3: the success toast, then the sheet's `applied` (it closes), both in `ok`; `done` releases the control.
    expect(screen).toMatch(/ok: \(\) => \{\n\s*reportRuntimeIssue\('info'[^\n]*\n\s*toast\.show\(\{ variant: 'success'[^\n]*\n\s*handlers\.applied\(\);/);
    expect(screen).toMatch(/done: handlers\.settled,/);
    expect(matching(/\buseCoreActions\b/)).toEqual(['storage-screen.tsx']);
    expect(matching(/\bsettle\(/)).toEqual(['storage-screen.tsx']);
  });
});

describe('the pending control is the runtime\'s (09b §8; LB-1)', () => {
  it('`usePendingPress`, `busyState` and `PendingSpinner` come from `@/runtime`; the folder holds no copy of the hook', () => {
    const sheet = fileText('manage-storage-sheet.tsx');
    expect(sheet).toMatch(/import \{ PendingSpinner, busyState, usePendingPress \} from '@\/runtime';/);
    expect(sheet).toMatch(/press\.run\(\(release\) => onApply\(draft, \{ applied: onClose, settled: release \}\)\);/);
    expect(sheet).toMatch(/\{\.\.\.busyState\(busy, !allowed \|\| !changed\)\}/);
    expect(sheet).toMatch(/\{pending \? <PendingSpinner [^>]*testID="storage-manage-apply-spinner" \/> : null\}/);
    expect(matching(/function usePendingPress\b|LIVE_PENDING_REVEAL_MS|function busyState\b/)).toEqual([]);
    expect(matching(/\busePendingPress\b/)).toEqual(['manage-storage-sheet.tsx']);
  });
});

describe('what belongs to the runtime stays there (rules 3, 4, 7 and 9)', () => {
  it('the folder names no network API, no Core server address, no storage package, no Live source module', () => {
    const forbidden: Record<string, RegExp> = {
      'a raw request': new RegExp(`(?<![.\\w$'"\`/-])${['fe', 'tch'].join('')}\\s*\\(`),
      'a socket constructor': new RegExp(`\\bnew\\s+${['Web', 'Socket'].join('')}\\b`),
      'the Core server address': new RegExp(`\\b${['CORE', 'SERVER'].join('_')}_\\w+|(?<![\\w.])${['44', '2'].join('')}[0-9](?!\\w)`),
      'the secure-store package or its wrapper': new RegExp(`${['expo', 'secure', 'store'].join('-')}|${['secure', 'credentials'].join('-')}`),
      AsyncStorage: new RegExp(['Async', 'Storage'].join('')),
      'the Live source or the typed client': new RegExp(`@dems/shared/(?:live/source|live/testing|client)|${['create', 'Live', 'Sim'].join('')}|${['create', 'Core', 'Client'].join('')}`),
    };
    for (const [what, pattern] of Object.entries(forbidden)) expect([what, matching(pattern)]).toEqual([what, []]);
    // Through the barrel only (rule 9).
    expect(matching(/from '@\/runtime\/[^']+'/)).toEqual([]);
  });

  it('rule 7: no new timer or wall clock — the three that exist are older than this task and read no Core time', () => {
    // `use-held-value.ts` (the ring's held centre value), `use-sheet-presence.tsx` (the sheet's exit unmount,
    // one of the KI-08 copies) and `panel-boundary.tsx` (the Retry cooldown): all unchanged since `acaff20`.
    const timer = new RegExp(`\\b(?:${['set', 'Timeout'].join('')}|${['set', 'Interval'].join('')})\\b|${['Date', 'now'].join('\\.')}`);
    expect(matching(timer)).toEqual(['panel-boundary.tsx', 'use-held-value.ts', 'use-sheet-presence.tsx']);
  });
});

describe('one LIVE idiom (rule 5)', () => {
  it('the LIVE wording is picked from `useCoreLink().source` in one file, never from a preference or the data-mode hook', () => {
    expect(matching(/\b(?:useCoreMode|getCoreLinkSource|useCoreLinkSource|useCoreLinkSourceSetting|coreLinkSource|useLive|useMobileLive)\b/)).toEqual([]);
    expect(matching(/useCoreLink\(\)\.source === 'LIVE'/)).toEqual(['storage-screen.tsx']);
    expect(matching(/\buseCoreLink\b/)).toEqual(['storage-screen.tsx']);
  });
});

describe('the copy (rule 8; §3.2)', () => {
  it('the text LIVE mode adds says nothing about a simulation; the text it replaces did', () => {
    // Closing copy round (D168 DN-2): the LIVE toast is the web console's shared key; the folder keeps no LIVE copy.
    const live = leaves(en.storage.manage.live);
    expect(live).toEqual([{ key: 'applied', text: 'Storage policy updated' }]);
    expect(live.filter((leaf) => /simulat|demo\b|mock/i.test(leaf.text))).toEqual([]);
    expect(leaves(storageEn).filter((leaf) => leaf.key.startsWith('live.'))).toEqual([]);
    expect(fileText('storage-screen.tsx')).toMatch(/live \? t\('storage\.manage\.live\.applied'\) : t\('storage\.manage\.applied'\)/);
  });

  it('no `SIM-GAP` marker was added or removed: the folder keeps its 10 markers of `acaff20` (KI-07 stays 13 IDs / 62 markers)', () => {
    const name = ['SIM', 'GAP'].join('-');
    const marker = new RegExp(`${name}-M\\d+-\\d+`, 'g');
    const counts: Record<string, number> = {};
    for (const file of raw) for (const match of file.source.match(marker) ?? []) counts[match] = (counts[match] ?? 0) + 1;
    expect(counts).toEqual({ [`${name}-M85-1`]: 5, [`${name}-M85-2`]: 5 });
  });

  it('the copy of Simulated mode is as it was at `acaff20`: 26 texts, one digest', () => {
    // The digest of the same list built from `git show acaff20:apps/mobile/src/features/storage/i18n.ts`.
    const simulated = leaves(storageEn).filter((leaf) => !leaf.key.startsWith('live.'));
    expect(simulated).toHaveLength(26);
    expect(digest(simulated)).toBe('927dd04cfa7438f2c1098c44f7be8ceb23d9c4ea36549d5cb0e04f43e4b5acdf');
  });
});
