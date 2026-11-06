// Backend task, plan row W72: static tests over the production files of `features/session-finalizing/`,
// `features/session-summary/` and `features/sessions/` (client gate CLG item (c), AC-C-53;
// gateway_check/09_cp_mobile_runtime §4 answer 3, rules 1, 3, 4, 5, 8 and 9; gateway_check/09b §8). The
// model is `features/dashboard/home-more-live-static.test.ts` (row W66).
//
//  1. No production file takes the Core's actions from the simulator: no `useSimActions`, and no
//     `.actions` read on a `Sim`. The one Core call of the three folders, the Summary's acknowledgement
//     (operation 37), comes from `useCoreActions()` and goes through `settle`, its rejection handed to
//     the presenter first in LIVE.
//  2. The folders name no network API, no Core server address, no storage package, no Live source
//     module, and import the runtime through its barrel only (rules 3, 4, 9).
//  3. One LIVE idiom (rule 5) and the runtime's one pending control and link notice (09b §8).
//  4. Nothing starts a Core command from an effect (decision D158): the acknowledgement is called from
//     the press handlers only.
//  5. The copy (rule 8): the Summary's LIVE text says nothing about a simulation, and no `SIM-GAP`
//     marker was added (the one marker of the folders is step 80's, on the time-source badge).
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { sessionSummaryEn } from './i18n';
import { expectNoSimActionsHook, expectScanIsTheFolder } from '@/runtime/testing/static-scan';

const FEATURES = join(__dirname, '..');
const FOLDERS = ['session-finalizing', 'session-summary', 'sessions'] as const;
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

const raw = FOLDERS.flatMap((folder) => sourceFiles(join(FEATURES, folder)))
  .map((path) => ({ name: relative(FEATURES, path).split(sep).join('/'), source: readFileSync(path, 'utf8') }))
  .filter((file) => !isTest(file.name))
  .sort((a, b) => a.name.localeCompare(b.name));
const production = raw.map((file) => ({ name: file.name, text: code(file.source) }));
const matching = (pattern: RegExp): string[] => production.filter((file) => pattern.test(file.text)).map((file) => file.name);
const fileText = (name: string): string => production.find((file) => file.name === name)!.text;

/** Text inside quotes is no code: `t('common.actions.done')` names a translation, not a simulator. */
const unquoted = (text: string): string => text.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");

function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}

describe('the three folders take the Core through the light Live API (CLG c, AC-C-53)', () => {
  it('reads all three folders: every production file, sub-folders included', () => {
    // Rule R1 (`@/runtime/testing/static-scan`): the scan is the folder's production sources, by a second walk; not a list.
    expectScanIsTheFolder(production.map((file) => file.name), FOLDERS.map((folder) => join(FEATURES, folder)), FEATURES);
  });

  it('no production file calls the simulator\'s action hook', () => {
    expectNoSimActionsHook(matching);
  });

  it('no production file reads `.actions` of a `Sim`: every `.actions` left is a style', () => {
    expect([...unquoted('sim.actions.acknowledgeSummary(id)').matchAll(/[\w.$\])]*\.actions\b/g)].map((m) => m[0])).toEqual(['sim.actions']);
    const reads = production.flatMap((file) => [...unquoted(file.text).matchAll(/[\w.$\])]*\.actions\b/g)].map((match) => `${file.name}: ${match[0]}`));
    expect([...new Set(reads)]).toEqual(['session-summary/session-summary-screen.tsx: styles.actions', 'sessions/session-detail.tsx: styles.actions']);
  });

  it('the one Core call: `useCoreActions`, through `settle`, its rejection handed to the presenter first in LIVE', () => {
    const hook = fileText('session-summary/use-summary.ts');
    expect(hook).toMatch(/const actions = useCoreActions\(\);/);
    expect(unquoted(hook).match(/\bactions\.\w+/g)).toEqual(['actions.acknowledgeSummary']);
    expect(hook).toMatch(/settle\(\(\) => actions\.acknowledgeSummary\(sessionId\), \{/);
    expect(hook).toMatch(/if \(live && presentCoreError\(error\)\) \{/);
    // No other file of the three folders takes the actions at all.
    // Fix wave J (JT-02): the device's "Retry sealing" (operation 33) is the second caller, by the same rule.
    expect(matching(/\buseCoreActions\b/)).toEqual(['session-finalizing/seal-attention.tsx', 'session-summary/use-summary.ts']);
    const retry = readFileSync(join(__dirname, '../session-finalizing/seal-attention.tsx'), 'utf8');
    expect(retry).toMatch(/settle\(\(\) => actions\.recover\(\)/);
    expect(retry).toMatch(/if \(live && presentCoreError\(error\)\) \{/);
    expect(matching(/\buseMobileLive\b/)).toEqual([]);
  });
});

describe('what belongs to the runtime stays there (rules 3, 4 and 9)', () => {
  it('the folders name no network API, no Core server address, no storage package and no Live source module; the runtime only through its barrel', () => {
    const forbidden: Record<string, RegExp> = {
      'a raw request': new RegExp(`(?<![.\\w$'"\`/-])${['fe', 'tch'].join('')}\\s*\\(`),
      'a socket constructor': new RegExp(`\\bnew\\s+${['Web', 'Socket'].join('')}\\b`),
      'the Core server address': new RegExp(`\\b${['CORE', 'SERVER'].join('_')}_\\w+|(?<![\\w.])${['44', '2'].join('')}[0-9](?!\\w)`),
      'the secure-store package or its wrapper': new RegExp(`${['expo', 'secure', 'store'].join('-')}|${['secure', 'credentials'].join('-')}`),
      AsyncStorage: new RegExp(['Async', 'Storage'].join('')),
      'the Live source or the typed client': new RegExp(`@dems/shared/(?:live/source|client)|${['create', 'Live', 'Sim'].join('')}|${['create', 'Core', 'Client'].join('')}`),
    };
    for (const [what, pattern] of Object.entries(forbidden)) expect([what, matching(pattern)]).toEqual([what, []]);
    expect(matching(/from '@\/runtime\/[^']+'/)).toEqual([]);
    expect(matching(/from '@\/navigation\/[^']+'/)).toEqual([]);
  });
});

describe('one LIVE idiom, one pending control, one link notice (rule 5; 09b §8)', () => {
  it('the mode is read from `useCoreLink().source` only; the link notice is `useCoreLinkNotice()`; no own link rule', () => {
    expect(matching(/\b(?:useCoreMode|getCoreLinkSource|useCoreLinkSource|useCoreLinkSourceSetting|coreLinkSource)\b/)).toEqual([]);
    // Fix wave I (contract note A1 §4): the Finalizing screen reads the mode with the same idiom - "Resumed after restart" is not claimed from an attempt count on a Core server.
    // Fix wave J round two (JA2-02): the Summary screen reads the mode with the same idiom for its demonstration statement.
    expect(matching(/useCoreLink\(\)\.source === 'LIVE'/)).toEqual(['session-finalizing/seal-attention.tsx', 'session-finalizing/session-finalizing-screen.tsx', 'session-summary/session-summary-screen.tsx', 'session-summary/use-summary.ts']);
    expect(matching(/\buseCoreLinkNotice\(\)/)).toEqual(['session-summary/session-summary-screen.tsx', 'sessions/sessions-screen.tsx']);
    expect(matching(/\b(?:coreLinkViewOf|offlineNoticeAfter|initialOfflineNotice|useConnectionBanner)\b/)).toEqual([]);
    expect(matching(/'(?:CONNECTING|RESYNCING|STALE|OFFLINE)'/)).toEqual([]);
  });

  it('every control that sends the acknowledgement is a `usePendingPress()` of the runtime, with `busyState` and the kit\'s spinner; no copy of the hook', () => {
    const screenText = fileText('session-summary/session-summary-screen.tsx');
    expect(screenText.match(/= usePendingPress\(\);/g)).toHaveLength(3);
    expect(screenText.match(/\{\.\.\.busyState\((?:press|donePress|evidencePress)\.busy\)\}/g)).toHaveLength(3);
    expect(screenText.match(/\.pending \? <PendingSpinner/g)).toHaveLength(3);
    expect(matching(/function usePendingPress|function busyState|function PendingSpinner/)).toEqual([]);
    // Two timers are step 80's, unchanged since `acaff20`: the region boundary's retry cooldown and the
    // sheet's exit animation. The third is row 87's (B9): the motion budget of the SEALED stamp, after which
    // React draws its rest state. No timer paces a Core command or moves sealing progress (rule 7; E-13).
    expect(matching(/\bsetTimeout\b|\bsetInterval\b/)).toEqual([
      'session-finalizing/flow-boundary.tsx',
      'session-finalizing/sealed-stamp.tsx',
      'session-summary/use-sheet-presence.tsx',
    ]);
    expect(fileText('session-finalizing/sealing-progress.ts')).not.toMatch(/\bDate\b|\bsetTimeout\b|\bsetInterval\b|\buseEffect\b|requestAnimationFrame/);
  });
});

describe('nothing starts a Core command from an effect (decision D158, F69-1)', () => {
  it('the acknowledgement is called from the three press handlers only, never inside an effect', () => {
    const screenText = fileText('session-summary/session-summary-screen.tsx');
    const calls = [...screenText.matchAll(/\b(\w+)Press\.run\(\(release\) => acknowledge\(/g)].map((match) => match[1]);
    expect(calls).toEqual(['done', 'back', 'evidence']);
    const effects = [...screenText.matchAll(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\);/g)].map((match) => match[0]);
    expect(effects.length).toBeGreaterThan(0);
    for (const effect of effects) expect(effect).not.toMatch(/\backnowledge\(|settle\(|actions\./);
    for (const file of ['session-finalizing/session-finalizing-screen.tsx', 'sessions/sessions-screen.tsx']) expect([file, fileText(file)]).not.toEqual([file, expect.stringMatching(/settle\(|useCoreActions/)]);
  });
});

describe('the copy (rule 8)', () => {
  it('the Summary\'s LIVE text says nothing about a simulation', () => {
    const summary = leaves(sessionSummaryEn);
    const live = summary.filter((leaf) => leaf.key.startsWith('live.'));
    expect(live.length).toBeGreaterThan(0);
    expect(live.filter((leaf) => /simulat|mock-core/i.test(leaf.text))).toEqual([]);
  });

  it('no `SIM-GAP` marker was added: the three folders hold the one step-80 marker only', () => {
    // Put together here, so this file holds no marker text of its own (the KI-07 count greps the tree).
    const marker = new RegExp([['SIM', 'GAP'].join('-'), 'M\\d+', '\\d+'].join('-'), 'g');
    const stepEighty = [['SIM', 'GAP'].join('-'), 'M80', '1'].join('-');
    const markers = raw.flatMap((file) => [...file.source.matchAll(marker)].map((match) => `${file.name}: ${match[0]}`));
    expect([...new Set(markers)]).toEqual([`session-summary/session-summary-screen.tsx: ${stepEighty}`, `session-summary/sim-adapter.ts: ${stepEighty}`]);
    expect(matching(/CONTRACT-GAP|SCHEMA-GAP|BE-GAP|\bTODO\b|\bFIXME\b/)).toEqual([]);
  });
});
