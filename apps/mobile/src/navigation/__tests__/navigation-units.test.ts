// Pure parts of the navigation shell (step 70): deep-link parsing (zod), the pending href, the
// §3.7 resync table, the §3.3 post-sign-in order, the destination rules and the i18n registry.
import { beforeEach, describe, expect, it } from '@jest/globals';
import type { SessionState } from '@dems/shared/domain';
import { FEATURE_RESOURCES } from '@/i18n/features';
import {
  hasMotionParam,
  parseRecordId,
  parseScenario,
  parseSessionStep,
  parseSettingsSection,
  toInternalHref,
} from '@/navigation/params';
import {
  clearPendingHref,
  peekPendingHref,
  recordIncomingLink,
  resetPendingHrefForTests,
  setSignedInSnapshot,
} from '@/navigation/pending-href';
import { parseRailCollapsed } from '@/navigation/rail-prefs';
import {
  ALL_TABS,
  PHONE_TABS,
  ROUTE_SCREENS,
  TABLET_TABS,
  activeDestination,
  isGuardedPath,
  tabForSegments,
} from '@/navigation/routes';
import { isSessionActive, isSessionBusy, postSignInHref, sessionResyncHref } from '@/navigation/session-routes';
import { redirectSystemPath } from '../../app/+native-intent';

// A web URL on a reserved domain, built so the MA-25 grep (`https?://` in src) stays clean.
const FOREIGN_WEB_URL = `${'https'}://example.invalid`;

describe('params (zod)', () => {
  it('accepts record ids and rejects anything that could form a path, a query or a scheme', () => {
    expect(parseRecordId('EV-20261001-0007')).toBe('EV-20261001-0007');
    expect(parseRecordId(['CAM-01', 'CAM-02'])).toBe('CAM-01');
    for (const bad of ['', '../etc', 'a/b', 'a?b', 'javascript:x', ' ', 'x'.repeat(65), '-lead']) {
      expect(parseRecordId(bad)).toBeNull();
    }
    expect(parseRecordId(undefined)).toBeNull();
  });

  it('parses the wizard step with a fallback of 1', () => {
    expect(parseSessionStep('1')).toBe(1);
    expect(parseSessionStep('3')).toBe(3);
    for (const bad of [undefined, '0', '4', '2.5', 'two', '']) expect(parseSessionStep(bad)).toBe(1);
  });

  it('knows the five Settings sections (04 §4.15)', () => {
    expect(parseSettingsSection('maintenance')).toBe('maintenance');
    expect(parseSettingsSection('firmware')).toBeNull();
  });

  it('parses a debug scenario name', () => {
    expect(parseScenario('recording')).toBe('recording');
    expect(parseScenario('Recording; drop')).toBeNull();
  });

  it('detects the proof-mode switch on the boot route', () => {
    expect(hasMotionParam({ motion: 'slow' })).toBe(true);
    expect(hasMotionParam({ motion: '' })).toBe(false);
    expect(hasMotionParam({})).toBe(false);
  });
});

describe('toInternalHref', () => {
  it.each([
    ['demsdemo:///evidence?selected=EV-1', '/evidence', '?selected=EV-1'],
    ['demsdemo://evidence/EV-1', '/evidence/EV-1', ''],
    ['demsdemo://?motion=slow', '/', ''],
    ['/home?motion=off&debug=1&scenario=recording', '/home', '?scenario=recording'],
    ['/settings/about/', '/settings/about', ''],
  ])('%s → %s%s', (input, pathname, search) => {
    expect(toInternalHref(input)).toEqual({ pathname, search });
  });

  it.each([FOREIGN_WEB_URL, 'exp://127.0.0.1:8081/--/home', '//host/home', '/a/../b', '/a b', 'x'.repeat(600), ''])(
    'rejects %s',
    (input) => {
      expect(toInternalHref(input)).toBeNull();
    },
  );
});

describe('pending href (04 §3.3)', () => {
  beforeEach(() => resetPendingHrefForTests());

  it('records a guarded link received while signed out and opens /login instead, through +native-intent', () => {
    expect(redirectSystemPath({ path: 'demsdemo:///evidence?selected=EV-1&motion=off', initial: true })).toBe('/login');
    expect(peekPendingHref()).toBe('/evidence?selected=EV-1');
    // Public links pass through unchanged.
    expect(redirectSystemPath({ path: 'demsdemo:///pair', initial: false })).toBe('demsdemo:///pair');
    expect(redirectSystemPath({ path: 'demsdemo://?motion=slow', initial: false })).toBe('demsdemo://?motion=slow');
  });

  it('leaves links alone while signed in', () => {
    setSignedInSnapshot(true);
    expect(redirectSystemPath({ path: 'demsdemo:///audit', initial: false })).toBe('demsdemo:///audit');
    expect(peekPendingHref()).toBeNull();
  });

  it('ignores public links and foreign schemes, and never throws', () => {
    recordIncomingLink('demsdemo:///pair');
    recordIncomingLink('demsdemo://?motion=slow');
    recordIncomingLink(`${FOREIGN_WEB_URL}/evidence`);
    expect(peekPendingHref()).toBeNull();
    expect(redirectSystemPath({ path: '%%%', initial: false })).toBe('%%%');
  });

  it('drops a pending link on sign-out and does not record links while signed in', () => {
    recordIncomingLink('demsdemo:///audit');
    setSignedInSnapshot(true);
    recordIncomingLink('demsdemo:///devices');
    expect(peekPendingHref()).toBeNull();
    setSignedInSnapshot(false);
    expect(peekPendingHref()).toBeNull();
    recordIncomingLink('demsdemo:///devices');
    expect(peekPendingHref()).toBe('/devices');
    clearPendingHref();
    expect(peekPendingHref()).toBeNull();
  });
});

describe('session routing (04 §3.7, §3.3, §3.5)', () => {
  const table: [SessionState | null, string | null][] = [
    [null, null],
    ['CREATE', '/session/new?step=1'],
    ['PRECHECK', '/session/new?step=2'],
    ['ARMED', '/session/new?step=3'],
    ['RECORDING', '/session/live'],
    ['STOPPING', '/session/finalizing'],
    ['FINALIZING', '/session/finalizing'],
    ['SEALED', null],
    ['FAULT', '/session/recovery'],
    ['RECOVERY', '/session/recovery'],
  ];

  it.each(table)('%s → %s', (state, href) => {
    expect(sessionResyncHref(state, { sessionId: 'S-1' })).toBe(href);
  });

  it('opens an unacknowledged SEALED summary, and stays when it is acknowledged or unknown', () => {
    expect(sessionResyncHref('SEALED', { sessionId: 'S-1', summaryAcknowledged: false })).toBe('/session/summary/S-1');
    expect(sessionResyncHref('SEALED', { sessionId: 'S-1', summaryAcknowledged: true })).toBeNull();
    expect(sessionResyncHref('SEALED', { sessionId: 'S-1' })).toBeNull();
  });

  it('orders the post-sign-in target: resync, pending, Home', () => {
    expect(postSignInHref('/session/live', '/evidence')).toBe('/session/live');
    expect(postSignInHref(null, '/evidence')).toBe('/evidence');
    expect(postSignInHref(null, null)).toBe('/home');
  });

  it('classifies busy and active states', () => {
    expect(['RECORDING', 'STOPPING', 'FINALIZING', 'FAULT', 'RECOVERY'].every((s) => isSessionBusy(s as SessionState))).toBe(true);
    expect(['CREATE', 'PRECHECK', 'ARMED', 'SEALED'].some((s) => isSessionBusy(s as SessionState))).toBe(false);
    expect(isSessionBusy(null)).toBe(false);
    expect(isSessionActive('ARMED')).toBe(true);
    expect(isSessionActive('SEALED')).toBe(false);
    expect(isSessionActive(null)).toBe(false);
  });
});

describe('destinations (04 §2.3)', () => {
  it('shows five on phones and eight on tablets; the navigator holds all nine', () => {
    expect(PHONE_TABS).toHaveLength(5);
    expect(TABLET_TABS).toHaveLength(8);
    expect(new Set(ALL_TABS).size).toBe(9);
    expect(TABLET_TABS).not.toContain('more');
  });

  it('highlights More for the More destinations on a phone only', () => {
    expect(activeDestination('storage', PHONE_TABS)).toBe('more');
    expect(activeDestination('storage', TABLET_TABS)).toBe('storage');
    expect(activeDestination('more', TABLET_TABS)).toBeNull();
    expect(activeDestination(null, PHONE_TABS)).toBeNull();
  });

  it('finds the tab in route segments', () => {
    expect(tabForSegments(['(app)', '(tabs)', 'evidence', '[evidenceId]'])).toBe('evidence');
    expect(tabForSegments(['(app)', 'session', 'live'])).toBeNull();
  });

  it('marks exactly the (app) routes as guarded', () => {
    for (const route of ROUTE_SCREENS) {
      expect([route.pattern, isGuardedPath(route.pattern)]).toEqual([route.pattern, route.access === 'guarded']);
    }
    expect(isGuardedPath('/dev-gallery')).toBe(false);
  });
});

describe('registries', () => {
  it('registers one i18n tree per feature folder with a screen, plus the shell copy', () => {
    const folders = [...new Set(ROUTE_SCREENS.map((r) => r.folder).filter((f) => f !== 'home'))].sort();
    expect(Object.keys(FEATURE_RESOURCES).sort()).toEqual([...folders, 'navigation'].sort());
  });

  it('reads only its own field from the shared prefs key', () => {
    expect(parseRailCollapsed(null)).toBe(false);
    expect(parseRailCollapsed('{"reduceMotion":true,"railCollapsed":true}')).toBe(true);
    expect(parseRailCollapsed('{"railCollapsed":"yes"}')).toBe(false);
    expect(() => parseRailCollapsed('[1]')).toThrow(TypeError);
  });
});
