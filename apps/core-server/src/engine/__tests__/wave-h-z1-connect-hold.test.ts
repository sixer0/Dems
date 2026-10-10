// Wave H closing pass Z1, item 9 (driver B decision 6): the headless simulator of the engine takes the
// connecting time its host asks for (`HeadlessSimOptions.captureConnectMs`), and keeps the default
// without it. A test / development control: no configuration key and no operation sets it.
import { createManualClock } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { createHeadlessSim } from '../headless-sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);

async function started(captureConnectMs?: number) {
  const clock = createManualClock(START);
  const sim = await createHeadlessSim({ seed: 20261001, clock, onError: (report) => { throw new Error(report.message); }, ...(captureConnectMs === undefined ? {} : { captureConnectMs }) });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const run = (ms: number): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      clock.advance(50);
      sim.tick();
    }
  };
  sim.actions.createSession({ caseNumber: 'LP/2026/1001-0012', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
  sim.actions.beginPrecheck();
  run(6_000);
  sim.actions.startRecording();
  return { run, session: () => sim.store.getState().session };
}

describe('the headless simulator holds the connecting part of a start for as long as its host asks', () => {
  it('20,000 ms asked: still connecting after 19.9 s, durable after 20.1 s', async () => {
    const h = await started(20_000);
    h.run(19_900);
    expect(h.session()).toMatchObject({ state: 'RECORDING', captureDurable: false });
    h.run(200);
    expect(h.session()).not.toHaveProperty('captureDurable');
  });

  it('CONTROL - nothing asked: 1,000 ms', async () => {
    const h = await started();
    h.run(900);
    expect(h.session()).toMatchObject({ captureDurable: false });
    h.run(200);
    expect(h.session()).not.toHaveProperty('captureDurable');
  });
});
