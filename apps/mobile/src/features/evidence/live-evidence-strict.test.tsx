// Backend task, plan row W74: under React's StrictMode (a development build) every Core request that
// the Evidence folder starts without a press is sent ONCE (decision D158, finding F69-1 of the web
// Evidence row: a command started from a mount effect runs twice there).
//
// The three requests that start without a press: the kebab "Verify" (operation 41 when the
// integrity tab mounts), the export wizard's probe for a denied role (operation 42 after the
// Authorize wait) and the media reference of the detail (operation 40 when the detail mounts). Each
// one waits a microtask or a store-clock tick after its effect and checks that the effect was not
// disposed in between, so StrictMode's mount → unmount → mount sends one request.
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { EXPORT_AUTH_MS } from './export-sheet';
import { VERIFY_ASK_MS } from './integrity-tab';
import { pressMenuItem } from './testing/kit-helpers';
import { renderLiveEvidence, resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { SCRAMBLE_MS } from './use-scramble';

jest.setTimeout(30_000);

let bed: LiveEvidenceBed | null = null;

beforeEach(async () => {
  await resetLiveEvidenceBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

describe('StrictMode: one request per effect-started call', () => {
  it('the list kebab "Verify" sends operation 41 once; the detail reads operation 40 once', async () => {
    const b = await renderLiveEvidence({ window: 'tabletLandscape', strict: true });
    bed = b;
    const id = b.idOf('0001');
    pressMenuItem(`evidence-row-menu-${id}`, `evidence-row-verify-${id}`);
    await b.flush();
    await b.elapse(VERIFY_ASK_MS + SCRAMBLE_MS + 300);
    const pane = within(screen.getByTestId('pane-detail'));
    expect(pane.getByTestId('evidence-verdict-PASS')).toBeTruthy();
    expect(b.requests('verifyEvidence')).toHaveLength(1);
    expect(b.requests('getEvidence').filter((call) => call.params.id === id)).toHaveLength(1);
  });

  it('the export wizard\'s probe for a denied role is sent once', async () => {
    const b = await renderLiveEvidence({ role: 'investigator', strict: true });
    bed = b;
    const id = b.idOf('0001');
    await b.navigate(`/evidence/${id}`);
    fireEvent.press(screen.getByTestId('evidence-action-export'));
    await b.flush();
    await b.elapse(EXPORT_AUTH_MS + 400);
    expect(screen.getByTestId('evidence-export-denied')).toBeTruthy();
    expect(b.requests('exportEvidence')).toHaveLength(1);
    expect(b.engine.sim.store.getState().audit.rows.filter((row) => row.type === 'EXPORT_DENIED' && row.evidenceId === id)).toHaveLength(1);
  });
});
