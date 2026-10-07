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
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { sessionSummaryEn } from './i18n';

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

const SIM_ACTIONS_HOOK = ['use', 'Sim', 'Actions'].join('');
/** Text inside quotes is no code: `t('common.actions.done')` names a translation, not a simulator. */
const unquoted = (text: string): string => text.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");

function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}
const digest = (list: unknown): string => createHash('sha256').update(JSON.stringify(list)).digest('hex');

describe('the three folders take the Core through the light Live API (CLG c, AC-C-53)', () => {
  it('reads all three folders: every production file, sub-folders included', () => {
    expect(production.map((file) => file.name)).toEqual([
      'session-finalizing/finalization-pipeline.tsx',
      'session-finalizing/finalizing.model.ts',
      'session-finalizing/flow-boundary.tsx',
      // E-fix row FX-M2 (E2E-P-4): the monitor-to-Finalizing hand-over mark (one slot, no timer).
      'session-finalizing/handover.ts',
      'session-finalizing/i18n.ts',
      'session-finalizing/sealed-stamp.tsx',
      'session-finalizing/session-finalizing-screen.tsx',
      'session-finalizing/use-finalizing.ts',
      'session-summary/hash-sheet.tsx',
      'session-summary/i18n.ts',
      'session-summary/session-summary-screen.tsx',
      'session-summary/sim-adapter.ts',
      'session-summary/stamp-once.ts',
      'session-summary/summary-handoff.ts',
      'session-summary/summary.model.ts',
      'session-summary/use-sheet-presence.tsx',
      'session-summary/use-summary.ts',
      'sessions/hub-top.tsx',
      'sessions/i18n.ts',
      'sessions/rec-dot.tsx',
      'sessions/session-detail-screen.tsx',
      'sessions/session-detail.tsx',
      'sessions/session-row.tsx',
      'sessions/session-status-chip.tsx',
      'sessions/sessions-model.ts',
      'sessions/sessions-screen.tsx',
      'sessions/use-hand-off.ts',
      'sessions/use-sessions-data.ts',
    ]);
  });

  it('no production file calls the simulator\'s action hook', () => {
    expect(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`).test(`const actions = ${SIM_ACTIONS_HOOK}();`)).toBe(true);
    expect(matching(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`))).toEqual([]);
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
    expect(matching(/\buseCoreActions\b/)).toEqual(['session-summary/use-summary.ts']);
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
    expect(matching(/useCoreLink\(\)\.source === 'LIVE'/)).toEqual(['session-summary/use-summary.ts']);
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
    // The two timers left are step 80's, unchanged since `acaff20`: the region boundary's retry
    // cooldown and the sheet's exit animation. No timer paces a Core command (rule 7).
    expect(matching(/\bsetTimeout\b|\bsetInterval\b/)).toEqual(['session-finalizing/flow-boundary.tsx', 'session-summary/use-sheet-presence.tsx']);
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
  it('the Summary\'s LIVE text says nothing about a simulation; the Simulated copy is the step-80 copy', () => {
    const summary = leaves(sessionSummaryEn);
    const live = summary.filter((leaf) => leaf.key.startsWith('live.'));
    expect(live.map((leaf) => leaf.key)).toEqual(['live.linkDownTitle', 'live.linkDownBody']);
    expect(live.filter((leaf) => /simulat|mock-core/i.test(leaf.text))).toEqual([]);
    // Every other leaf as step 80 left it (the digest of the key-text pairs at `acaff20`).
    expect(digest(summary.filter((leaf) => !leaf.key.startsWith('live.')))).toBe(STEP_80_SUMMARY_COPY);
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

/** sha256 of the `features.session-summary` key-text pairs as step 80 wrote them (the file at `acaff20`). */
const STEP_80_SUMMARY_COPY = 'e9c32acfc2840f99009ed21517ec379b015fea4d5ea74a9a1e04be52d7b4b09e';
