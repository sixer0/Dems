// SafeScreen, ChromeInsetsProvider and PaneLayout (04_mobile_specs §2.4, §2.6, §4.0 testIDs).
import { afterEach, describe, expect, it } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Dimensions, StyleSheet, Text, type ViewStyle } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ChromeInsetsProvider, PANE_GAP, Pane, PaneLayout, SafeScreen, PANE_REFLOW, paneReflowFor } from '@/layout';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { FULL_MOTION, REDUCED_MOTION, SLOW_MOTION, layoutTransition, resetMotionStateForTests } from '@/motion';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 411, height: 923 },
  insets: { top: 24, right: 0, bottom: 16, left: 8 },
};

function withSafeArea(children: ReactNode) {
  return <SafeAreaProvider initialMetrics={METRICS}>{children}</SafeAreaProvider>;
}

function styleOf(testID: string): ViewStyle {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style) as ViewStyle;
}

function setWindow(width: number, height: number) {
  act(() => {
    Dimensions.set({
      window: { width, height, scale: 2, fontScale: 1 },
      screen: { width, height, scale: 2, fontScale: 1 },
    });
  });
}

describe('SafeScreen', () => {
  it('carries screen-<id> and pads every edge by default', () => {
    render(withSafeArea(<SafeScreen id="demo"><Text>body</Text></SafeScreen>));
    const style = styleOf('screen-demo');
    expect(style).toMatchObject({ flex: 1, paddingTop: 24, paddingRight: 0, paddingBottom: 16, paddingLeft: 8 });
    expect(style.backgroundColor).toBeDefined();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('does not pad edges the chrome consumed (bottom bar owns the bottom inset)', () => {
    render(
      withSafeArea(
        <ChromeInsetsProvider consumed={['bottom']}>
          <SafeScreen id="tab">
            <Text>tab body</Text>
          </SafeScreen>
        </ChromeInsetsProvider>,
      ),
    );
    expect(styleOf('screen-tab')).toMatchObject({ paddingTop: 24, paddingBottom: 0, paddingLeft: 8 });
  });

  it('nested chrome providers accumulate consumed edges (rail + header)', () => {
    render(
      withSafeArea(
        <ChromeInsetsProvider consumed={['left']}>
          <ChromeInsetsProvider consumed={['top']}>
            <SafeScreen id="nested" />
          </ChromeInsetsProvider>
        </ChromeInsetsProvider>,
      ),
    );
    expect(styleOf('screen-nested')).toMatchObject({ paddingTop: 0, paddingLeft: 0, paddingBottom: 16 });
  });

  it('explicit edges win over the chrome context', () => {
    render(
      withSafeArea(
        <ChromeInsetsProvider consumed={['bottom']}>
          <SafeScreen id="flow" edges={['top', 'bottom']} />
        </ChromeInsetsProvider>,
      ),
    );
    expect(styleOf('screen-flow')).toMatchObject({ paddingTop: 24, paddingBottom: 16, paddingLeft: 0 });
  });

  it('a scrolling screen pads its content with an inset spacer instead of the root', () => {
    render(withSafeArea(<SafeScreen id="list" scroll><Text>row</Text></SafeScreen>));
    expect(styleOf('screen-list').paddingBottom).toBe(0);
    expect(styleOf('screen-list-inset-spacer').height).toBe(16);
  });
});

describe('PaneLayout', () => {
  afterEach(() => setWindow(411, 923));

  function renderEvidenceLike() {
    return render(
      <PaneLayout testID="panes">
        <Pane name="list" width={360}>
          <Text>list</Text>
        </Pane>
        <Pane name="detail" flex={3} hideWhenStacked>
          <Text>detail</Text>
        </Pane>
      </PaneLayout>,
    );
  }

  it('stacks on compact and hides a pane marked hideWhenStacked (phone portrait)', () => {
    setWindow(411, 923);
    renderEvidenceLike();
    expect(styleOf('panes')).toMatchObject({ flexDirection: 'column', gap: PANE_GAP.stacked });
    expect(screen.getByTestId('pane-list')).toBeTruthy();
    expect(screen.queryByTestId('pane-detail')).toBeNull();
  });

  it('lays panes side by side on medium and expanded with their widths (tablet)', () => {
    setWindow(1280, 800);
    renderEvidenceLike();
    expect(styleOf('panes')).toMatchObject({ flexDirection: 'row', gap: PANE_GAP.row });
    expect(styleOf('pane-list')).toMatchObject({ width: 360, flexShrink: 0 });
    expect(styleOf('pane-detail')).toMatchObject({ flex: 3 });
  });

  it('re-flows live when the window rotates (D17)', () => {
    setWindow(800, 1280);
    renderEvidenceLike();
    expect(screen.getByTestId('pane-detail')).toBeTruthy();
    setWindow(411, 923);
    expect(screen.queryByTestId('pane-detail')).toBeNull();
    expect(styleOf('panes').flexDirection).toBe('column');
  });

  it('stackOn lets a screen stack on more classes (e.g. compact-landscape)', () => {
    setWindow(923, 411);
    render(
      <PaneLayout testID="panes" stackOn={['compact', 'compact-landscape']}>
        <Pane name="a" />
        <Pane name="b" />
      </PaneLayout>,
    );
    expect(styleOf('panes').flexDirection).toBe('column');
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-k-m1-pane-reduced.test.tsx` (test-suite consolidation, D233): every case as it was.
// Wave K, driver M1 - gate finding G81b-03 (MAJOR): on the tablet Session Summary "Done", "View in
// Evidence" and the "Sealed files" rows did not answer a tap.
//
// CAUSE, read on the tablet (implementation/142_fix_wave_k_m1.md section 2): the shared `Pane` is an
// animated view with a layout transition. Under REDUCED motion (the OS setting, the in-app switch,
// the `motion=off` link every gate runs with) Reanimated skips a reduced layout transition WITHOUT
// applying the new frame: a pane whose content grew after its mount kept its old native height, its
// lower content lay outside its box, and Android delivers no touch outside a parent's bounds.
// A minimal pane on the device: content grown 40 -> 400 dp, pane box stayed 40 dp, a button in the
// grown part took no tap; with no `layout` prop the box follows and the tap lands.
//
// RULES HELD HERE
//   1. Under reduced motion NO layout transition reaches a view: `Pane` passes none, and the shared
//      builder `layoutTransition` returns none. (jest cannot see a native frame; it can see the prop.)
//   2. Full motion keeps the spring (CONTROL).
//   3. Static: a layout transition is written in the shared places only, and none of them hands a
//      REDUCED transition to a view (a zero-length `ReduceMotion.Always` one, or the bare constant).
describe('a pane under reduced motion', () => {
unmountBeforeTheHooksOfThisGroup();
afterEach(() => resetMotionStateForTests());

const layoutOf = (testID: string): unknown => (screen.getByTestId(testID).props as { layout?: unknown }).layout;

describe('G81b-03 - a pane under reduced motion carries no layout transition', () => {
  it('paneReflowFor: reduced = none; full = the pane spring', () => {
    expect(paneReflowFor('reduced')).toBeUndefined();
    expect(paneReflowFor('full')).toBe(PANE_REFLOW);
  });

  const REDUCED_BY: [string, Parameters<typeof resetMotionStateForTests>[0]][] = [
    ['the `motion=off` link', { linkMotion: 'off' }],
    ['the OS setting', { osReduceMotion: true }],
    ['the in-app switch', { reduceMotionOverride: true }],
  ];
  it.each(REDUCED_BY)('reduced by %s: a pane outside a PaneLayout (the Session Summary) and the panes of a PaneLayout have no `layout` prop', (_name, state) => {
    resetMotionStateForTests(state);
    render(
      <>
        <Pane name="alone">
          <Text>a</Text>
        </Pane>
        <PaneLayout stackOn={[]}>
          <Pane name="left" width={300} />
          <Pane name="right" flex={1} />
        </PaneLayout>
      </>,
    );
    for (const id of ['pane-alone', 'pane-left', 'pane-right']) expect(layoutOf(id)).toBeUndefined();
  });

  it('CONTROL: under full motion the pane keeps its re-flow spring', () => {
    resetMotionStateForTests();
    render(
      <Pane name="alone">
        <Text>a</Text>
      </Pane>,
    );
    expect(layoutOf('pane-alone')).toBe(PANE_REFLOW);
  });

  it('the shared builder: reduced = none; full and slow = a transition', () => {
    expect(layoutTransition(REDUCED_MOTION)).toBeUndefined();
    expect(layoutTransition(FULL_MOTION)).toBeDefined();
    expect(layoutTransition(SLOW_MOTION)).toBeDefined();
  });
});

describe('G81b-03 - static: where a layout transition may be written', () => {
  const SRC = join(__dirname, '..');
  /** The shared places that may name a Reanimated layout transition. Each gives NONE under reduced motion. */
  const ALLOWED = ['components/composed/session-timeline.tsx', 'layout/pane-layout.tsx', 'motion/builders.ts'];
  const TRANSITIONS = /\b(LinearTransition|SequencedTransition|FadingTransition|JumpingTransition|CurvedTransition|EntryExitTransition)\b/;

  function sources(dir: string, found: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name !== 'testing' && name !== '__tests__') sources(path, found);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) found.push(path);
    }
    return found;
  }
  const code = (path: string): string => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const files = sources(SRC);

  it('only the shared places name a layout transition', () => {
    const naming = files.filter((path) => TRANSITIONS.test(code(path))).map((path) => relative(SRC, path).split(sep).join('/'));
    expect(naming.sort()).toEqual(ALLOWED);
  });

  it('no source builds a REDUCED layout transition (zero length, or forced reduce): reduced motion is "no transition"', () => {
    const offenders = files
      .filter((path) => /Transition[\s\S]{0,120}?\.reduceMotion\(\s*ReduceMotion\.Always\s*\)/.test(code(path)) || /Transition\s*\.duration\(\s*0\s*\)/.test(code(path)))
      .map((path) => relative(SRC, path).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });

  it('the pane hands its transition to the view through the policy, never the bare constant', () => {
    const pane = code(join(SRC, 'layout', 'pane-layout.tsx'));
    expect(pane).toMatch(/layout=\{paneReflowFor\(policy\)\}/);
    expect(pane).not.toMatch(/layout=\{PANE_REFLOW\}/);
  });

  it('the timeline gives none under reduced motion (CONTROL of the rule, as it was before wave K)', () => {
    expect(code(join(SRC, 'components', 'composed', 'session-timeline.tsx'))).toMatch(/layout=\{reduced \? undefined : LinearTransition/);
  });
});
});
