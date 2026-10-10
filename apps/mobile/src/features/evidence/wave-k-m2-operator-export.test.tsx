// Fix wave K, driver M2 - items 1 and 2 of the task.
//
// | Finding | Rule | Where |
// |---------|------|-------|
// | G81b-02 | An answer that depends on the signed-in operator is cached FOR that operator: after a change of operator the next one's first view of the item the previous one had open asks operation 40 again and asks operations 84 / 86 only if the Core says THIS caller may read | "an operator change" |
// | G81b-02 | Nothing of an operator outlives the sign-in: every operator-scoped answer leaves the cache at sign-out | "sign-out" |
// | G81b-07 | A refused read is worded by the refusal's own reason: a case-scope refusal never says "Your role cannot read this transcript." | "a case-scope refusal" |
// | G81b-09 | The reason of a revision is shown in the revision list | "the revision's reason" |
// | G89b-09 (D223 (1)) | `access.export: false`: the Export control is disabled and names the required role; nothing is sent and no `EXPORT_DENIED` row is written by a press | "the export control" |
// | G94b-05 | The finished exports follow the job's completion | "after an export" |
// | G94b-06 | "The export is stored on the Core" only for a job that states its archive | "after an export" |
// | G94b-12 | The pre-selected destination is the one the Core states | "the default destination" |
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as ExpoVideo from 'expo-video';
import { router } from 'expo-router';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { clearOperatorQueries, isOperatorScoped, operatorScope } from '@/lib/operator-query-scope';
import { EXPORT_DESTINATIONS, initialExportDestination } from './evidence-model';
import { answeredArchiveOnCoreOf, readExportJob } from './export-job-model';
import { EXPORT_AUTH_MS, EXPORT_BUILD_MS } from './export-sheet';
import { VERIFY_ASK_MS } from './integrity-tab';
import { readDetailFacts } from './item-facts';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { RECORDED_VERIFY_V2 } from './testing/verify-v2-recorded';
import { H, bedWith, contractDetail, openItem, realItem, textUnder } from './testing/wave-h-c2-kit';
import { transcriptQueryKey, transcriptRevisionsQueryKey } from './transcript';
import { deniedReadKindOf, readTranscriptRevision } from './transcript-model';
import { SCRAMBLE_MS } from './use-scramble';
import { evidenceMediaRefKey } from './use-evidence-media-ref';
import { exportJobQueryKey } from './export-job';

jest.setTimeout(30_000);

let bed: LiveEvidenceBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveEvidenceBed();
  jest.spyOn(ExpoVideo, 'useVideoPlayer').mockImplementation((() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useRef } = require('react') as typeof import('react');
    const held = useRef<Record<string, unknown> | null>(null);
    held.current ??= { play: jest.fn(), pause: jest.fn(), replaceAsync: jest.fn(async () => undefined), addListener: () => ({ remove: () => undefined }), currentTime: 0 };
    return held.current;
  }) as unknown as typeof ExpoVideo.useVideoPlayer);
});
afterEach(() => {
  bed?.stop();
  bed = null;
  jest.restoreAllMocks();
  expect(getMissingKeys()).toEqual([]);
});

const READY = { state: 'READY', sha256: H('a'), machineTranscriptHash: H('b'), labelsStatus: 'UNAVAILABLE', revision: 0 };
const streamable = (b: LiveEvidenceBed) => {
  b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
};
/** Another operator is signed in on this device (the replicated `auth` slice names them), as after a sign-out and a sign-in. */
function operatorBecomes(b: LiveEvidenceBed, operatorId: string): void {
  act(() => {
    const state = b.mobile.sim.store.getState();
    b.mobile.sim.store.setState({ auth: { ...state.auth, operatorId } } as Partial<typeof state>);
  });
}
const otherOperator = (b: LiveEvidenceBed): string => {
  const state = b.mobile.sim.store.getState();
  const current = state.auth.status === 'SIGNED_IN' ? state.auth.operatorId : null;
  const other = state.operators.find((operator) => operator.id !== current);
  if (other === undefined) throw new Error('the bed has one operator only');
  return other.id;
};

describe('the operator in the key (G81b-02)', () => {
  it('every per-operator key ends with the operator, and two operators never share one', () => {
    for (const key of [evidenceMediaRefKey('EV-1', 'OPR-001'), transcriptQueryKey('EV-1', null, 'OPR-001'), transcriptRevisionsQueryKey('EV-1', null, 'OPR-001'), exportJobQueryKey('EXPJ-000001', 'OPR-001')]) {
      expect(key.at(-1)).toBe(operatorScope('OPR-001'));
      expect(isOperatorScoped(key)).toBe(true);
    }
    expect(evidenceMediaRefKey('EV-1', 'OPR-001')).not.toEqual(evidenceMediaRefKey('EV-1', 'OPR-003'));
    expect(evidenceMediaRefKey('EV-1', null).at(-1)).toBe(operatorScope(null));
    // CONTROL: a key that is not an operator's.
    expect(isOperatorScoped(['health', 'core-server'])).toBe(false);
  });

  it('an operator change: the next operator\'s first view of the item the previous one had open asks operation 40 again and NOT operations 84 / 86 (the Core refuses this caller)', async () => {
    const { b, id } = await bedWith('0001', realItem({ transcriptSha256: H('b'), transcript: READY }));
    bed = b;
    streamable(b);
    // The first operator may read: the page view asks operation 84 once.
    b.detailExtras = () => ({ access: { play: true, readTranscript: true, export: true } });
    await openItem(b, id);
    await b.flush();
    expect(b.requests('getTranscript')).toHaveLength(1);
    expect(b.requests('getEvidence').filter((call) => call.params.id === id)).toHaveLength(1);

    // The screen is left, another operator signs in on this tablet, and the Core refuses THAT caller the transcript.
    act(() => router.back());
    await b.flush();
    b.detailExtras = () => ({ access: { play: true, readTranscript: false, export: false } });
    operatorBecomes(b, otherOperator(b));
    await b.flush();
    await openItem(b, id);
    await b.flush();

    // Operation 40 was asked again for the new operator, and its answer - not the previous operator's - decided.
    expect(b.requests('getEvidence').filter((call) => call.params.id === id)).toHaveLength(2);
    expect(b.requests('getTranscript')).toHaveLength(1);
    expect(b.requests('listTranscriptRevisions')).toHaveLength(0);
    expect(screen.getByTestId('evidence-transcript-may-not-read')).toBeTruthy();
    // G81b-07: one sentence, and no role sentence beside it.
    expect(screen.queryByText('Your role cannot read this transcript.')).toBeNull();
    expect(screen.queryByTestId(/^evidence-transcript-failed-/)).toBeNull();
  });

  it('CONTROL: the same operator opening the item again keeps the answer that is theirs (the transcript is asked as before)', async () => {
    const { b, id } = await bedWith('0001', realItem({ transcriptSha256: H('b'), transcript: READY }));
    bed = b;
    streamable(b);
    b.detailExtras = () => ({ access: { play: true, readTranscript: true, export: true } });
    await openItem(b, id);
    await b.flush();
    act(() => router.back());
    await b.flush();
    await openItem(b, id);
    await b.flush();
    expect(b.requests('getTranscript').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId('evidence-transcript-may-not-read')).toBeNull();
  });

  it('sign-out: every operator-scoped answer leaves the cache; an answer that is nobody\'s stays', async () => {
    const { b, id } = await bedWith('0001', realItem());
    bed = b;
    streamable(b);
    await openItem(b, id);
    await b.flush();
    b.queryClient.setQueryData(['health', 'core-server'], { ok: true });
    const scoped = () => b.queryClient.getQueryCache().getAll().filter((query) => isOperatorScoped(query.queryKey));
    expect(scoped().length).toBeGreaterThan(0);
    act(() => router.back());
    await b.flush();
    operatorBecomes(b, otherOperator(b));
    await b.flush();
    expect(scoped()).toHaveLength(0);
    expect(b.queryClient.getQueryData(['health', 'core-server'])).toEqual({ ok: true });
    // The same rule as a function (used by the provider).
    b.queryClient.setQueryData(evidenceMediaRefKey(id, 'OPR-009'), { any: 1 });
    clearOperatorQueries(b.queryClient);
    expect(scoped()).toHaveLength(0);
  });
});

describe('a case-scope refusal (G81b-07)', () => {
  it('the rule: EVIDENCE_CASE_SCOPE is the case; no reason is the role; another reason is neither', () => {
    expect(deniedReadKindOf('EVIDENCE_CASE_SCOPE')).toBe('CASE_SCOPE');
    expect(deniedReadKindOf(null)).toBe('ROLE');
    expect(deniedReadKindOf('SOMETHING_ELSE')).toBe('OTHER');
  });

  /** The Core's `403 NOT_PERMITTED` of a transcript operation (routes.ts `refuseOutsideCase`: `details.reason` names the case scope; the permission guard names no reason). */
  const refusal403 = (reason: string | null) => ({
    status: 403,
    body: {
      error: {
        code: 'NOT_PERMITTED',
        message: 'You are not permitted to do this.',
        details: { operationId: 'getTranscript', permission: 'EVIDENCE_VIEW', role: 'TECHNICIAN', ...(reason === null ? {} : { reason }) },
        requestId: '00000000-0000-4000-8000-000000000000',
      },
    },
  });

  it('operation 84 answers 403 with `details.reason: EVIDENCE_CASE_SCOPE`: the pane names the case and NOT the role', async () => {
    const { b, id } = await bedWith('0001', realItem({ transcriptSha256: H('b'), transcript: READY }));
    bed = b;
    streamable(b);
    b.fake.answer('getTranscript', () => refusal403('EVIDENCE_CASE_SCOPE'));
    await openItem(b, id);
    await b.flush();
    expect(screen.getByTestId('evidence-transcript-denied-CASE_SCOPE')).toHaveTextContent('You are not assigned to the case of this item, so its transcript is not shown.');
    expect(screen.queryByText('Your role cannot read this transcript.')).toBeNull();
  });

  it('CONTROL: a 403 that names no reason is the role\'s', async () => {
    const { b, id } = await bedWith('0001', realItem({ transcriptSha256: H('b'), transcript: READY }));
    bed = b;
    streamable(b);
    b.fake.answer('getTranscript', () => refusal403(null));
    await openItem(b, id);
    await b.flush();
    expect(screen.getByTestId('evidence-transcript-denied-ROLE')).toHaveTextContent('Your role cannot read this transcript.');
  });
});

describe('the revision\'s reason (G81b-09)', () => {
  const revision = { revisionId: 'TRV-000001', number: 1, authorId: 'OPR-002', baseRevision: 0, signedBy: 'CORE-KEY-EVSIGN-01', signature: { value: H('c'), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false }, createdAt: 1, changes: [{ segmentIndex: 0, from: 'a', to: 'b' }] };

  it('the reader keeps the reason the answer states, trimmed; nothing when it states none', () => {
    expect(readTranscriptRevision({ ...revision, reason: '  Street name corrected  ' })?.reason).toBe('Street name corrected');
    expect(readTranscriptRevision(revision)?.reason).toBeNull();
    expect(readTranscriptRevision({ ...revision, reason: 7 })?.reason).toBeNull();
    expect(readTranscriptRevision({ ...revision, reason: '   ' })?.reason).toBeNull();
  });
});

describe('the export control (ruling D223 (1), G89b-09)', () => {
  it('`access.export: false`: the control is disabled and names the required role; a press sends nothing and writes no EXPORT_DENIED row', async () => {
    const { b, id } = await bedWith('0001', realItem(), { role: 'investigator' });
    bed = b;
    streamable(b);
    b.detailExtras = () => ({ access: { play: true, readTranscript: true, export: false } });
    await openItem(b, id);
    const control = screen.getByTestId('evidence-action-export');
    expect(control.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByTestId('evidence-action-export-requires-role')).toHaveTextContent('Export requires the Supervisor role.');
    fireEvent.press(control);
    await b.flush();
    await b.elapse(EXPORT_AUTH_MS + 400);
    expect(screen.queryByTestId('evidence-export-wizard')).toBeNull();
    expect(b.requests('exportEvidence')).toHaveLength(0);
    expect(b.engine.sim.store.getState().audit.rows.filter((row) => row.type === 'EXPORT_DENIED')).toHaveLength(0);
  });

  it('a role without the permission where the Core stated nothing: the wizard states the required role and sends NOTHING by itself', async () => {
    const { b, id } = await bedWith('0001', realItem(), { role: 'investigator' });
    bed = b;
    streamable(b);
    await openItem(b, id);
    expect(screen.queryByTestId('evidence-action-export-requires-role')).toBeNull();
    fireEvent.press(screen.getByTestId('evidence-action-export'));
    await b.flush();
    await b.elapse(EXPORT_AUTH_MS + 400);
    expect(textUnder('evidence-export-requires-role')).toMatch(/Exporting evidence requires the Supervisor role\./);
    expect(textUnder('evidence-export-requires-role')).toMatch(/Nothing has been sent to the Core server\./);
    expect(b.requests('exportEvidence')).toHaveLength(0);
    expect(b.engine.sim.store.getState().audit.rows.filter((row) => row.type === 'EXPORT_DENIED')).toHaveLength(0);
    expect(screen.queryByTestId('evidence-export-next')).toBeNull();
  });

  it('CONTROL: `access.export: true` - the control is enabled and the wizard authorizes without a probe', async () => {
    const { b, id } = await bedWith('0001', realItem());
    bed = b;
    streamable(b);
    b.detailExtras = () => ({ access: { play: true, readTranscript: true, export: true } });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-action-export').props.accessibilityState?.disabled).not.toBe(true);
    expect(screen.queryByTestId('evidence-action-export-requires-role')).toBeNull();
    fireEvent.press(screen.getByTestId('evidence-action-export'));
    await b.flush();
    await b.elapse(EXPORT_AUTH_MS + 400);
    expect(screen.getByTestId('evidence-export-authorized')).toBeTruthy();
    expect(b.requests('exportEvidence')).toHaveLength(0);
  });
});

describe('the default destination (G94b-12; contract_wave_k.md S2 section 2)', () => {
  const real = (key: (typeof EXPORT_DESTINATIONS)[number]) => ({ caseFile: 'Case file transfer', usb: 'Encrypted USB drive', network: 'Export/Transfer network' })[key];

  it('the option whose recorded text equals the Core\'s stated default; the first option when the Core states none; NO option when it states one this app does not offer', () => {
    expect(initialExportDestination('Case file transfer', real)).toBe('caseFile');
    expect(initialExportDestination('Export/Transfer network', real)).toBe('network');
    expect(initialExportDestination(null, real)).toBe(EXPORT_DESTINATIONS[0]);
    expect(EXPORT_DESTINATIONS[0]).toBe('caseFile');
    expect(initialExportDestination('Courier', real)).toBeNull();
  });

  it('operation 40\'s member is read by its name; absent or not a text = not stated', () => {
    expect(readDetailFacts({ exportDestinationDefault: 'Case file transfer' }).exportDestinationDefault).toBe('Case file transfer');
    expect(readDetailFacts({}).exportDestinationDefault).toBeNull();
    expect(readDetailFacts({ exportDestinationDefault: 5 }).exportDestinationDefault).toBeNull();
    // The contract's own example of a product-sealed item, unmodified: whatever it states is what is read.
    const example = contractDetail('productSealed') as unknown as { exportDestinationDefault?: string };
    expect(readDetailFacts(example).exportDestinationDefault).toBe(example.exportDestinationDefault ?? null);
  });
});

describe('after an export (G94b-05, G94b-06)', () => {
  const job = (id: string, more: Record<string, unknown> = {}) => ({ jobId: 'EXPJ-000041', evidenceId: id, kind: 'PACKAGE', status: 'COMPLETE', progressPct: 100, etaMs: 0, manifestHash: 'ab'.repeat(32), signature: 'cd'.repeat(64), derived: false, createdAt: 1, completedAt: 2, ...more });

  it('the job model: a COMPLETE job that states `archive` is on the Core; one that states none is not; the 202\'s `archiveOnCore` is read by name', () => {
    expect(readExportJob(job('EV-1', { archive: { bytes: 10, sha256: H('e') } }))?.archiveOnCore).toBe(true);
    expect(readExportJob(job('EV-1'))?.archiveOnCore).toBe(false);
    expect(readExportJob(job('EV-1', { status: 'RUNNING', archive: { bytes: 10, sha256: H('e') } }))?.archiveOnCore).toBe(false);
    expect(answeredArchiveOnCoreOf({ ok: true, archiveOnCore: false })).toBe(false);
    expect(answeredArchiveOnCoreOf({ ok: true, archiveOnCore: true })).toBe(true);
    expect(answeredArchiveOnCoreOf({ ok: true })).toBeNull();
  });

  /**
   * The screen has been told every answer the query client holds (note 150).
   *
   * The bed's clock is a fake one and its answers arrive in promise jobs, but query-core tells a query's
   * observers on the SYSTEM's `setTimeout(callback, 0)` (`notifyManager`'s default scheduler,
   * `systemSetTimeoutZero` of `@tanstack/query-core` 5.104.0) - a timer no `b.elapse` moves and no
   * `b.flush` runs. So the job's COMPLETE can be in the cache while the sheet still draws "waiting".
   * This waits for that timer by its own rule, not by a length of time: a zero timer set AFTER the
   * notification's runs after it (timers of one delay run in the order they were set). It is repeated
   * until one whole turn changed nothing in the cache and nothing is being read, because a notification
   * can start the next read (the job's end reads operation 40 again, G94b-05).
   */
  async function observersTold(b: LiveEvidenceBed): Promise<void> {
    let events = 0;
    const stop = b.queryClient.getQueryCache().subscribe(() => {
      events += 1;
    });
    try {
      for (let turn = 0; turn < 20; turn += 1) {
        const before = events;
        await act(async () => {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        });
        await b.flush();
        if (events === before && b.queryClient.isFetching() === 0) return;
      }
      throw new Error('the query client did not come to rest in 20 turns');
    } finally {
      stop();
    }
  }

  async function exportThrough(b: LiveEvidenceBed, id: string): Promise<void> {
    fireEvent.press(screen.getByTestId('evidence-action-export'));
    await b.flush();
    await b.elapse(EXPORT_AUTH_MS + 200);
    b.fake.answerOnce('verifyEvidence', { status: 200, body: { ...RECORDED_VERIFY_V2.pass.body, evidenceId: id, at: b.fake.clock.now() } });
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await b.flush();
    await b.elapse(VERIFY_ASK_MS + SCRAMBLE_MS + 300);
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await b.flush();
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await b.flush();
    fireEvent.changeText(screen.getByTestId('evidence-export-reason'), 'Requested by the prosecutor');
    await b.flush();
    fireEvent.press(screen.getByTestId('evidence-export-submit'));
    await b.flush();
    await b.elapse(EXPORT_BUILD_MS + 600);
    await b.flush();
    await observersTold(b);
  }

  it('the job reaches COMPLETE: operation 40 is read again and the finished export is listed - without leaving the item', async () => {
    const { b, id } = await bedWith('0001', realItem());
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    let finished: unknown[] = [];
    b.detailExtras = () => ({ access: { play: true, readTranscript: true, export: true }, exports: finished });
    await openItem(b, id);
    expect(textUnder('evidence-finished-exports')).toMatch(/No finished export of this item\./);
    const before = b.requests('getEvidence').filter((call) => call.params.id === id).length;
    // The Core finishes the job: from now on operation 40 lists it, and operation 87 answers COMPLETE with its archive.
    b.fake.answer('getEvidenceExportJob', (call) => {
      finished = [{ exportId: 'EXP-000041', jobId: 'EXPJ-000041', kind: 'PACKAGE', completedAt: b.fake.clock.now(), exportedBy: 'OPR-002', archiveBytes: 10 }];
      return { status: 200, body: job(id, { jobId: String(call.params.id), archive: { bytes: 10, sha256: H('e') }, createdAt: b.fake.clock.now(), completedAt: b.fake.clock.now() }) };
    });
    await exportThrough(b, id);
    expect(screen.getByTestId('evidence-export-job-COMPLETE')).toBeTruthy();
    expect(screen.getByTestId('evidence-export-job-on-core')).toBeTruthy();
    // The operator closes the sheet (the gate's step): the list under the item is already the new one.
    fireEvent.press(screen.getByTestId('evidence-export-finish'));
    await b.flush();
    await observersTold(b);
    expect(b.requests('getEvidence').filter((call) => call.params.id === id).length).toBeGreaterThan(before);
    expect(textUnder('evidence-finished-exports')).toMatch(/EXP-000041/);
    expect(textUnder('evidence-finished-exports')).not.toMatch(/No finished export of this item\./);
  });

  it('G94b-06: a finished job that states NO archive never reads "The export is stored on the Core"', async () => {
    const { b, id } = await bedWith('0001', realItem());
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    b.fake.answer('getEvidenceExportJob', (call) => ({ status: 200, body: job(id, { jobId: String(call.params.id), createdAt: b.fake.clock.now(), completedAt: b.fake.clock.now() }) }));
    await openItem(b, id);
    await exportThrough(b, id);
    expect(screen.getByTestId('evidence-export-job-COMPLETE')).toBeTruthy();
    expect(screen.queryByTestId('evidence-export-job-on-core')).toBeNull();
    expect(screen.getByTestId('evidence-export-job-no-archive')).toHaveTextContent('The Core server states no archive for this export.');
  });
});
