// Backend task, plan row W79: Network & Time in LIVE mode. The screen changes no production file
// (04_client_integration_spec §7.4 "features/network-time (3) | None | … | No change", §17.4 Row 21 #3):
// it reads the replicated `time`, `network` and `tabletLink` slices and the Live clock. These tests prove
// that, on the app's real Live source over the contract-checked fake transport, it shows the Core
// server's data, follows it by delta, keeps it through an outage, sends no request of its own and says
// nothing about a simulation (rule 8, MD-8); and, statically, that the folder's production files still
// take nothing from the simulator's actions and hold the copy of `acaff20`.
//
// The Live bed is the Storage folder's (`features/storage/testing/live-storage-bed.tsx`, same row): it
// mounts both route files, so one bed proves both screens on the same Core.
// Import order: the module mocks, the router harness, the bed.
import './testing/network-time-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { renderLiveStorage, renderSimulatedStorage, resetLiveStorageBed, type LiveStorageBed, type LiveStorageBedOptions } from '@/features/storage/testing/live-storage-bed';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { networkTimeEn } from './i18n';

jest.setTimeout(30_000);

let bed: LiveStorageBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveStorageBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  expect(getMissingKeys()).toEqual([]);
});

/** The requests a signed-in tablet sends without any screen: the Live source's sign-in and session reads. */
const RUNTIME_OPERATIONS = new Set(['getAuthSession', 'getSignInStatus', 'getDeviceRegistration', 'signIn', 'touchSession']);
/** No text on screen says "simulated" (rule 8, MD-8). */
const saysSimulated = () => screen.queryAllByText(/simulat/i).length > 0;
const toastShown = (text: string | RegExp) => screen.queryAllByText(text).length > 0;
const textOf = (testID: string): string => {
  const children = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(children) ? children.join('') : String(children);
};
const tierSelected = (tier: 'GNSS' | 'NTP' | 'RTC'): boolean =>
  Boolean((screen.getByTestId(`network-time-tier-${tier}`).props.accessibilityState as { selected?: boolean }).selected);

/** Independent UTC+07:00 rendering of a time (no shared formatter). */
function wib(ms: number): { time: string; weekdayDate: string } {
  const d = new Date(ms + 7 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`,
    weekdayDate: `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
  };
}

async function wallClock(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/** A Core with values of its own, none of them the seed's: another address and LAN, 9 satellites, its own NTP server, one PoE port down. */
const ownCore: LiveStorageBedOptions = {
  setup: (engine) =>
    engine.sim.store.setState((s) => ({
      network: { ...s.network, ip: '192.168.10.77', lanName: 'Core LAN B', poe: { ...s.network.poe, activePorts: s.network.poe.totalPorts - 1 } },
      time: { ...s.time, gnss: { ...s.time.gnss, satellites: 9 }, ntp: { ...s.time.ntp, server: '192.168.10.9' } },
    })),
};

async function openNetworkTime(options: LiveStorageBedOptions = {}): Promise<LiveStorageBed> {
  const b = await renderLiveStorage(options);
  bed = b;
  await b.open('/network-time');
  expect(b.app.getPathname()).toBe('/network-time');
  expect(screen.getByTestId('screen-network-time')).toBeTruthy();
  return b;
}

describe("Network & Time on the Core's data (LIVE)", () => {
  it("shows the Core's address, LAN, satellites, NTP server, PoE ports and clock; sends nothing of its own; says nothing about a simulation", async () => {
    const b = await openNetworkTime(ownCore);
    const core = b.engine.sim.store.getState();
    // N3: the Core's NTP server and GNSS lock with ITS satellite count.
    expect(textOf('network-time-server-value')).toBe('192.168.10.9');
    expect(textOf('network-time-source-value')).toBe('GPS (GNSS Stratum-1)');
    expect(tierSelected('GNSS')).toBe(true);
    expect(String(screen.getByTestId('network-time-sync').props.accessibilityLabel)).toContain('GNSS locked, 9 satellites in view');
    // N2: the Core's PoE state (one port down).
    expect(String(screen.getByTestId('network-time-poe').props.accessibilityLabel)).toContain(`${core.network.poe.totalPorts - 1} of ${core.network.poe.totalPorts} ports`);
    // N4: the Live clock follows the Core's time (held to the minute under the `motion=off` test switch, D43).
    const live = b.state();
    expect(Math.abs(live.clock.now - b.fake.clock.now())).toBeLessThan(1_000);
    const shown = wib(Math.floor(live.clock.now / 60_000) * 60_000);
    expect(screen.getByTestId('network-time-clock').props.accessibilityLabel).toBe(`System time ${shown.time}, UTC+07:00, ${shown.weekdayDate}`);
    // The LAN sheet: the Core's address and network name.
    fireEvent.press(screen.getByTestId('network-time-lan'));
    await b.flush();
    await wallClock(50);
    expect(screen.getByTestId('network-time-lan-sheet')).toBeTruthy();
    expect(screen.getByText('192.168.10.77')).toBeTruthy();
    expect(screen.getByText('Core LAN B')).toBeTruthy();
    expect(saysSimulated()).toBe(false);
    // Only the replica: no read of operations 56 and 57, no request beyond the runtime's own.
    expect(b.requests('getNetworkStatus')).toHaveLength(0);
    expect(b.requests('getTimeStatus')).toHaveLength(0);
    expect(b.operations().filter((operationId) => !RUNTIME_OPERATIONS.has(operationId))).toEqual([]);
  });

  it('follows the Core by delta: GNSS lost (NTP fallback, one warning toast), then restored', async () => {
    const b = await openNetworkTime();
    expect(tierSelected('GNSS')).toBe(true);
    await b.runCore(1_000, (engine) => engine.sim.actions.inject('GNSS_LOSS'));
    expect(tierSelected('NTP')).toBe(true);
    expect(within(screen.getByTestId('network-time-sync-chip')).getByText('NTP fallback')).toBeTruthy();
    expect(textOf('network-time-source-value')).toMatch(/^NTP Server \(Stratum-\d\)$/);
    expect(toastShown('GNSS signal lost')).toBe(true);
    await b.runCore(1_000, (engine) => engine.sim.actions.clearFault('GNSS_LOSS'));
    expect(tierSelected('GNSS')).toBe(true);
    expect(toastShown('GNSS lock restored')).toBe(true);
    expect(saysSimulated()).toBe(false);
  });

  it("the tablet link is the Core's: OFFLINE by delta reads Offline in the LAN sheet", async () => {
    const b = await openNetworkTime();
    fireEvent.press(screen.getByTestId('network-time-lan'));
    await b.flush();
    await wallClock(50);
    expect(screen.getByTestId('network-time-lan-sheet')).toBeTruthy();
    expect(screen.queryAllByText('Offline')).toHaveLength(0);
    await b.runCore(100, (engine) => engine.sim.store.setState((s) => ({ tabletLink: { ...s.tabletLink, state: 'OFFLINE', changedAt: s.clock.now } })));
    expect(b.state().tabletLink.state).toBe('OFFLINE');
    expect(screen.queryAllByText('Offline').length).toBeGreaterThan(0);
  });

  it("an outage keeps the Core's last data and says nothing about a simulation", async () => {
    const b = await openNetworkTime(ownCore);
    act(() => void b.connection().drop());
    await b.elapse(2_000, 250);
    expect(textOf('network-time-server-value')).toBe('192.168.10.9');
    expect(String(screen.getByTestId('network-time-sync').props.accessibilityLabel)).toContain('GNSS locked, 9 satellites in view');
    expect(saysSimulated()).toBe(false);
    expect(b.operations().filter((operationId) => !RUNTIME_OPERATIONS.has(operationId))).toEqual([]);
  });

  it('SIMULATED mode is as before: the seed\'s address and server', async () => {
    const { app } = renderSimulatedStorage({ initialUrl: '/network-time' });
    await wallClock(50);
    expect(textOf('network-time-server-value')).toBe('192.168.10.1');
    fireEvent.press(screen.getByTestId('network-time-lan'));
    await wallClock(50);
    expect(screen.getByTestId('network-time-lan-sheet')).toBeTruthy();
    expect(screen.getByText('192.168.10.21')).toBeTruthy();
    app.unmount();
  });
});

// ── Static rules over the folder's production files (CLG c, AC-C-53; rules 1, 3, 5, 8, 9) ──────────────

const FOLDER = __dirname;
const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path) || /(?:^|\/)(?:testing|__tests__)\//.test(path);
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
const unquoted = (text: string): string => text.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");
function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}

describe('Network & Time: no production change, nothing from the simulator\'s actions (static)', () => {
  it('no action hook of the simulator or of the Core, no `.actions` read, no command', () => {
    const hooks = new RegExp(`\\b(?:${['use', 'Sim', 'Actions'].join('')}|useCoreActions|settle)\\b`);
    expect(matching(hooks)).toEqual([]);
    const reads = production.flatMap((file) => [...unquoted(file.text).matchAll(/[\w.$\])]*\.actions\b/g)].map((match) => `${file.name}: ${match[0]}`));
    expect(reads).toEqual([]);
  });

  it('no network API, no Core address, no Live source or client, no LIVE idiom of its own; through the barrel only', () => {
    const forbidden: Record<string, RegExp> = {
      'a raw request': new RegExp(`(?<![.\\w$'"\`/-])${['fe', 'tch'].join('')}\\s*\\(`),
      'a socket constructor': new RegExp(`\\bnew\\s+${['Web', 'Socket'].join('')}\\b`),
      'the Core server address': new RegExp(`\\b${['CORE', 'SERVER'].join('_')}_\\w+|(?<![\\w.])${['44', '2'].join('')}[0-9](?!\\w)`),
      'the Live source or the typed client': new RegExp(`@dems/shared/(?:live|client)|${['create', 'Live', 'Sim'].join('')}|${['create', 'Core', 'Client'].join('')}|useMobileLive|useCoreLink\\b`),
    };
    for (const [what, pattern] of Object.entries(forbidden)) expect([what, matching(pattern)]).toEqual([what, []]);
    expect(matching(/from '@\/runtime\/[^']+'/)).toEqual([]);
  });

  it('the copy says nothing about a simulation, and the folder holds no `SIM-GAP` marker', () => {
    const texts = leaves(networkTimeEn);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.filter((leaf) => /simulat|mock/i.test(leaf.text))).toEqual([]);
    const marker = new RegExp(`${['SIM', 'GAP'].join('-')}-M\\d+-\\d+`);
    expect(raw.filter((file) => marker.test(file.source)).map((file) => file.name)).toEqual([]);
  });
});
