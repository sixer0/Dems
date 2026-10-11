// Backend task W80, static tests over the production files of `features/audit/` (client gate CLG item
// (c), AC-C-53; gateway_check/09_cp_mobile_runtime §4 answer 3, rules 1 to 5, 7, 8 and 9;
// 09b_m1_mobile_consolidation §8; 04_client_integration_spec §3.2). The model is W78's
// `devices-live-static.test.ts`.
//
//  1. No production file takes the Core's actions from the simulator: no `useSimActions`, and no
//     `.actions` read on a `Sim`. The one call (site S1-7) comes from `useCoreActions()`, goes through
//     `settle` inside the runtime's `usePendingPress` (with its `busyState` and `PendingSpinner`, D166),
//     and a Live rejection goes to the presenter first.
//  2. The folder names no network API, no Core server address, no storage package, no Live source
//     module; no new timer; the runtime is imported through its barrel only.
//  3. One LIVE idiom (rule 5) and one link rule (M0, M1): `useCoreLink().source === 'LIVE'` picks the
//     LIVE wording; the operation's extra members are read through `useLiveSelector`; the offline notice
//     is `useCoreLinkNotice()` in one call.
//  4. The copy (rule 8): the LIVE text says nothing about a simulation, the folder holds no `SIM-GAP`
//     marker (none at `acaff20` either).
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { auditEn } from './i18n';
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
const production = raw.filter((file) => !isTest(file.name)).map((file) => ({ name: file.name, text: code(file.source) }));
const matching = (pattern: RegExp): string[] => production.filter((file) => pattern.test(file.text)).map((file) => file.name);
const fileText = (name: string): string => production.find((file) => file.name === name)!.text;

/** Text inside quotes is no code: `t('common.actions.verify')` names a translation, not a simulator. */
const unquoted = (text: string): string => text.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");

function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}

describe('Operator Audit takes the Core through the light Live API (CLG c, AC-C-53)', () => {
  it('reads the folder: every production file, sub-folders included', () => {
    // Rule R1 (`@/runtime/testing/static-scan`): the scan is the folder's production sources, by a second walk; not a list.
    expectScanIsTheFolder(production.map((file) => file.name), FOLDER);
  });

  it("no production file calls the simulator's action hook", () => {
    expectNoSimActionsHook(matching);
  });

  it('no production file reads `.actions` of a `Sim`', () => {
    expect([...unquoted('const x = sim.actions.verifyAuditChain();').matchAll(/[\w.$\])]*\.actions\b/g)].map((match) => match[0])).toEqual(['sim.actions']);
    const reads = production.flatMap((file) => [...unquoted(file.text).matchAll(/[\w.$\])]*\.actions\b/g)].map((match) => `${file.name}: ${match[0]}`));
    expect(reads).toEqual([]);
  });

  it('site S1-7: `useCoreActions`, `settle` inside `usePendingPress`, the presenter first in LIVE, the store clock for the stamp (S4-3)', () => {
    const strip = fileText('chain-strip.tsx');
    expect(strip).toMatch(/const actions = useCoreActions\(\);/);
    expect(unquoted(strip).match(/\bactions\.\w+/g)).toEqual(['actions.verifyAuditChain']);
    expect(strip).toMatch(/const press = usePendingPress\(\);/);
    expect(strip).toMatch(/press\.run\(\(release\) =>\s*settle\(\(\) => actions\.verifyAuditChain\(\), \{/);
    expect(strip).toMatch(/done: release,/);
    expect(strip).toMatch(/if \(live\) \{\s*const presented = presentCoreError\(error\);/);
    expect(strip).toMatch(/at: sim\.store\.getState\(\)\.clock\.now/);
    // D166: the runtime's helpers, never a copy: the busy mark, and the PendingSpinner only while pending.
    expect(strip).toMatch(/\{\.\.\.busyState\(verify\.busy, running\)\}/);
    expect(strip).toMatch(/verify\.pending \? <PendingSpinner testID="audit-verify-spinner" \/>/);
    expect(strip).toMatch(/import \{ PendingSpinner, busyState, [^}]*usePendingPress \} from '@\/runtime';/);
    expect(matching(/\buseCoreActions\b/)).toEqual(['chain-strip.tsx']);
    // Nothing is started from an effect (D158): the one call sits in the press handler's frame callback.
    expect(strip).not.toMatch(/useEffect\([^)]*verifyAuditChain/);
  });
});

describe('what belongs to the runtime stays there (rules 3, 4, 7 and 9)', () => {
  it('the folder names no network API, no Core server address, no storage package, no Live source module; no new timer; the barrel only', () => {
    const forbidden: Record<string, RegExp> = {
      'a raw request': new RegExp(`(?<![.\\w$'"\`/-])${['fe', 'tch'].join('')}\\s*\\(`),
      'a socket constructor': new RegExp(`\\bnew\\s+${['Web', 'Socket'].join('')}\\b`),
      'the Core server address': new RegExp(`\\b${['CORE', 'SERVER'].join('_')}_\\w+|(?<![\\w.])${['44', '2'].join('')}[0-9](?!\\w)`),
      'the secure-store package or its wrapper': new RegExp(`${['expo', 'secure', 'store'].join('-')}|${['secure', 'credentials'].join('-')}`),
      AsyncStorage: new RegExp(['Async', 'Storage'].join('')),
      'the Live source or the typed client': new RegExp(`@dems/shared/(?:live/source|live/testing|client)|${['create', 'Live', 'Sim'].join('')}|${['create', 'Core', 'Client'].join('')}`),
    };
    for (const [what, pattern] of Object.entries(forbidden)) expect([what, matching(pattern)]).toEqual([what, []]);
    // Rule 7: the two timers are older than this task and read no Core time: the error boundary's retry
    // cooldown and the sheet's exit-animation unmount (one of the KI-08 copies), both as at `acaff20`.
    const timer = new RegExp(`\\b(?:${['set', 'Timeout'].join('')}|${['set', 'Interval'].join('')})\\b|${['Date', 'now'].join('\\.')}`);
    expect(matching(timer)).toEqual(['audit-boundary.tsx', 'use-sheet-presence.tsx']);
    expect(matching(/from '@\/runtime\/[^']+'/)).toEqual([]);
    expect(matching(/from '@\/navigation\/[^']+'/)).toEqual([]);
  });
});

describe('one LIVE idiom (rule 5) and one link rule (rows M0, M1)', () => {
  it('the LIVE wording is picked from `useCoreLink().source`, never from a preference, a mode string or the data-mode hook', () => {
    expect(matching(/\b(?:useCoreMode|getCoreLinkSource|useCoreLinkSource|useCoreLinkSourceSetting|coreLinkSource|useLive|useMobileLive|liveOf)\b/)).toEqual([]);
    expect(matching(/useCoreLink\(\)\.source === 'LIVE'/)).toEqual(['chain-strip.tsx', 'use-audit-data.ts']);
    expect(matching(/\buseCoreLink\b(?!Notice)/)).toEqual(['chain-strip.tsx', 'use-audit-data.ts']);
    // Operation 60's `stored` and `lineage` are read where they are shown, through the documented selector.
    expect(matching(/\buseLiveSelector\b/)).toEqual(['chain-live.tsx']);
    expect(fileText('chain-live.tsx')).toMatch(/useLiveSelector\(\(live: MobileLiveSim \| null\) => live\?\.auditChain \?\? null\)/);
  });

  it('the offline notice is the runtime\'s one call; no screen reads a raw link state', () => {
    expect(matching(/\buseCoreLinkNotice\b/)).toEqual(['chain-live.tsx']);
    expect(fileText('chain-live.tsx')).toMatch(/const \{ offline \} = useCoreLinkNotice\(\);/);
    expect(matching(/\b(?:useConnectionBanner|initialOfflineNotice|offlineNoticeAfter|coreLinkViewOf|heartbeat)\b/)).toEqual([]);
    expect(matching(/\bOFFLINE\b|\bSTALE\b|\bONLINE\b/)).toEqual([]);
  });
});

describe('the copy (rule 8; §3.2)', () => {
  it('the text LIVE mode adds says nothing about a simulation', () => {
    const live = leaves(auditEn.live);
    expect(live.map((leaf) => leaf.key)).toEqual(['typedActor', 'storedVerified', 'storedBroken', 'earlierChains_one', 'earlierChains_other', 'offlineTitle', 'offlineBody']);
    expect(live.filter((leaf) => /simulat|mock/i.test(leaf.text))).toEqual([]);
  });

  it('no `SIM-GAP` marker: the folder holds none, as at `acaff20` (KI-07 stays 13 IDs / 62 markers)', () => {
    const marker = new RegExp(`${['SIM', 'GAP'].join('-')}-M\\d+-\\d+`, 'g');
    expect(raw.flatMap((file) => file.source.match(marker) ?? [])).toEqual([]);
  });
});
