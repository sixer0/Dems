// SA-3, the pairing of the relay's report with the worker's connect report (task 4 row 48; design
// addendum 5.3; RC-3 / S13-06, AD-01 (4), BR-08). The unit is pure: the timer here is a list that
// the case advances by hand, so nothing waits in real time. EVERY RULE HAS ITS CONTROL: the same
// reports inside the bound open the camera, outside it they are a fault.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INGEST_PAIRING_BOUND_MS, IngestPairingFault, createIngestPairing, type IngestPairingFailure } from '../ingest-pairing';

function rig(boundMs?: number) {
  let now = 0;
  const armed: Array<{ at: number; run: () => void; live: boolean }> = [];
  const opened: string[] = [];
  const faults: IngestPairingFailure[] = [];
  const pairing = createIngestPairing({
    cameras: ['CAM-01', 'CAM-02'],
    ...(boundMs === undefined ? {} : { boundMs }),
    after(delayMs, callback) {
      const entry = { at: now + delayMs, run: callback, live: true };
      armed.push(entry);
      return () => void (entry.live = false);
    },
    opened: (deviceId, attempt) => void opened.push(`${deviceId}@${attempt}`),
    fault: (failure) => void faults.push(failure),
  });
  pairing.begin(1);
  return {
    pairing,
    opened,
    faults,
    said: () => faults.map((failure) => `${failure.deviceId}@${failure.attempt} ${failure.reason}`),
    advance(ms: number) {
      now += ms;
      for (const entry of armed) {
        if (!entry.live || entry.at > now) continue;
        entry.live = false;
        entry.run();
      }
    },
    timers: () => armed.filter((entry) => entry.live).length,
  };
}

describe('row 48, SA-3: a camera counts as open only when both reports of its attempt arrived within the bound', () => {
  it('the bound is 5,000 ms (addendum 5.3)', () => {
    expect(INGEST_PAIRING_BOUND_MS).toBe(5_000);
  });

  it('both arrive, in either order, inside the bound: the camera is open, once, and no timer is left; one report alone never opens it', () => {
    const relayFirst = rig();
    relayFirst.pairing.relayReported('CAM-01', 1);
    expect([relayFirst.pairing.open(), relayFirst.opened]).toEqual([[], []]);
    relayFirst.advance(INGEST_PAIRING_BOUND_MS - 1);
    relayFirst.pairing.workerConnected('CAM-01', 1);
    expect([relayFirst.pairing.open(), relayFirst.opened, relayFirst.timers(), relayFirst.faults]).toEqual([['CAM-01'], ['CAM-01@1'], 0, []]);

    const workerFirst = rig();
    workerFirst.pairing.workerConnected('CAM-02', 1);
    expect([workerFirst.pairing.open(), workerFirst.opened]).toEqual([[], []]);
    workerFirst.advance(INGEST_PAIRING_BOUND_MS - 1);
    workerFirst.pairing.relayReported('CAM-02', 1);
    expect([workerFirst.pairing.open(), workerFirst.opened, workerFirst.timers(), workerFirst.faults]).toEqual([['CAM-02'], ['CAM-02@1'], 0, []]);
    // Long after: an open camera stays open and nothing fires.
    workerFirst.advance(60_000);
    expect([workerFirst.pairing.open(), workerFirst.faults]).toEqual([['CAM-02'], []]);
  });

  it('the two cameras are paired apart: the report of one never completes the other; open() answers in the order of the plan', () => {
    const of = rig();
    of.pairing.relayReported('CAM-02', 1);
    of.pairing.workerConnected('CAM-01', 1);
    expect(of.pairing.open()).toEqual([]);
    of.pairing.workerConnected('CAM-02', 1);
    of.pairing.relayReported('CAM-01', 1);
    expect([of.pairing.open(), of.opened, of.faults]).toEqual([['CAM-01', 'CAM-02'], ['CAM-02@1', 'CAM-01@1'], []]);
  });

  it('only one arrives within the bound: the relay without the worker, and the worker without the relay (a pusher that is not ours), are each ONE fault at the bound, not before', () => {
    const relayOnly = rig();
    relayOnly.pairing.relayReported('CAM-01', 1);
    relayOnly.advance(INGEST_PAIRING_BOUND_MS - 1);
    expect(relayOnly.faults).toEqual([]);
    relayOnly.advance(1);
    expect(relayOnly.said()).toEqual(['CAM-01@1 WORKER_REPORT_MISSING']);

    const workerOnly = rig();
    workerOnly.pairing.workerConnected('CAM-02', 1);
    workerOnly.advance(INGEST_PAIRING_BOUND_MS);
    expect(workerOnly.said()).toEqual(['CAM-02@1 RELAY_REPORT_MISSING']);
    // The other report one tick late changes nothing: the camera is not open and the fault is said once.
    workerOnly.pairing.relayReported('CAM-02', 1);
    workerOnly.advance(60_000);
    expect([workerOnly.pairing.open(), workerOnly.faults.length, workerOnly.pairing.failure()?.reason]).toEqual([[], 1, IngestPairingFault.RELAY_REPORT_MISSING]);
  });

  it('a duplicate: a second connect report of the worker on a camera is a fault before the pair is whole AND after the camera was open (AD-01 (4)); a second relay report as well', () => {
    const before = rig();
    before.pairing.workerConnected('CAM-01', 1);
    before.pairing.workerConnected('CAM-01', 1);
    expect([before.said(), before.pairing.open(), before.timers()]).toEqual([['CAM-01@1 WORKER_CONNECTED_TWICE'], [], 0]);

    const after = rig();
    after.pairing.relayReported('CAM-01', 1);
    after.pairing.workerConnected('CAM-01', 1);
    expect(after.pairing.open()).toEqual(['CAM-01']);
    after.pairing.workerConnected('CAM-01', 1);
    // The camera that was open is not open any more: the capture has a fault.
    expect([after.said(), after.pairing.open()]).toEqual([['CAM-01@1 WORKER_CONNECTED_TWICE'], []]);

    const relays = rig();
    relays.pairing.relayReported('CAM-02', 1);
    relays.pairing.relayReported('CAM-02', 1);
    expect(relays.said()).toEqual(['CAM-02@1 RELAY_REPORTED_TWICE']);
  });

  it('ruling C35 (a), the degraded start of D72(k): a camera that is simply ABSENT is no fault - nothing from either side, or the worker gives its listener up and no relay reported; the OTHER camera pairs and stays open', () => {
    const of = rig();
    of.pairing.relayReported('CAM-02', 1);
    of.pairing.workerConnected('CAM-02', 1);
    // CAM-01: nobody says anything, then the worker says it gave the listener up (its window ended).
    of.advance(INGEST_PAIRING_BOUND_MS * 6);
    of.pairing.workerRefused('CAM-01', 1);
    of.advance(INGEST_PAIRING_BOUND_MS * 6);
    expect([of.faults, of.pairing.open(), of.opened, of.timers()]).toEqual([[], ['CAM-02'], ['CAM-02@1'], 0]);
    // No camera at all: still no fault of the pairing (the worker ends such a session itself, as before).
    const none = rig();
    none.pairing.workerRefused('CAM-01', 1);
    none.pairing.workerRefused('CAM-02', 1);
    none.advance(60_000);
    expect([none.faults, none.pairing.open()]).toEqual([[], []]);
    // CONTROL of "absent": the same refusal AFTER a relay report of that camera is the contradiction below.
    // And a refusal makes no pair: a relay report that comes later is alone, and a fault at ITS bound.
    of.pairing.relayReported('CAM-01', 1);
    of.advance(INGEST_PAIRING_BOUND_MS);
    expect(of.said()).toEqual(['CAM-01@1 WORKER_REPORT_MISSING']);
  });

  it('ruling C35 (b), one camera UNPAIRED and the other paired: the fault is said, and no camera counts as open any more', () => {
    const of = rig();
    of.pairing.relayReported('CAM-02', 1);
    of.pairing.workerConnected('CAM-02', 1);
    of.pairing.workerConnected('CAM-01', 1);
    of.advance(INGEST_PAIRING_BOUND_MS);
    expect([of.said(), of.pairing.open()]).toEqual([['CAM-01@1 RELAY_REPORT_MISSING'], []]);
  });

  it('BR-08: the worker says it refused or gave up the listener of a camera WHOSE RELAY REPORTED - the two sides contradict each other: a fault at once, also for a camera that was open', () => {
    const withRelay = rig();
    withRelay.pairing.relayReported('CAM-02', 1);
    withRelay.pairing.workerRefused('CAM-02', 1);
    expect([withRelay.said(), withRelay.timers()]).toEqual([['CAM-02@1 WORKER_REFUSED'], 0]);
    const wasOpen = rig();
    wasOpen.pairing.relayReported('CAM-01', 1);
    wasOpen.pairing.workerConnected('CAM-01', 1);
    wasOpen.pairing.workerRefused('CAM-01', 1);
    expect([wasOpen.said(), wasOpen.pairing.open()]).toEqual([['CAM-01@1 WORKER_REFUSED'], []]);
  });

  // Since task 4 row 188 (ruling C37) the EARLIER attempt is no fault any more: the Core itself superseded it. The rule of
  // the later attempt, and that nothing of another attempt completes a pair, is what this case still holds; the block of row 188 below holds the rest.
  it('a report for another attempt (C35 (b)): a RELAY report that names a LATER attempt than the one in force is a fault; one of an earlier attempt completes nothing (C37: dropped); a worker-side report stamped with another attempt is dropped (the stamp is the caller\'s, not a claim)', () => {
    const of = rig();
    of.pairing.relayReported('CAM-01', 1);
    of.pairing.begin(2);
    // The half pair of attempt 1 is gone with its timer: nothing fires for it.
    expect(of.timers()).toBe(0);
    of.pairing.workerConnected('CAM-01', 1);
    of.pairing.workerRefused('CAM-01', 1);
    of.advance(60_000);
    expect([of.pairing.open(), of.faults]).toEqual([[], []]);
    // A relay report of attempt 1 does not complete the worker's connect report of attempt 2: nothing opens, and the half pair of attempt 2 keeps its timer.
    of.pairing.workerConnected('CAM-01', 2);
    of.pairing.relayReported('CAM-01', 1);
    expect([of.said(), of.pairing.open(), of.timers()]).toEqual([[], [], 1]);

    const later = rig();
    later.pairing.relayReported('CAM-02', 2);
    expect(later.said()).toEqual(['CAM-02@2 ATTEMPT_MISMATCH']);
  });

  it('CONTROL of the attempt rule: the same two reports, both of the attempt in force, open the camera; a camera open in attempt 1 is not open in attempt 2 until it is paired again', () => {
    const of = rig();
    of.pairing.relayReported('CAM-01', 1);
    of.pairing.workerConnected('CAM-01', 1);
    expect(of.pairing.open()).toEqual(['CAM-01']);
    of.pairing.begin(2);
    expect(of.pairing.open()).toEqual([]);
    of.pairing.workerConnected('CAM-01', 2);
    of.pairing.relayReported('CAM-01', 2);
    expect([of.pairing.open(), of.opened, of.faults]).toEqual([['CAM-01'], ['CAM-01@1', 'CAM-01@2'], []]);
  });

  it('one fault only, and nothing after the end: a second fault is not said; after end() no timer fires and no report counts; a device that is no camera of the plan is dropped', () => {
    const of = rig();
    of.pairing.relayReported('CAM-01', 1);
    of.pairing.workerConnected('CAM-02', 1);
    of.pairing.workerRefused('CAM-01', 1);
    of.advance(60_000);
    of.pairing.workerConnected('CAM-02', 1);
    expect(of.said()).toEqual(['CAM-01@1 WORKER_REFUSED']);

    const ended = rig();
    ended.pairing.relayReported('CAM-01', 1);
    ended.pairing.end();
    ended.advance(60_000);
    ended.pairing.workerConnected('CAM-01', 1);
    expect([ended.faults, ended.opened, ended.timers()]).toEqual([[], [], 0]);

    const foreign = rig();
    foreign.pairing.workerConnected('MIC-01', 1);
    foreign.pairing.relayReported('CAM-09', 1);
    foreign.advance(60_000);
    expect([foreign.faults, foreign.opened, foreign.timers()]).toEqual([[], [], 0]);
  });

  it('the unit is pure: it imports nothing, reads no clock and no timer of the runtime, and names no address', () => {
    const text = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../ingest-pairing.ts'), 'utf8');
    const code = text.split('\n').filter((line) => !/^\s*(\/\*\*|\*|\/\/)/.test(line));
    expect(code.filter((line) => /^import\b|\brequire\(|\bimport\(|setTimeout|setInterval|Date\.now|performance\.|console\.|ingestUrl|rtsp/.test(line))).toEqual([]);
  });
});

// Task 4 row 188 (controller ruling C37): the attempts of a session are the supervisor's count of its workers, so every
// attempt below the one in force was issued by the Core itself and then superseded. What a relay of such an attempt still
// says is dropped and counted; `ATTEMPT_MISMATCH` stays for an attempt the Core never issued.
describe('row 188, C37: a relay report for an attempt the Core itself superseded is dropped and counted - never a fault', () => {
  /** The rig of above, with the listener of dropped reports. */
  function withListener() {
    const dropped: string[] = [];
    const opened: string[] = [];
    const faults: IngestPairingFailure[] = [];
    let now = 0;
    const armed: Array<{ at: number; run: () => void; live: boolean }> = [];
    const pairing = createIngestPairing({
      cameras: ['CAM-01', 'CAM-02'],
      after(delayMs, callback) {
        const entry = { at: now + delayMs, run: callback, live: true };
        armed.push(entry);
        return () => void (entry.live = false);
      },
      opened: (deviceId, attempt) => void opened.push(`${deviceId}@${attempt}`),
      fault: (failure) => void faults.push(failure),
      superseded: (report) => void dropped.push(`${report.deviceId}@${report.attempt} inForce=${report.inForce} count=${report.count}`),
    });
    const advance = (ms: number): void => {
      now += ms;
      for (const entry of armed) {
        if (!entry.live || entry.at > now) continue;
        entry.live = false;
        entry.run();
      }
    };
    return { pairing, dropped, opened, faults, advance, said: () => faults.map((failure) => `${failure.deviceId}@${failure.attempt} ${failure.reason}`) };
  }

  it('the worker of attempt 1 was replaced: the report of its relay arrives during attempt 2 - 0 faults, 1 counted report, and THE CURRENT ATTEMPT STILL PAIRS', () => {
    const of = withListener();
    of.pairing.begin(1);
    of.pairing.begin(2);
    of.pairing.relayReported('CAM-01', 1);
    expect([of.faults, of.dropped, of.pairing.supersededReports(), of.pairing.failure()]).toEqual([[], ['CAM-01@1 inForce=2 count=1'], 1, null]);
    // The pairing of attempt 2 is untouched: both cameras pair, in either order, around a second stale report.
    of.pairing.relayReported('CAM-01', 2);
    of.pairing.relayReported('CAM-02', 1);
    of.pairing.workerConnected('CAM-01', 2);
    of.pairing.workerConnected('CAM-02', 2);
    of.pairing.relayReported('CAM-02', 2);
    expect([of.pairing.open(), of.opened, of.faults]).toEqual([['CAM-01', 'CAM-02'], ['CAM-01@2', 'CAM-02@2'], []]);
    expect(of.dropped).toEqual(['CAM-01@1 inForce=2 count=1', 'CAM-02@1 inForce=2 count=2']);
    of.advance(60_000);
    expect([of.faults, of.pairing.supersededReports()]).toEqual([[], 2]);
  });

  it('a stale report is NOT the second report of the relay of the attempt in force, and it arms no timer: nothing fires for it at the bound', () => {
    const of = withListener();
    of.pairing.begin(1);
    of.pairing.begin(2);
    of.pairing.relayReported('CAM-01', 2);
    of.pairing.relayReported('CAM-01', 1);
    of.pairing.relayReported('CAM-01', 1);
    of.pairing.workerConnected('CAM-01', 2);
    of.advance(60_000);
    expect([of.said(), of.pairing.open(), of.pairing.supersededReports()]).toEqual([[], ['CAM-01'], 2]);
  });

  it('every attempt below the one in force was issued by the Core - also one whose worker never came to listen (the pairing was never told to begin it)', () => {
    const of = withListener();
    // The first worker never listened: the session begins the pairing with the attempt of the second (`RESTARTING` says attempt + 1).
    of.pairing.begin(3);
    of.pairing.relayReported('CAM-01', 1);
    of.pairing.relayReported('CAM-02', 2);
    expect([of.said(), of.dropped]).toEqual([[], ['CAM-01@1 inForce=3 count=1', 'CAM-02@2 inForce=3 count=2']]);
  });

  it.each([
    ['a later attempt than the one in force', 3],
    ['the attempt after that', 4],
    ['attempt 0 (a relay that was told none)', 0],
    ['a negative number', -1],
    ['a number that is no whole number', 1.5],
    ['a number that is no number', Number.NaN],
  ])('NEVER ISSUED stays the fault: %s is ATTEMPT_MISMATCH, said once, and it is not counted as superseded', (_name, attempt) => {
    const of = withListener();
    of.pairing.begin(1);
    of.pairing.begin(2);
    of.pairing.relayReported('CAM-02', attempt);
    expect(of.faults).toEqual([{ deviceId: 'CAM-02', attempt, reason: IngestPairingFault.ATTEMPT_MISMATCH }]);
    expect([of.dropped, of.pairing.supersededReports()]).toEqual([[], 0]);
    // The fault ended the pairing: what a stale relay says afterwards is neither counted nor told.
    of.pairing.relayReported('CAM-01', 1);
    expect([of.dropped, of.faults.length]).toEqual([[], 1]);
  });

  it('before any attempt is superseded nothing is: with attempt 1 in force a report of attempt 1 pairs and no other number is "earlier"', () => {
    const of = withListener();
    of.pairing.begin(1);
    of.pairing.relayReported('CAM-01', 1);
    of.pairing.workerConnected('CAM-01', 1);
    expect([of.pairing.open(), of.dropped, of.pairing.supersededReports()]).toEqual([['CAM-01'], [], 0]);
  });

  it('a camera that is no camera of the plan is dropped without a count; a listener that throws changes nothing; without a listener the count is still kept', () => {
    const of = withListener();
    of.pairing.begin(1);
    of.pairing.begin(2);
    of.pairing.relayReported('CAM-09', 1);
    expect([of.dropped, of.pairing.supersededReports()]).toEqual([[], 0]);

    const faults: IngestPairingFailure[] = [];
    const throwing = createIngestPairing({ cameras: ['CAM-01'], after: () => () => undefined, opened: () => undefined, fault: (failure) => void faults.push(failure), superseded: () => { throw new Error('a listener that fails'); } });
    throwing.begin(2);
    expect(() => throwing.relayReported('CAM-01', 1)).not.toThrow();
    expect([faults, throwing.supersededReports()]).toEqual([[], 1]);

    const silent = rig();
    silent.pairing.begin(2);
    silent.pairing.relayReported('CAM-01', 1);
    expect([silent.faults, silent.pairing.supersededReports()]).toEqual([[], 1]);
  });
});
