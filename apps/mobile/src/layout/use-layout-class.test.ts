// T-M01 (04_mobile_specs §10.1): window size → layout class and navigation chrome (§2.2, §2.3).
import { describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import {
  BREAKPOINTS,
  NAV_DIMENSIONS,
  layoutClassFor,
  navChromeFor,
  useLayoutClass,
  type LayoutClass,
} from './use-layout-class';

describe('layoutClassFor (T-M01 table)', () => {
  const cases: [width: number, height: number, expected: LayoutClass][] = [
    [411, 923, 'compact'], // dems_phone portrait (04 §2.1)
    [923, 411, 'compact-landscape'], // dems_phone landscape
    [800, 1280, 'medium'], // dems_tablet portrait
    [1280, 800, 'expanded'], // dems_tablet landscape
    [640, 800, 'medium'], // tablet split-screen
    [500, 800, 'compact'],
  ];

  it.each(cases)('%i x %i dp → %s', (width, height, expected) => {
    expect(layoutClassFor(width, height)).toBe(expected);
  });

  it('puts the class boundaries exactly on 600, 840 and 480 dp', () => {
    expect(layoutClassFor(BREAKPOINTS.medium - 1, 900)).toBe('compact');
    expect(layoutClassFor(BREAKPOINTS.medium, 900)).toBe('medium');
    expect(layoutClassFor(BREAKPOINTS.expanded - 1, 900)).toBe('medium');
    expect(layoutClassFor(BREAKPOINTS.expanded, 900)).toBe('expanded');
    expect(layoutClassFor(900, BREAKPOINTS.minPaneHeight - 1)).toBe('compact-landscape');
    expect(layoutClassFor(900, BREAKPOINTS.minPaneHeight)).toBe('expanded');
  });
});

describe('navChromeFor', () => {
  it('phone portrait: bottom bar, 5 destinations, labels below', () => {
    expect(navChromeFor(411, 923)).toEqual({
      kind: 'bottom-bar',
      railWidth: 0,
      labels: 'below',
      destinations: 5,
      extended: false,
    });
  });

  it('phone landscape: icon-only 72 dp rail, 5 destinations', () => {
    expect(navChromeFor(923, 411)).toMatchObject({
      kind: 'rail',
      railWidth: NAV_DIMENSIONS.compactRail,
      labels: 'none',
      destinations: 5,
    });
  });

  it('tablet portrait: 88 dp rail with labels, 8 destinations', () => {
    expect(navChromeFor(800, 1280)).toMatchObject({ kind: 'rail', railWidth: 88, labels: 'below', destinations: 8 });
  });

  it('tablet landscape (1280 x 800): extended 232 dp rail, collapsible to 88 dp', () => {
    expect(navChromeFor(1280, 800)).toEqual({
      kind: 'rail',
      railWidth: NAV_DIMENSIONS.extendedRail,
      labels: 'inline',
      destinations: 8,
      extended: true,
    });
    expect(navChromeFor(1280, 800, { railCollapsed: true })).toMatchObject({ railWidth: 88, extended: false });
  });

  it('expanded below 1200 dp keeps the 88 dp rail', () => {
    expect(navChromeFor(1000, 700)).toMatchObject({ kind: 'rail', railWidth: 88, extended: false, destinations: 8 });
  });
});

describe('useLayoutClass', () => {
  function setWindow(width: number, height: number) {
    act(() => {
      Dimensions.set({
        window: { width, height, scale: 2, fontScale: 1 },
        screen: { width, height, scale: 2, fontScale: 1 },
      });
    });
  }

  it('re-classifies live when the window rotates (D17, §2.5)', () => {
    setWindow(411, 923);
    const { result } = renderHook(() => useLayoutClass());
    expect(result.current.layoutClass).toBe('compact');
    expect(result.current.isMultiPane).toBe(false);
    expect(result.current.nav.kind).toBe('bottom-bar');

    setWindow(1280, 800);
    expect(result.current.layoutClass).toBe('expanded');
    expect(result.current.isMultiPane).toBe(true);
    expect(result.current.nav.extended).toBe(true);

    setWindow(923, 411);
    expect(result.current.layoutClass).toBe('compact-landscape');
    expect(result.current.nav.railWidth).toBe(NAV_DIMENSIONS.compactRail);
  });

  it('honours the rail-collapsed preference', () => {
    setWindow(1280, 800);
    const { result } = renderHook(() => useLayoutClass({ railCollapsed: true }));
    expect(result.current.nav).toMatchObject({ railWidth: NAV_DIMENSIONS.rail, extended: false });
  });
});
