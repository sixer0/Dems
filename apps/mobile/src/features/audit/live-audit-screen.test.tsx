// Backend task, plan row W80: what the Operator Audit view SHOWS in LIVE mode, on the app's real Live
// source over the contract-checked fake transport (`testing/live-audit-bed`), and that Simulated mode
// shows what it showed before.
//
// - The rows, the chain head and total, and the operators are the Core's (the replica; client spec §7.4,
//   §7.1 "read path"): no REST read is made for them.
// - A failed or locked sign-in names the operator whose username was TYPED, not an authenticated actor
//   (security review CPS1-12 (a)): in LIVE its actor reads "Username typed: <name>" in the row, the
//   detail and the search; a sign-in with an unknown username stays "Unverified user".
// - Nothing on the Live screen claims a simulation (rule 8; §3.2), also when the Core's own row message
//   says "(simulated)" (finding F63-4): the screen labels rows by their code and never shows `message`.
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/audit-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { AUTH_MAX_FAILURES, OPERATORS, type AuditRow } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderAuditApp, settle as flushSimulated } from './testing/audit-harness';
import { MARKER_PASSWORD, renderLiveAudit, resetLiveAuditBed, type LiveAuditBed, type LiveAuditBedOptions } from './testing/live-audit-bed';
import type { TestSim } from '@/runtime/testing/test-sim';

let bed: LiveAuditBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveAuditBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  expect(getMissingKeys()).toEqual([]);
});

const BUDI = OPERATORS.find((operator) => operator.username === 'budi.santoso')!;
const ANDI = OPERATORS.find((operator) => operator.username === 'andi.pratama')!;
/** A wrong password: a marker that opens nothing. */
const WRONG = `${MARKER_PASSWORD}-wrong`;
const SIMULATION_WORDING = /simulat|mock-core/i;

async function openAudit(options: LiveAuditBedOptions = {}): Promise<LiveAuditBed> {
  const b = await renderLiveAudit(options);
  bed = b;
  expect(screen.getByTestId('screen-audit')).toBeTruthy();
  return b;
}

async function search(text: string, flush: () => Promise<void>): Promise<void> {
  fireEvent.changeText(screen.getByTestId('audit-search'), text);
  await flush();
}

/** Every text under a node, in render order. */
function wordsUnder(testID: string): string[] {
  const out: string[] = [];
  const walk = (node: ReactTestInstance | string): void => {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    for (const child of node.children) walk(child);
  };
  walk(screen.getByTestId(testID));
  return out;
}

/**
 * Sign-in attempts the Core holds before the device connects: a typed username of a known operator
 * (AUTH_FAILED with its `actorId`), an unknown username (AUTH_FAILED, no actor), and a lockout on
 * Andi's username (the attempt at the limit, then AUTH_LOCKED naming Andi); the lock then expires.
 */
function failedSignIns(engine: TestSim): void {
  engine.sim.actions.signIn(BUDI.username, WRONG);
  engine.sim.actions.signIn('no.such.user', WRONG);
  for (let attempt = 1; attempt < AUTH_MAX_FAILURES; attempt += 1) engine.sim.actions.signIn(ANDI.username, WRONG);
  engine.sim.actions.signIn(ANDI.username, WRONG);
  engine.advance(61_000, 1_000);
}

const rowsOf = (rows: readonly AuditRow[], type: AuditRow['type']) => rows.filter((row) => row.type === type);

describe('LIVE: the rows are the Core\'s', () => {
  it('the list, the chain head and the total are the replica\'s (newest first), and no REST read is made for them', async () => {
    const b = await openAudit();
    const audit = b.state().audit;
    expect(audit.rows.map((row) => row.id)).toEqual(b.engine.sim.store.getState().audit.rows.map((row) => row.id));
    const shown = screen.queryAllByTestId(/^audit-row-\d+$/).map((node) => Number(String(node.props.testID).replace('audit-row-', '')));
    expect(shown[0]).toBe(audit.rows.at(-1)!.seq);
    expect(screen.getByTestId('audit-count')).toHaveTextContent(`${audit.rows.length} of ${audit.rows.length} entries`);
    expect(screen.getByTestId('audit-chain-total')).toHaveTextContent(`${audit.total} entries`);
    expect(screen.getByTestId('audit-chain-head')).toHaveTextContent(audit.head.slice(0, 8));
    expect(screen.getByTestId('audit-chain-chip-ok')).toBeTruthy();
    // Only the sign-in's own operations went to the Core: the rows came with the socket's snapshot.
    const sent = [...new Set(b.fake.log.operationIds())];
    expect(sent.filter((id) => !['getAuthSession', 'getDeviceRegistration', 'getSignInStatus', 'signIn', 'touchSession'].includes(id))).toEqual([]);
  });

  it('a row the Core writes while the view is open enters at the top with the fresh highlight', async () => {
    const b = await openAudit();
    await b.onEngine((engine) => engine.sim.actions.deviceCommand('MIC-01', 'TEST_SIGNAL'));
    const newest = b.state().audit.rows.at(-1)!;
    expect(newest.type).toBe('DEVICE_COMMAND');
    expect(screen.getByTestId(`audit-row-fresh-${newest.id}`)).toBeTruthy();
    expect(screen.getByTestId(`audit-row-event-${newest.seq}`)).toHaveTextContent('Device command sent');
  });
});

describe('LIVE: a failed or locked sign-in names the username typed (CPS1-12 (a))', () => {
  it('row, search and detail say "Username typed: <name>"; an unknown username stays "Unverified user"; a real sign-in names the operator', async () => {
    const b = await openAudit({ window: 'tabletLandscape', beforeSignIn: failedSignIns });
    const rows = b.state().audit.rows;
    const typedBudi = rowsOf(rows, 'AUTH_FAILED').find((row) => row.actorId === BUDI.id)!;
    const unknown = rowsOf(rows, 'AUTH_FAILED').find((row) => row.actorId === null)!;
    const locked = rowsOf(rows, 'AUTH_LOCKED').find((row) => row.actorId === ANDI.id)!;
    const signIn = rowsOf(rows, 'AUTH_SUCCESS').at(-1)!;
    expect([typedBudi, unknown, locked, signIn].every(Boolean)).toBe(true);

    await search('username typed', b.flush);
    const seqs = screen.queryAllByTestId(/^audit-row-\d+$/).map((node) => Number(String(node.props.testID).replace('audit-row-', '')));
    expect(seqs).toContain(typedBudi.seq);
    expect(seqs).toContain(locked.seq);
    expect(seqs).not.toContain(unknown.seq);
    expect(seqs).not.toContain(signIn.seq);
    expect(screen.getByTestId(`audit-row-actor-${typedBudi.seq}`)).toHaveTextContent(`Username typed: ${BUDI.displayName}`);
    expect(screen.getByTestId(`audit-row-actor-${locked.seq}`)).toHaveTextContent(`Username typed: ${ANDI.displayName}`);
    // Every failed or locked attempt of a known username reads so; none reads as the operator acting.
    for (const row of [...rowsOf(rows, 'AUTH_FAILED'), ...rowsOf(rows, 'AUTH_LOCKED')].filter((entry) => entry.actorId !== null)) {
      expect(screen.getByTestId(`audit-row-actor-${row.seq}`).props.children).toMatch(/^Username typed: /);
    }

    fireEvent.press(screen.getByTestId(`audit-row-${typedBudi.seq}`));
    await b.flush();
    // The detail's key-value item holds its label ("Actor") and its value.
    expect(within(screen.getByTestId('audit-detail-pane')).getByTestId('audit-detail-actor')).toHaveTextContent(`ActorUsername typed: ${BUDI.displayName}`);

    await search('', b.flush);
    await search('sign-in failed', b.flush);
    expect(screen.getByTestId(`audit-row-actor-${unknown.seq}`)).toHaveTextContent('Unverified user');
    await search('sign-in succeeded', b.flush);
    expect(screen.getByTestId(`audit-row-actor-${signIn.seq}`)).toHaveTextContent(BUDI.displayName);
    expect(screen.getByTestId(`audit-row-actor-${signIn.seq}`).props.children).not.toMatch(/typed/);
  });
});

describe('LIVE: nothing on the screen claims a simulation (rule 8; F63-4)', () => {
  it('a Core row whose own message says "(simulated)" is labelled by its code; no text of the screen, its detail or its verdict says "simulat"', async () => {
    const b = await openAudit({ window: 'tabletLandscape', setup: (engine) => engine.sim.actions.deviceCommand('MIC-01', 'TEST_SIGNAL') });
    const command = rowsOf(b.state().audit.rows, 'DEVICE_COMMAND').at(-1)!;
    // The control: the Core's own message says so (packages/shared/src/sim/maintenance.ts:220-224).
    expect(command.message).toMatch(SIMULATION_WORDING);
    expect(screen.getByTestId(`audit-row-event-${command.seq}`)).toHaveTextContent('Device command sent');

    fireEvent.press(screen.getByTestId(`audit-row-${command.seq}`));
    await b.flush();
    fireEvent.press(screen.getByTestId('audit-verify'));
    await b.nextFrame();
    await b.flush();
    expect(screen.getByTestId('audit-verify-PASS')).toBeTruthy();
    expect(within(screen.getByTestId('audit-detail-pane')).getByTestId('audit-detail-json').props.children).not.toMatch(SIMULATION_WORDING);
    expect(wordsUnder('screen-audit').filter((word) => SIMULATION_WORDING.test(word))).toEqual([]);
  });
});

describe('SIMULATED: as before', () => {
  it('a failed sign-in still names the operator (unchanged), Verify adds no stored line, no link notice, the button is never marked busy', async () => {
    const h = renderAuditApp({ window: 'tabletLandscape', before: (test) => void test.sim.actions.signIn(BUDI.username, WRONG) });
    await flushSimulated();
    const typed = rowsOf(h.sim.store.getState().audit.rows, 'AUTH_FAILED').find((row) => row.actorId === BUDI.id)!;
    expect(typed).toBeDefined();
    expect(screen.getByTestId(`audit-row-actor-${typed.seq}`)).toHaveTextContent(BUDI.displayName);
    expect(screen.getByTestId(`audit-row-actor-${typed.seq}`).props.children).not.toMatch(/typed/);

    fireEvent.press(screen.getByTestId('audit-verify'));
    expect(screen.getByTestId('audit-verify')).toHaveTextContent('Verifying…');
    // DELIBERATE PIN CHANGE (wave H closing pass Z2, G70-04): an idle control now STATES `busy: false` (`busyState`); it is never marked busy.
    expect(screen.getByTestId('audit-verify').props.accessibilityState?.busy).toBe(false);
    await flushSimulated();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushSimulated();
    expect(screen.getByTestId('audit-verify-PASS')).toBeTruthy();
    expect(screen.getByTestId('audit-verify').props.accessibilityState?.busy).toBe(false);
    expect(screen.queryByTestId('audit-live-chain')).toBeNull();
    expect(screen.queryByTestId('audit-link-offline')).toBeNull();
  });
});
