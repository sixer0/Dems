// The floor of the server clock (fix round B2a, finding F74; decision D110; security finding
// CPS1-1, guarantees G1, G3, G4; ENG-13, ENG-14). Database-free: the two functions of
// `src/core/clock.ts` the engine's start relies on, and the engine's own clock.
//
// The rules under test:
//   ONE time base. The instant below which no row may be stamped is held by the server clock
//   itself, not by a second clock inside the engine.
//   Time RUNS ON from the floor at the real rate. It does not stand still until the system time
//   has caught up, and it keeps no offset once the system time is at or past it.
import { createManualClock } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { CoreError, createSystemClock, followClock, raiseClockFloor, stampOf, type Clock, type FloorClock } from '../../core';
import { engineClock, createHeadlessSim } from '../headless-sim';

const INVALID: ReadonlyArray<readonly [string, number]> = [
  ['a negative instant', -1],
  ['a fraction', 1.5],
  ['not a number', Number.NaN],
  ['infinity', Number.POSITIVE_INFINITY],
  ['a number that is not safe', Number.MAX_SAFE_INTEGER + 2],
];

const hasFloor = (clock: Clock): clock is FloorClock => 'raiseFloor' in clock;

/**
 * A system time and a monotonic timer that a test moves. `pass(ms)` is real time passing: both
 * move. `setSystemTime(at)` is somebody setting the system time: the timer does not move.
 */
function sources(startAt: number) {
  let system = startAt;
  // A timer has no meaningful zero and counts in fractions of a millisecond.
  let timer = 987_654.321;
  const clock = createSystemClock(
    () => system,
    () => timer,
  );
  return {
    clock,
    pass(ms: number) {
      system += ms;
      timer += ms;
    },
    setSystemTime(at: number) {
      system = at;
    },
    systemTime: () => system,
  };
}

describe('the server clock runs on from its floor at the real rate (guarantee G3)', () => {
  it('reads the floor at once, then the floor plus the time that passed, while the system time is behind', () => {
    const { clock, pass, systemTime } = sources(1_000);
    expect(clock.now()).toBe(1_000);

    clock.raiseFloor(121_000);
    expect(clock.now()).toBe(121_000);
    pass(1);
    expect(clock.now()).toBe(121_001);
    pass(59_999);
    // Sixty seconds passed: the clock is sixty seconds past the floor, the system time still behind it.
    expect(clock.now()).toBe(181_000);
    expect(systemTime()).toBe(61_000);
    pass(3_600_000);
    expect(clock.now()).toBe(3_781_000);
  });

  it('counts whole milliseconds only: a stamp is always a whole number', () => {
    const { clock, pass } = sources(1_000);
    clock.raiseFloor(5_000);
    pass(0.4);
    expect(clock.now()).toBe(5_000);
    pass(0.4);
    expect(clock.now()).toBe(5_000);
    pass(0.4);
    expect(clock.now()).toBe(5_001);
    expect(stampOf(clock)).toBe(5_001);
  });

  it('is the system time again, exactly, once that is corrected past the clock: no jump back, no double counting', () => {
    const { clock, pass, setSystemTime } = sources(1_000);
    clock.raiseFloor(121_000);
    pass(10_000);
    expect(clock.now()).toBe(131_000);
    // The system time is corrected (it was two minutes behind): it now shows the true time.
    setSystemTime(500_000);
    expect(clock.now()).toBe(500_000);
    // From here on the clock IS the system time: the two minutes are not added a second time.
    pass(250);
    expect(clock.now()).toBe(500_250);
    pass(60_000);
    expect(clock.now()).toBe(560_250);
  });

  it('a correction that leaves the system time behind the clock changes nothing: the clock runs on', () => {
    const { clock, pass, setSystemTime } = sources(1_000);
    clock.raiseFloor(121_000);
    pass(10_000);
    setSystemTime(100_000);
    expect(clock.now()).toBe(131_000);
    pass(5_000);
    expect(clock.now()).toBe(136_000);
    // The system time reaches the clock by passing time alone only if it runs faster; a correction to exactly the clock is taken.
    setSystemTime(136_000);
    expect(clock.now()).toBe(136_000);
    pass(1);
    expect(clock.now()).toBe(136_001);
  });

  it('the system time set BACK while the process runs: the clock neither steps back nor stands still', () => {
    const { clock, pass, setSystemTime } = sources(200_000);
    expect(clock.now()).toBe(200_000);
    pass(1_000);
    expect(clock.now()).toBe(201_000);
    setSystemTime(100_000);
    expect(clock.now()).toBe(201_000);
    pass(60_000);
    expect(clock.now()).toBe(261_000);
    // And a second set-back, while it already runs on the timer.
    setSystemTime(50_000);
    pass(1_000);
    expect(clock.now()).toBe(262_000);
    // Set forward again, past the clock: the system time, exactly.
    setSystemTime(300_000);
    expect(clock.now()).toBe(300_000);
  });

  it('never moves backwards and never reads below the system time, over a long random walk of both', () => {
    const { clock, pass, setSystemTime, systemTime } = sources(1_000_000);
    // A fixed pseudo-random sequence (a linear congruential generator): the same walk in every run.
    let seed = 20_261_004;
    const next = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    let previous = clock.now();
    let passed = 0;
    let advanced = 0;
    for (let step = 0; step < 5_000; step += 1) {
      const roll = next();
      const before = clock.now();
      if (roll < 0.6) {
        const ms = Math.floor(next() * 5_000);
        pass(ms);
        passed += ms;
        // Time that passes is counted in full: at least `ms`, more only when the system time is ahead.
        expect(clock.now() - before).toBeGreaterThanOrEqual(ms);
        advanced += clock.now() - before;
      } else if (roll < 0.8) {
        setSystemTime(systemTime() - Math.floor(next() * 600_000));
        expect(clock.now()).toBe(before);
      } else if (roll < 0.95) {
        setSystemTime(systemTime() + Math.floor(next() * 600_000));
      } else {
        clock.raiseFloor(before + Math.floor(next() * 600_000));
      }
      const now = clock.now();
      expect(now).toBeGreaterThanOrEqual(previous);
      expect(now).toBeGreaterThanOrEqual(systemTime());
      expect(Number.isSafeInteger(now)).toBe(true);
      previous = now;
    }
    expect(passed).toBeGreaterThan(1_000_000);
    expect(advanced).toBeGreaterThanOrEqual(passed);
  });
});

describe('the floor itself', () => {
  it('only rises: an instant at or below what the clock reads changes nothing', () => {
    const { clock, pass } = sources(50_000);
    clock.raiseFloor(10_000);
    expect(clock.now()).toBe(50_000);
    clock.raiseFloor(50_000);
    expect(clock.now()).toBe(50_000);
    pass(500);
    // Not behind: the clock is the system time, with no timer in play.
    expect(clock.now()).toBe(50_500);
    clock.raiseFloor(80_000);
    clock.raiseFloor(70_000);
    expect(clock.now()).toBe(80_000);
    pass(500);
    expect(clock.now()).toBe(80_500);
    // A second, higher floor while it runs on: from the new floor, at the same rate.
    clock.raiseFloor(90_000);
    expect(clock.now()).toBe(90_000);
    pass(1_000);
    expect(clock.now()).toBe(91_000);
  });

  it('raised before the first reading holds: the first reading is never below it', () => {
    const clock = createSystemClock(
      () => 1_000,
      () => 0,
    );
    clock.raiseFloor(9_000);
    expect(clock.now()).toBe(9_000);
  });

  it.each(INVALID)('refuses %s, and the clock is as it was', (_name, instant) => {
    const { clock, pass } = sources(5_000);
    expect(() => clock.raiseFloor(instant)).toThrowError(CoreError);
    expect(() => clock.raiseFloor(instant)).toThrowError(expect.objectContaining({ code: 'CLOCK_VALUE_INVALID' }));
    expect(clock.now()).toBe(5_000);
    pass(10);
    expect(clock.now()).toBe(5_010);
  });

  it('zero is a floor that changes nothing', () => {
    const { clock } = sources(5_000);
    clock.raiseFloor(0);
    expect(clock.now()).toBe(5_000);
  });
});

describe('the server clock without a floor: as it was (ENG-14)', () => {
  it('with a source and no timer, no time passes by itself: a system time that is set back holds the clock', () => {
    const wall = [1_000, 1_005, 900, 950, 1_005, 1_006];
    const clock = createSystemClock(() => wall.shift() ?? 2_000);
    expect([clock.now(), clock.now(), clock.now(), clock.now(), clock.now(), clock.now()]).toEqual([1_000, 1_005, 1_005, 1_005, 1_005, 1_006]);
  });

  it('with a source and no timer, a floor holds the clock until the source has passed it, however much real time passes', async () => {
    let system = 1_000;
    const clock = createSystemClock(() => system);
    clock.raiseFloor(4_000);
    system = 3_999;
    expect(clock.now()).toBe(4_000);
    // Real time is not this clock's timer: a caller that gave a source and no timer gets no time of the runtime.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(clock.now()).toBe(4_000);
    system = 4_001;
    expect(clock.now()).toBe(4_001);
  });

  it('the runtime\'s own: the system time, never backwards, and a floor ahead of it runs on in real time', async () => {
    const clock = createSystemClock();
    const before = Date.now();
    const first = clock.now();
    expect(first).toBeGreaterThanOrEqual(before);
    expect(first).toBeLessThanOrEqual(Date.now());

    const floor = first + 3_600_000;
    clock.raiseFloor(floor);
    expect(clock.now()).toBeGreaterThanOrEqual(floor);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const later = clock.now();
    // Thirty milliseconds passed, give or take the timer of the runtime: the clock moved, by about that much.
    expect(later - floor).toBeGreaterThanOrEqual(25);
    expect(later - floor).toBeLessThan(5_000);
  });
});

describe('raiseClockFloor: the one entry the engine\'s start uses', () => {
  it('a clock with a floor takes it in place: true, and the same object reads it', () => {
    const { clock, pass } = sources(1_000);
    expect(raiseClockFloor(clock, 4_000)).toBe(true);
    expect(clock.now()).toBe(4_000);
    pass(100);
    expect(clock.now()).toBe(4_100);
    // Also when it is not behind.
    expect(raiseClockFloor(clock, 2_000)).toBe(true);
    expect(clock.now()).toBe(4_100);
  });

  it('a clock without a floor that is at or past the instant needs none: true, and it is untouched', () => {
    const manual = createManualClock(7_000);
    expect(raiseClockFloor(manual, 7_000)).toBe(true);
    expect(raiseClockFloor(manual, 6_999)).toBe(true);
    expect(hasFloor(manual)).toBe(false);
    expect(manual.now()).toBe(7_000);
  });

  it('a clock without a floor that is behind the instant cannot hold it: false, and it is untouched', () => {
    const manual = createManualClock(1_000);
    expect(raiseClockFloor(manual, 1_001)).toBe(false);
    expect(raiseClockFloor(manual, 5_000)).toBe(false);
    expect(manual.now()).toBe(1_000);
    expect(Object.keys(manual).sort()).toEqual(['advance', 'now', 'set', 'tz', 'tzOffsetMinutes']);
  });

  it('a clock that only follows another has no floor of its own: the floor is raised on the clock behind the seam, and every follower reads it', () => {
    const { clock: system } = sources(1_000);
    const follower = followClock(() => system);
    expect(hasFloor(follower)).toBe(false);
    expect(raiseClockFloor(follower, 3_000)).toBe(false);
    expect(follower.now()).toBe(1_000);
    expect(raiseClockFloor(system, 3_000)).toBe(true);
    expect(follower.now()).toBe(3_000);
  });

  it.each(INVALID)('refuses %s before it touches the clock', (_name, instant) => {
    const manual = createManualClock(1_000);
    expect(() => raiseClockFloor(manual, instant)).toThrowError(expect.objectContaining({ code: 'CLOCK_VALUE_INVALID' }));
    const { clock } = sources(1_000);
    expect(() => raiseClockFloor(clock, instant)).toThrowError(expect.objectContaining({ code: 'CLOCK_VALUE_INVALID' }));
    expect(clock.now()).toBe(1_000);
  });
});

describe('a server clock on ONE manual clock: what a test puts behind the seam to start a server behind the stored state', () => {
  const onManual = (startAt: number) => {
    const manual = createManualClock(startAt);
    const read = (): number => manual.now();
    return { manual, clock: createSystemClock(read, read) };
  };

  it('is the manual clock while that is not behind', () => {
    const { manual, clock } = onManual(1_000);
    expect(clock.now()).toBe(1_000);
    manual.advance(250);
    expect(clock.now()).toBe(1_250);
    manual.set(9_000);
    expect(clock.now()).toBe(9_000);
  });

  it('reads the floor plus how far the manual clock moved since: time passes when the test advances its clock', () => {
    const { manual, clock } = onManual(1_000);
    expect(raiseClockFloor(clock, 5_000)).toBe(true);
    expect(clock.now()).toBe(5_000);
    manual.advance(60_000);
    expect(clock.now()).toBe(65_000);
    manual.advance(1);
    expect(clock.now()).toBe(65_001);
    // The manual clock is the test's: it reads what the test set, as before.
    expect(manual.now()).toBe(61_001);
    // One source cannot tell a correction from time that passed: the distance stays.
    manual.set(500_000);
    expect(clock.now()).toBe(504_000);
    // A test that sets its clock back does not move the server clock back.
    manual.set(2_000);
    expect(clock.now()).toBe(504_000);
  });

  it('takes the next floor in place: one holder, however often a start raises it', () => {
    const { manual, clock } = onManual(1_000);
    clock.raiseFloor(5_000);
    clock.raiseFloor(8_000);
    expect(clock.now()).toBe(8_000);
    clock.raiseFloor(2_000);
    expect(clock.now()).toBe(8_000);
    manual.advance(10);
    expect(clock.now()).toBe(8_010);
    expect(() => clock.raiseFloor(-5)).toThrowError(expect.objectContaining({ code: 'CLOCK_VALUE_INVALID' }));
    expect(clock.now()).toBe(8_010);
  });
});

describe('the engine clock (ONE time base, guarantee G4)', () => {
  it('is the server clock in the form the simulator takes: it holds no floor and no offset of its own', () => {
    const manual = createManualClock(1_000);
    const engine = engineClock(manual);
    expect(Object.keys(engine).sort()).toEqual(['now', 'tz', 'tzOffsetMinutes']);
    expect(engine).toMatchObject({ tz: '+07:00', tzOffsetMinutes: 420 });
    expect(engine.now()).toBe(1_000);
    manual.set(7_500);
    expect(engine.now()).toBe(7_500);
  });

  it('reads the floor of the server clock through it: the engine and a module read the same instant at every moment', () => {
    const { clock: server, pass, setSystemTime } = sources(1_000);
    const engine = engineClock(followClock(() => server));
    const both = (): number[] => [engine.now(), server.now()];
    expect(raiseClockFloor(server, 5_000)).toBe(true);
    expect(both()).toEqual([5_000, 5_000]);
    pass(2_000);
    expect(both()).toEqual([7_000, 7_000]);
    setSystemTime(90_000);
    expect(both()).toEqual([90_000, 90_000]);
    setSystemTime(10_000);
    pass(5);
    expect(both()).toEqual([90_005, 90_005]);
  });
});

describe('the connecting time of the headless simulator (wave H, closing pass Z1, item 9)', () => {
  // Wave H closing pass Z1, item 9 (driver B decision 6): the headless simulator of the engine takes the
  // connecting time its host asks for (`HeadlessSimOptions.captureConnectMs`), and keeps the default
  // without it. A test / development control: no configuration key and no operation sets it.

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
});
