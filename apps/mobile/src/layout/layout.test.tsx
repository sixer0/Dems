// SafeScreen, ChromeInsetsProvider and PaneLayout (04_mobile_specs §2.4, §2.6, §4.0 testIDs).
import { afterEach, describe, expect, it } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Dimensions, StyleSheet, Text, type ViewStyle } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ChromeInsetsProvider, PANE_GAP, Pane, PaneLayout, SafeScreen } from '@/layout';

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
