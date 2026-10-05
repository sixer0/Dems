// Row M2 (decision D175 DN-4; finding F73-5 of W73): ONE runtime helper for "session actions are
// read-only while the Core link is down", shared by the Session Monitor (step 79, row W68) and Recovery
// (step 81, row W73), which each held a copy (04_client_integration_spec §3.5 names both screens).
//
//  1. LIVE over a fake runtime: read-only exactly while the notice of rows M0 and M1 shows. A cold
//     start, a reconnect with no outage before it and a banner change alone do not make it read-only;
//     the step-79 two-valued rule would (W73's surviving mutant U6, which only a static pin held).
//  2. SIMULATED and HEARTBEAT keep the step-79 rule exactly: banner `offline` or link `state` OFFLINE.
//  3. It equals the two former copies (one text, verbatim below) at every step of every history of a
//     first link and three further link changes or resyncs, for every source.
//  4. One helper in the app: the barrel hands it out, both screens call it from the barrel, and no
//     production file under `features/` holds a copy (with positive controls of the former copy).
//  5. The file holds no effect, ref, timer or clock and is built on `useCoreLinkNotice()`.
import { describe, expect, it } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { ReactNode } from 'react';
import type { HeartbeatState } from '@dems/shared/domain';
import { useCoreLinkReadOnly as barrelUseCoreLinkReadOnly } from '@/runtime';
import { ConnectionBannerContext, bannerKindAfterResync, connectionBannerFor, nextBannerKind, useConnectionBanner, type ConnectionBannerKind } from './connection-banner';
import { RuntimeContractProvider, createRuntimeContract, useCoreLink, type CoreLinkInfo, type CoreLinkSource } from './contract';
import { coreLinkStateFor } from './core-link';
import { useCoreLinkNotice } from './use-core-link-notice';
import { useCoreLinkReadOnly } from './use-core-link-read-only';

const HEARTBEATS: readonly HeartbeatState[] = ['CONNECTING', 'LIVE', 'STALE', 'OFFLINE'];
const BANNERS: readonly ConnectionBannerKind[] = ['hidden', 'offline', 'resynced'];
const SOURCES: readonly CoreLinkSource[] = ['SIMULATED', 'HEARTBEAT', 'LIVE'];

/** The runtime's link per source, as `sim-runtime-provider.tsx` builds it; SIMULATED follows its tablet link. */
const linkOf = (source: CoreLinkSource, heartbeat: HeartbeatState): CoreLinkInfo =>
  source === 'SIMULATED'
    ? { source, state: coreLinkStateFor(source, heartbeat, heartbeat === 'LIVE' ? 'CONNECTED' : 'OFFLINE') }
    : { source, state: coreLinkStateFor(source, heartbeat, 'CONNECTED'), heartbeat };
const live = (heartbeat: HeartbeatState): CoreLinkInfo => linkOf('LIVE', heartbeat);

/** Step 79's two-valued rule (and step 81's, the same text), as a pure function of what it reads. */
const stepRule = (link: CoreLinkInfo, banner: ConnectionBannerKind): boolean => banner === 'offline' || link.state === 'OFFLINE';

/**
 * The former copy, verbatim: `features/session-live/use-monitor.ts:129-135` (`useMonitorReadOnly`) and
 * `features/session-recovery/use-recovery.ts:210-216` (`useRecoveryReadOnly`) held this same body before
 * row M2 (pre-images in `.cache/rollback/M2/`). The behavioural reference of part 3.
 */
function useReadOnlyBeforeM2(): boolean {
  const banner = useConnectionBanner();
  const link = useCoreLink();
  const { offline } = useCoreLinkNotice();
  if (link.source === 'LIVE') return offline;
  return banner.kind === 'offline' || link.state === 'OFFLINE';
}

interface Reading {
  readonly now: boolean;
  readonly before: boolean;
}

function mount(first: CoreLinkInfo, banner: ConnectionBannerKind) {
  const holder = { link: first, banner };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RuntimeContractProvider value={createRuntimeContract({ coreLink: holder.link })}>
      <ConnectionBannerContext.Provider value={connectionBannerFor(holder.banner)}>{children}</ConnectionBannerContext.Provider>
    </RuntimeContractProvider>
  );
  const view = renderHook((): Reading => ({ now: useCoreLinkReadOnly(), before: useReadOnlyBeforeM2() }), { wrapper });
  return {
    current: (): Reading => view.result.current,
    /** The next link and banner (by default the banner the runtime would compute from that link). */
    show(link: CoreLinkInfo, nextBanner: ConnectionBannerKind = nextBannerKind(holder.banner, link)): boolean {
      holder.link = link;
      holder.banner = nextBanner;
      view.rerender({});
      return view.result.current.now;
    },
    banner: (): ConnectionBannerKind => holder.banner,
    unmount: () => view.unmount(),
  };
}

// ── 1. LIVE ──────────────────────────────────────────────────────────────────────────────────

describe('useCoreLinkReadOnly() in LIVE: read-only exactly while the notice of rows M0 and M1 shows', () => {
  it('a cold start (CONNECTING before the first heartbeat, banner hidden) is not read-only; the step-79 rule would be', () => {
    const screen = mount(live('CONNECTING'), 'hidden');
    expect(screen.current().now).toBe(false);
    expect(stepRule(live('CONNECTING'), 'hidden')).toBe(true);
    // ... and the first heartbeat keeps it usable.
    expect(screen.show(live('LIVE'))).toBe(false);
  });

  it('a reconnect with no outage before it (CL-11a, e.g. the socket\'s reconnect after a sign-in) is a transient: not read-only', () => {
    const screen = mount(live('LIVE'), 'hidden');
    expect(screen.show(live('CONNECTING'))).toBe(false);
    expect(screen.banner()).toBe('hidden');
    expect(stepRule(live('CONNECTING'), 'hidden')).toBe(true);
    expect(screen.show(live('LIVE'))).toBe(false);
  });

  it('an outage: read-only from the first OFFLINE or STALE until the first heartbeat; reconnect attempts keep it (no blink)', () => {
    const screen = mount(live('LIVE'), 'hidden');
    const steps: HeartbeatState[] = ['STALE', 'OFFLINE', 'CONNECTING', 'OFFLINE', 'CONNECTING', 'OFFLINE', 'CONNECTING', 'LIVE', 'LIVE'];
    expect(steps.map((beat) => screen.show(live(beat)))).toEqual([true, true, true, true, true, true, true, false, false]);
    const other = mount(live('LIVE'), 'hidden');
    expect(['OFFLINE', 'CONNECTING', 'LIVE'].map((beat) => other.show(live(beat as HeartbeatState)))).toEqual([true, true, false]);
  });

  it('a screen first opened during a reconnect after an outage is read-only from its first render; one opened while down too', () => {
    expect(mount(live('CONNECTING'), 'offline').current().now).toBe(true);
    expect(mount(live('OFFLINE'), 'offline').current().now).toBe(true);
    expect(mount(live('STALE'), 'offline').current().now).toBe(true);
    expect(mount(live('LIVE'), 'resynced').current().now).toBe(false);
    expect(mount(live('LIVE'), 'hidden').current().now).toBe(false);
  });

  it('after the first render the banner alone moves nothing: only the link does (the step-79 rule would follow the banner)', () => {
    const screen = mount(live('LIVE'), 'hidden');
    expect(screen.show(live('LIVE'), 'offline')).toBe(false);
    expect(stepRule(live('LIVE'), 'offline')).toBe(true);
    expect(screen.show(live('OFFLINE'), 'hidden')).toBe(true);
    expect(screen.show(live('OFFLINE'), 'resynced')).toBe(true);
  });
});

// ── 2. SIMULATED and HEARTBEAT ───────────────────────────────────────────────────────────────

describe('useCoreLinkReadOnly() outside LIVE: the step-79 rule exactly', () => {
  it('every heartbeat and banner: read-only when the banner is offline or the link state is OFFLINE', () => {
    for (const source of ['SIMULATED', 'HEARTBEAT'] as const) {
      for (const heartbeat of HEARTBEATS) {
        for (const banner of BANNERS) {
          const link = linkOf(source, heartbeat);
          expect([source, heartbeat, banner, mount(link, banner).current().now]).toEqual([source, heartbeat, banner, stepRule(link, banner)]);
        }
      }
    }
  });

  it('the cases the step-79 rule names: HEARTBEAT CONNECTING is read-only (unlike LIVE), a banner offline alone is, an online link with no banner is not', () => {
    expect(mount(linkOf('HEARTBEAT', 'CONNECTING'), 'hidden').current().now).toBe(true);
    expect(mount(linkOf('HEARTBEAT', 'LIVE'), 'offline').current().now).toBe(true);
    expect(mount(linkOf('HEARTBEAT', 'LIVE'), 'resynced').current().now).toBe(false);
    expect(mount({ source: 'SIMULATED', state: 'OFFLINE' }, 'hidden').current().now).toBe(true);
    expect(mount({ source: 'SIMULATED', state: 'ONLINE' }, 'offline').current().now).toBe(true);
    expect(mount({ source: 'SIMULATED', state: 'ONLINE' }, 'hidden').current().now).toBe(false);
  });

  it('it follows every change at once, with no state of its own outside LIVE (a banner change alone moves it)', () => {
    const screen = mount(linkOf('HEARTBEAT', 'LIVE'), 'hidden');
    expect(screen.show(linkOf('HEARTBEAT', 'LIVE'), 'offline')).toBe(true);
    expect(screen.show(linkOf('HEARTBEAT', 'LIVE'), 'resynced')).toBe(false);
    expect(screen.show(linkOf('HEARTBEAT', 'CONNECTING'), 'resynced')).toBe(true);
    expect(screen.show(linkOf('HEARTBEAT', 'LIVE'), 'hidden')).toBe(false);
  });
});

// ── 3. Equal to the two former copies ────────────────────────────────────────────────────────

describe('useCoreLinkReadOnly() equals the former copy of both screens at every step', () => {
  it('every source, every first link, every sequence of three link changes or resyncs (2,592 screens, 10,368 renders)', () => {
    type Event = HeartbeatState | 'resync' | 'resynced-elapsed';
    const events: readonly Event[] = [...HEARTBEATS, 'resync', 'resynced-elapsed'];
    const sequences: Event[][] = [];
    for (const a of events) for (const b of events) for (const c of events) sequences.push([a, b, c]);
    let screens = 0;
    let renders = 0;
    let liveDiffersFromStepRule = 0;
    const mismatches: string[] = [];
    for (const source of SOURCES) {
      for (const first of HEARTBEATS) {
        for (const sequence of sequences) {
          screens += 1;
          let heartbeat = first;
          // The runtime starts its banner from `nextBannerKind('hidden', link)`.
          const screen = mount(linkOf(source, first), nextBannerKind('hidden', linkOf(source, first)));
          const check = (label: string) => {
            renders += 1;
            const { now, before } = screen.current();
            if (now !== before) mismatches.push(`${source} ${first} ${label}: now=${now} before=${before}`);
            if (source === 'LIVE' && now !== stepRule(linkOf(source, heartbeat), screen.banner())) liveDiffersFromStepRule += 1;
          };
          check('first');
          for (const [index, event] of sequence.entries()) {
            const banner = screen.banner();
            if (event === 'resync') screen.show(linkOf(source, heartbeat), bannerKindAfterResync(banner));
            else if (event === 'resynced-elapsed') screen.show(linkOf(source, heartbeat), banner === 'resynced' ? 'hidden' : banner);
            else {
              heartbeat = event;
              screen.show(linkOf(source, event));
            }
            check(`${sequence.slice(0, index + 1).join(' > ')}`);
          }
          screen.unmount();
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect([screens, renders]).toEqual([3 * 4 * 216, 3 * 4 * 216 * 4]);
    // The walk reaches the LIVE answers that differ from the step-79 rule (what U6 would change).
    expect(liveDiffersFromStepRule).toBeGreaterThan(0);
  });
});

// ── 4. One helper in the app ─────────────────────────────────────────────────────────────────

const SRC = join(__dirname, '..');
/** Code without its comments. The `//` of a URL is no comment. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');
const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path) || /(?:^|\/)(?:testing|__tests__)\//.test(path);
function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}
const features = sourceFiles(join(SRC, 'features'))
  .map((path) => ({ path: relative(SRC, path).split(sep).join('/'), text: code(readFileSync(path, 'utf8')) }))
  .filter((file) => !isTest(file.path))
  .sort((a, b) => a.path.localeCompare(b.path));
const fileCode = (path: string): string => features.find((file) => file.path === path)!.text;

/** A copy of the rule: the step-79 expression, or a file that combines the banner with the notice. */
const COPY_CHECKS: Record<string, (text: string) => boolean> = {
  'R1 the step-79 expression': (text) =>
    /\.kind === 'offline' \|\| [\w$.]+\.state === 'OFFLINE'|\.state === 'OFFLINE' \|\| [\w$.]+\.kind === 'offline'/.test(text),
  'R2 the banner and the notice in one file': (text) => /\buseConnectionBanner\(/.test(text) && /\buseCoreLinkNotice\(/.test(text),
};

/** The former copy, as text (both screens held it, under two names). */
const FORMER_COPY = `export function useMonitorReadOnly(): boolean {
  const banner = useConnectionBanner();
  const link = useCoreLink();
  const { offline } = useCoreLinkNotice();
  if (link.source === 'LIVE') return offline;
  return banner.kind === 'offline' || link.state === 'OFFLINE';
}`;

describe('one read-only helper in the app (row M2)', () => {
  it('the barrel hands out this very hook', () => {
    expect(barrelUseCoreLinkReadOnly).toBe(useCoreLinkReadOnly);
  });

  it('the Session Monitor (screen and actions) and Recovery call it, through the barrel', () => {
    for (const path of ['features/session-live/session-live-screen.tsx', 'features/session-live/use-monitor.ts', 'features/session-recovery/use-recovery.ts']) {
      const text = fileCode(path);
      expect([path, /const readOnly = useCoreLinkReadOnly\(\);/.test(text)]).toEqual([path, true]);
      expect([path, /import \{[^}]*\buseCoreLinkReadOnly\b[^}]*\} from '@\/runtime';/.test(text)]).toEqual([path, true]);
    }
    expect(features.filter((file) => /\bfunction use(?:Monitor|Recovery)ReadOnly\b/.test(file.text)).map((file) => file.path)).toEqual([]);
  });

  it('the checks find the former copy and stay quiet on what is no copy', () => {
    for (const [name, check] of Object.entries(COPY_CHECKS)) expect([name, check(code(FORMER_COPY))]).toEqual([name, true]);
    expect(COPY_CHECKS['R1 the step-79 expression']("return link.state === 'OFFLINE' || banner.kind === 'offline';")).toBe(true);
    const quiet = [
      // The monitor's banner view (`session-live/connection-banner.tsx`): it draws the banner, it decides nothing.
      "const banner = useConnectionBanner();\nconst offline = banner.kind === 'offline';",
      // Login's HEARTBEAT ring (`login/login-model.ts`).
      "if (coreLink.state === 'OFFLINE') return 'critical';",
      // A screen that shows the notice (Recovery's alert) and one that asks the helper.
      'const { offline: linkDown } = useCoreLinkNotice();',
      'const readOnly = useCoreLinkReadOnly();',
    ];
    for (const text of quiet) {
      for (const [name, check] of Object.entries(COPY_CHECKS)) expect([name, text, check(code(text))]).toEqual([name, text, false]);
    }
  });

  it('no production file under features/ holds a copy of the rule', () => {
    expect(features.length).toBeGreaterThan(150);
    for (const [name, check] of Object.entries(COPY_CHECKS)) {
      expect([name, features.filter((file) => check(file.text)).map((file) => file.path)]).toEqual([name, []]);
    }
  });
});

// ── 5. The file ──────────────────────────────────────────────────────────────────────────────

describe('the helper file', () => {
  it('is built on useCoreLinkNotice() and holds no effect, ref, state, timer or clock', () => {
    const text = code(readFileSync(join(__dirname, 'use-core-link-read-only.ts'), 'utf8'));
    expect(text).toMatch(/const \{ offline \} = useCoreLinkNotice\(\);/);
    expect(text).toMatch(/if \(link\.source === 'LIVE'\) return offline;/);
    expect(/\buse(?:Effect|LayoutEffect|Ref|State)\b|\bset(?:Timeout|Interval)\b|\bDate\b|\.now\s*\(/.test(text)).toBe(false);
    expect(text.match(/from '[^']+'/g)).toEqual(["from './connection-banner'", "from './contract'", "from './use-core-link-notice'"]);
  });
});
