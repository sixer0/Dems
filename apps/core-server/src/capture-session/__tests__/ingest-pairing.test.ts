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

  it('a report for another attempt (C35 (b)): a RELAY report that names an earlier or a later attempt than the one in force is a fault and completes nothing; a worker-side report stamped with another attempt is dropped (the stamp is the caller\'s, not a claim)', () => {
    const of = rig();
    of.pairing.relayReported('CAM-01', 1);
    of.pairing.begin(2);
    // The half pair of attempt 1 is gone with its timer: nothing fires for it.
    expect(of.timers()).toBe(0);
    of.pairing.workerConnected('CAM-01', 1);
    of.pairing.workerRefused('CAM-01', 1);
    of.advance(60_000);
    expect([of.pairing.open(), of.faults]).toEqual([[], []]);
    // A relay report of attempt 1 does not complete the worker's connect report of attempt 2: it is the fault.
    of.pairing.workerConnected('CAM-01', 2);
    of.pairing.relayReported('CAM-01', 1);
    expect([of.said(), of.pairing.open(), of.timers()]).toEqual([['CAM-01@1 ATTEMPT_MISMATCH'], [], 0]);

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
