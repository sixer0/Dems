// Backend task W73, static tests over the production files of `features/session-recovery/` (client
// gate CLG item (c), AC-C-53; gateway_check/09_cp_mobile_runtime §4 answer 3, rules 1 to 5, 7 to 9;
// 09b_m1_mobile_consolidation §8 and F.10). The model is W80's `audit-live-static.test.ts`.
//
//  1. No production file takes the Core's actions from the simulator: no `useSimActions`, and no
//     `.actions` read on a `Sim`. Start recovery (S2-3) and the alert acknowledgements (S4-8) come
//     from `useCoreActions()` through `settle`; the Start control uses the runtime's `usePendingPress`
//     with its `busyState` and `PendingSpinner`; a Live rejection goes to the presenter first.
//  2. The folder names no network API, no Core server address, no storage package, no Live source
//     module; no new timer; the runtime is imported through its barrel only.
//  3. One LIVE idiom (rule 5) and one link rule (M0, M1): `useCoreLink().source === 'LIVE'` and
//     `useCoreLinkNotice()` in one call.
//  4. The copy (rule 8): the LIVE texts say nothing about a simulation; the markers of the simulator's
//     gaps are exactly those of `acaff20` (KI-07).
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { sessionRecoveryEn } from './i18n';
import { expectNoSimActionsHook, expectScanIsTheFolder } from '@/runtime/testing/static-scan';

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
const production = raw.filter((file) => !isTest(file.name)).map((file) => ({ name: file.name, source: file.source, text: code(file.source) }));
const matching = (pattern: RegExp): string[] => production.filter((file) => pattern.test(file.text)).map((file) => file.name);
const fileText = (name: string): string => production.find((file) => file.name === name)!.text;

const GAP_MARKER = new RegExp(`${['SIM', 'GAP'].join('-')}-M\\d+-\\d+`, 'g');
/** Text inside quotes is no code: `t('features.session-recovery.actions.start')` names a translation. */
const unquoted = (text: string): string => text.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");

function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}

describe('Recovery takes the Core through the light Live API (CLG c, AC-C-53)', () => {
  it('reads the folder: every production file, sub-folders included', () => {
    // Rule R1 (`@/runtime/testing/static-scan`): the scan is the folder's production sources, by a second walk; not a list.
    expectScanIsTheFolder(production.map((file) => file.name), FOLDER);
  });

  it("no production file calls the simulator's action hook", () => {
    expectNoSimActionsHook(matching);
  });

  it('no production file reads `.actions` of a `Sim` (a translation key is no read)', () => {
    const pattern = /[\w.$\])]*\.actions\b/g;
    expect([...unquoted('const x = sim.actions.recover();').matchAll(pattern)].map((match) => match[0])).toEqual(['sim.actions']);
    expect([...unquoted("t('features.session-recovery.actions.start')").matchAll(pattern)]).toEqual([]);
    const reads = production.flatMap((file) => [...unquoted(file.text).matchAll(pattern)].map((match) => `${file.name}: ${match[0]}`));
    // The one name that matches is the screen's own StyleSheet entry `actions` (step 81), not a simulator.
    expect(fileText('session-recovery-screen.tsx')).toMatch(/const styles = StyleSheet\.create\(\{[\s\S]*\n {2}actions: \{ gap: spacing\[1\] \},/);
    expect(reads.filter((read) => read !== 'session-recovery-screen.tsx: styles.actions')).toEqual([]);
  });

  it('S2-3 and S4-8: the actions come from useCoreActions and every result goes through settle; the presenter comes first in LIVE', () => {
    const hook = fileText('use-recovery.ts');
    expect(hook).toMatch(/import \{ settle, useCoreActions \} from '@dems\/shared\/live';/);
    expect(hook).toMatch(/const actions = useCoreActions\(\);/);
    expect(hook).toMatch(/settle\(\(\) => startRecovery\(actions, role\), \{/);
    expect(hook).toMatch(/settle\(\(\) => actions\.acknowledgeAlert\(alert\.id\), \{ fail: failed \}\)/);
    expect((hook.match(/if \(live && presentCoreError\(error\)\)/g) ?? []).length).toBe(2);
    expect(fileText('sim-adapter.ts')).toMatch(/return actions\.recover\(\);/);
  });

  it('the Start control is the runtime\'s pending control (D166): the hook, busyState and PendingSpinner from the barrel, no copy', () => {
    const screen = fileText('session-recovery-screen.tsx');
    expect(screen).toMatch(/import \{ PendingSpinner, busyState, reportRuntimeIssue, useCoreLink, useCoreLinkNotice, usePendingPress \} from '@\/runtime';/);
    expect(screen).toMatch(/const press = usePendingPress\(\);/);
    expect(screen).toMatch(/press\.run\(\(release\) => onStart\(release\)\)/);
    expect(screen).toMatch(/\{\.\.\.busyState\(press\.busy\)\}/);
    expect(screen).toMatch(/\{press\.pending \? <PendingSpinner color=\{palette\.black\} testID="recovery-start-spinner" \/> : null\}/);
    expect(matching(/function usePendingPress|function busyState|function PendingSpinner/)).toEqual([]);
    expect(matching(/accessibilityState: \{ busy/)).toEqual([]);
  });
});

describe('No network, no credential, no second source; the runtime through its barrel (rules 1 to 4, 7, 9)', () => {
  it('names no network API and no Core address', () => {
    const network = /\bfetch\(|XMLHttpRequest|new WebSocket|https?:\/\/|127\.0\.0\.1|localhost/;
    expect(network.test('await fetch(url)')).toBe(true);
    expect(matching(network)).toEqual([]);
  });

  it('imports no storage or secure-store package, no Live source module, and the runtime only through its barrel', () => {
    expect(matching(/expo-secure-store|async-storage/)).toEqual([]);
    expect(matching(/@dems\/shared\/live\/(?:source|testing)/)).toEqual([]);
    expect(matching(/from '@\/runtime\/[^']*'/)).toEqual([]);
    expect(matching(/from '@\/navigation\/[^']*'/)).toEqual([]);
  });

  it('adds no timer: no setTimeout, and the one setInterval is the region boundary\'s retry countdown of step 81', () => {
    expect(matching(/\bsetTimeout\(/)).toEqual([]);
    expect(matching(/\bsetInterval\(/)).toEqual(['recovery-boundary.tsx']);
  });

  it('one LIVE idiom and one link rule: source === LIVE, the notice in one call', () => {
    expect(matching(/useCoreLink\(\)\.source === 'LIVE'/)).toEqual(['session-recovery-screen.tsx', 'use-recovery.ts']);
    expect(matching(/const \{ offline(?:: linkDown)? \} = useCoreLinkNotice\(\);/)).toEqual(['session-recovery-screen.tsx']);
    expect(matching(/useMobileLive|useLiveLink|initialOfflineNotice|offlineNoticeAfter/)).toEqual([]);
    // The read-only rule is the runtime's one helper (row M2, D175 DN-4): LIVE the one notice, else step 81's.
    expect(fileText('use-recovery.ts')).toMatch(/const readOnly = useCoreLinkReadOnly\(\);/);
  });
});

describe('The copy (rule 8, KI-07)', () => {
  it('the LIVE texts say nothing about a simulation', () => {
    const live = leaves(sessionRecoveryEn).filter((leaf) => leaf.key.startsWith('live.'));
    expect(live.map((leaf) => leaf.key)).toEqual(['live.linkDownTitle', 'live.linkDownBody', 'live.derived']);
    expect(live.filter((leaf) => /simulat/i.test(leaf.text))).toEqual([]);
  });

  it("the markers of the simulator's gaps are exactly those of acaff20, per production file; the new files hold none", () => {
    const counts = Object.fromEntries(production.map((file) => [file.name, (file.source.match(GAP_MARKER) ?? []).length]));
    expect(counts).toEqual({
      'i18n.ts': 0,
      'recovery-analysis.tsx': 1,
      'recovery-boundary.tsx': 0,
      'recovery.model.ts': 4,
      'session-recovery-screen.tsx': 2,
      'sim-adapter.ts': 7,
      'use-recovery.ts': 1,
    });
    const newFiles = ['live-recovery-sites.test.tsx', 'live-recovery-restart.test.tsx', 'recovery-live-static.test.ts', 'testing/live-recovery-bed.tsx'];
    expect(raw.filter((file) => newFiles.includes(file.name)).map((file) => [file.name, (file.source.match(GAP_MARKER) ?? []).length])).toEqual(
      newFiles.sort((a, b) => a.localeCompare(b)).map((name) => [name, 0]),
    );
  });
});
