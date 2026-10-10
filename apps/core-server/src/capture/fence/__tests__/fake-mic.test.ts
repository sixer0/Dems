// The development SPEECH microphone at the fence (fix wave H, driver E; ruling D198 on gate 81
// condition C1: "the generated microphone carries no speech, so no chunk was planned").
//
// What a FAKE microphone plays is a DEVELOPMENT setting, read ONCE at boot by ONE function:
// `DEMS_CAPTURE_DEV_FAKE_MIC=tone|speech` (default `tone`). `speech` outside development capture
// is refused by name (a production configuration never carries a development setting); `speech`
// without a usable fixture is refused by name and says how to make it. No device is ever opened.
import { afterAll, describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../../test/static/scan';
import { ConfigError, ENV_CAPTURE_DEV_FAKE_MIC, parseCaptureDevFakeMic } from '../../../config';
import { CaptureOperation } from '../../adapters';
import { MIC_HELPER_LIMITS, type LocalMicStream, type ProgramFacts } from '../../adapters/local';
import { manualTimers, scriptedDoor, temporaryRoot, trustedInspector } from '../../adapters/local/__tests__/mic-support';
import { CaptureFenceError, FakeMicRefusal, FakeMicSource, SpeechFixtureProblem, buildDevelopmentRegistry, fakeMicDecisionOf, runCaptureFenceBoot, type CaptureFenceOutcome } from '../index';
import { HELPER, LOCAL, SEEDED, SEEDED_SELECTOR, configOf, fakeTables, keptSinks, type FakeTables, type FenceConfig, type KeptSinks } from './support';

const DATA = '/work/.data';
const FIXTURE = `${DATA}/dev-fixtures/speech-mic/dialogue.wav`;
const trusted = trustedInspector();
const absent = (): ProgramFacts => ({ ...trusted(), exists: false, file: null });
/**
 * Closing pass Z1 (pins moved by delta): the fixture is also held to its FORMAT, so a test that means
 * "a usable fixture" hands in the head of one - the 44-byte header the set-up writes (integer PCM,
 * mono, 48,000 Hz, 16 bit) and one second of samples. The format cases: `wave-h-z1-speech-fixture-format.test.ts`.
 */
const usableHead = (): Uint8Array => {
  const head = Buffer.alloc(44 + 96_000);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + 96_000, 4);
  head.write('WAVEfmt ', 8, 'ascii');
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(48_000, 24);
  head.writeUInt32LE(96_000, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(96_000, 40);
  return head.subarray(0, 8_192);
};
const DEVELOPMENT = { captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER } as const;
type MicConfig = FenceConfig & { readonly captureDevFakeMic?: 'tone' | 'speech'; readonly dataDir?: string };
const speech = (patch: Partial<MicConfig> = {}): MicConfig => ({ ...configOf(patch), captureDevFakeMic: 'speech', dataDir: DATA, ...patch });

describe('fakeMicDecisionOf: the one reader of the setting', () => {
  it('the default and `tone` play the tone in every operation, and ask the file system nothing', () => {
    const never = (): ProgramFacts => {
      throw new Error('the fixture is not inspected for the tone');
    };
    for (const operation of Object.values(CaptureOperation)) {
      expect(fakeMicDecisionOf({ dataDir: DATA }, operation, never)).toEqual({ source: FakeMicSource.TONE, fixturePath: null, refusal: null, problem: null });
      expect(fakeMicDecisionOf({ captureDevFakeMic: 'tone', dataDir: DATA }, operation, never)).toEqual({ source: FakeMicSource.TONE, fixturePath: null, refusal: null, problem: null });
    }
  });

  it('`speech` in development capture with a usable fixture: the fixture path under the data directory', () => {
    const asked: string[] = [];
    const decision = fakeMicDecisionOf({ captureDevFakeMic: 'speech', dataDir: DATA }, CaptureOperation.REAL_DEVELOPMENT, (path) => (asked.push(path), trusted()), usableHead);
    expect(decision).toEqual({ source: FakeMicSource.SPEECH, fixturePath: FIXTURE, refusal: null, problem: null });
    expect(asked).toEqual([FIXTURE]);
  });

  it('`speech` is REFUSED outside development capture - production and simulated - and plays nothing', () => {
    for (const operation of [CaptureOperation.REAL_PRODUCTION, CaptureOperation.SIMULATED]) {
      expect(fakeMicDecisionOf({ captureDevFakeMic: 'speech', dataDir: DATA }, operation, trusted)).toEqual({ source: FakeMicSource.TONE, fixturePath: null, refusal: FakeMicRefusal.DEV_FAKE_MIC_NEEDS_DEV_SOURCES, problem: null });
    }
  });

  it('`speech` with an absent fixture, one another user could replace, or a data directory outside the path shape: refused, with the rule that failed', () => {
    const of = (inspect: () => ProgramFacts, dataDir = DATA) => fakeMicDecisionOf({ captureDevFakeMic: 'speech', dataDir }, CaptureOperation.REAL_DEVELOPMENT, inspect);
    expect(of(absent)).toEqual({ source: FakeMicSource.TONE, fixturePath: null, refusal: FakeMicRefusal.DEV_SPEECH_FIXTURE_UNUSABLE, problem: SpeechFixtureProblem.NOT_FOUND });
    expect(of(() => ({ ...trusted(), file: { ownerUid: 501, mode: 0o664 } })).problem).toBe(SpeechFixtureProblem.FILE_WRITABLE);
    expect(of(() => ({ ...trusted(), file: { ownerUid: 777, mode: 0o600 } })).problem).toBe(SpeechFixtureProblem.FILE_OWNER);
    expect(of(() => ({ ...trusted(), directoriesAsWritten: [{ ownerUid: 0, mode: 0o777 }] })).problem).toBe(SpeechFixtureProblem.DIRECTORY_WRITABLE);
    expect(of(() => ({ ...trusted(), regularFile: false })).problem).toBe(SpeechFixtureProblem.NOT_A_FILE);
    expect(of(trusted, '/work/a;b/.data')).toMatchObject({ refusal: FakeMicRefusal.DEV_SPEECH_FIXTURE_UNUSABLE, problem: SpeechFixtureProblem.PATH_SHAPE, fixturePath: null });
    expect(fakeMicDecisionOf({ captureDevFakeMic: 'speech' }, CaptureOperation.REAL_DEVELOPMENT, trusted)).toMatchObject({ refusal: FakeMicRefusal.DEV_SPEECH_FIXTURE_UNUSABLE, problem: SpeechFixtureProblem.PATH_SHAPE });
  });

  it('any other value than the literal `speech` is the tone: a configuration built by hand cannot turn speech on by accident', () => {
    for (const value of [true, 1, 'SPEECH', 'voice', {}, null]) {
      expect(fakeMicDecisionOf({ captureDevFakeMic: value as unknown as 'speech', dataDir: DATA }, CaptureOperation.REAL_DEVELOPMENT, trusted).source).toBe(FakeMicSource.TONE);
    }
  });
});

describe('the key of the configuration', () => {
  it('unset or empty is `tone`; `speech` is `speech`; any other value stops the boot with a code and without the value', () => {
    expect([parseCaptureDevFakeMic(undefined), parseCaptureDevFakeMic(''), parseCaptureDevFakeMic('tone'), parseCaptureDevFakeMic('speech')]).toEqual(['tone', 'tone', 'tone', 'speech']);
    for (const value of ['1', 'SPEECH', 'voice', '/work/a.wav']) {
      let thrown: unknown = null;
      try {
        parseCaptureDevFakeMic(value);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(ConfigError);
      expect((thrown as ConfigError).code).toBe('CAPTURE_DEV_FAKE_MIC_INVALID');
      expect((thrown as ConfigError).message).toBe(`${ENV_CAPTURE_DEV_FAKE_MIC} must be one of tone, speech.`);
    }
  });
});

interface Booted {
  readonly outcome: CaptureFenceOutcome | null;
  readonly error: CaptureFenceError | null;
  readonly tables: FakeTables;
  readonly sinks: KeptSinks;
}

async function boot(config: MicConfig, inspect: (path: string) => ProgramFacts = trusted, selector: typeof SEEDED_SELECTOR | null = SEEDED_SELECTOR): Promise<Booted> {
  const sinks = keptSinks();
  const tables = fakeTables(SEEDED, selector);
  try {
    const outcome = await runCaptureFenceBoot({ config, inUnit: tables.inUnit, inspect, readHead: usableHead, labels: { CAMERA: 'MacBook Air Camera', MIC: 'MacBook Air Microphone' }, listed: async () => true, sinks });
    return { outcome, error: null, tables, sinks };
  } catch (error) {
    if (!(error instanceof CaptureFenceError)) throw error;
    return { outcome: null, error, tables, sinks };
  }
}

describe('the boot of the fence with the setting', () => {
  it('development capture without the setting: the tone, and the log of the boot is what it was', async () => {
    const booted = await boot(configOf(DEVELOPMENT));
    expect(booted.outcome?.fakeMic).toEqual({ source: 'TONE', fixturePath: null });
    expect(booted.sinks.lines.map((line) => line.fields['code'])).toEqual(['CAPTURE_FENCE_PASSED']);
  });

  it('development capture with `speech` and the fixture: boots, the outcome names the fixture, ONE log line says so without the path', async () => {
    const booted = await boot(speech(DEVELOPMENT));
    expect(booted.error).toBeNull();
    expect(booted.outcome).toMatchObject({ operation: 'REAL_DEVELOPMENT', fakeMic: { source: 'SPEECH', fixturePath: FIXTURE } });
    expect(booted.sinks.lines.map((line) => [line.level, line.fields['code']])).toEqual([['info', 'CAPTURE_FENCE_PASSED'], ['info', 'DEV_FAKE_MIC_SPEECH']]);
    expect(JSON.stringify(booted.sinks.lines)).not.toContain(DATA);
    expect(booted.tables.bootAudits).toEqual(['REAL_DEVELOPMENT']);
  });

  it('`speech` with NO fixture: a NAMED refusal that says how to create it; nothing registered, no audit row, the code logged and persisted', async () => {
    const booted = await boot(speech(DEVELOPMENT), (path) => (path === FIXTURE ? absent() : trusted()));
    expect(booted.outcome).toBeNull();
    expect(booted.error?.code).toBe('DEV_SPEECH_FIXTURE_UNUSABLE');
    expect(booted.error?.fixtureProblem).toBe('NOT_FOUND');
    expect(booted.error?.message).toContain('npm run capture:dev-setup');
    expect(booted.error?.message).toContain('Reason: NOT_FOUND.');
    expect(booted.error?.message).not.toContain(DATA);
    expect(booted.sinks.lines.filter((line) => line.level === 'error').map((line) => line.fields)).toEqual([{ code: 'DEV_SPEECH_FIXTURE_UNUSABLE', devices: '', reason: 'NOT_FOUND' }]);
    expect(booted.sinks.persisted.map((entry) => [entry.level, entry.code])).toEqual([['error', 'DEV_SPEECH_FIXTURE_UNUSABLE']]);
    expect(booted.tables.bootAudits).toEqual([]);
    expect(booted.tables.statements).toEqual([]);
    expect(booted.tables.devices.filter((row) => row.adapterKind === 'LOCAL_DEVICE')).toEqual([]);
  });

  it('PRODUCTION REFUSES THE SETTING: real capture without the development flag and `speech` does not boot', async () => {
    const booted = await boot(speech({ captureMode: 'real', demoControls: false }), trusted, null);
    expect(booted.error?.code).toBe('DEV_FAKE_MIC_NEEDS_DEV_SOURCES');
    expect(booted.error?.message).toContain('DEMS_CAPTURE_DEV_FAKE_MIC');
    expect(booted.tables.bootAudits).toEqual([]);
    expect(booted.tables.statements).toEqual([]);
    // Control: the same configuration without the setting boots REAL_PRODUCTION.
    const without = await boot(configOf({ captureMode: 'real', demoControls: false }), trusted, null);
    expect(without.outcome).toMatchObject({ operation: 'REAL_PRODUCTION', fakeMic: { source: 'TONE', fixturePath: null } });
  });

  it('simulated mode refuses the setting as well; a combination the flags refuse keeps ITS code', async () => {
    expect((await boot(speech())).error?.code).toBe('DEV_FAKE_MIC_NEEDS_DEV_SOURCES');
    expect((await boot(speech({ captureDevSources: true }))).error?.code).toBe('DEV_SOURCES_NEED_REAL_CAPTURE');
  });
});

describe('the development registry: which microphone plays what', () => {
  const tmp = temporaryRoot();
  afterAll(() => tmp.remove());
  let run = 0;

  /** Opens and starts both test microphones through the registry; answers the helper argument list each was started with. */
  const pushes = async (speechFixturePath: string | null): Promise<Record<string, string[]>> => {
    const timers = manualTimers();
    const scripted = scriptedDoor('not a device list\n', () => ({ lives: true }));
    const built = buildDevelopmentRegistry({
      devices: [...SEEDED, ...LOCAL],
      local: { cameraId: 'CAM-03', micId: 'MIC-03' },
      program: HELPER,
      runDir: `${tmp.root}/registry-${(run += 1)}/run/capture`,
      now: () => 0,
      timers,
      door: scripted.door,
      inspect: trustedInspector(process.getuid?.() ?? 501),
      speechFixturePath,
    });
    for (const id of ['MIC-01', 'MIC-02']) {
      const stream = (await built.registry.resolve('MIC', id).open(id, { sessionId: 'SES-20261010-0001', signal: new AbortController().signal })) as LocalMicStream;
      const starting = stream.start();
      for (let attempt = 0; attempt < 400 && !timers.pending().includes(MIC_HELPER_LIMITS.settleMs); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
      timers.fire(MIC_HELPER_LIMITS.settleMs);
      await starting;
    }
    const started = Object.fromEntries(scripted.pushes().map((call) => [/\/(MIC-[0-9]+)\.pcm$/.exec(call.args[call.args.length - 1] ?? '')?.[1] ?? '?', [...call.args]]));
    await built.closeAll();
    return started;
  };

  it('with the fixture the FIRST test microphone plays it and the second keeps its 880 Hz tone; without it both play their tones; no list names a device', async () => {
    const withSpeech = await pushes(FIXTURE);
    expect(Object.keys(withSpeech).sort()).toEqual(['MIC-01', 'MIC-02']);
    expect(withSpeech['MIC-01']).toEqual(expect.arrayContaining(['-re', '-stream_loop', '-f', 'wav', FIXTURE]));
    expect(withSpeech['MIC-01']?.some((argument) => argument.startsWith('sine='))).toBe(false);
    expect(withSpeech['MIC-02']).toContain('sine=frequency=880:sample_rate=48000');
    expect(withSpeech['MIC-02']).not.toContain(FIXTURE);
    expect(Object.values(withSpeech).flat()).not.toContain('avfoundation');
    const tones = await pushes(null);
    expect(tones['MIC-01']).toContain('sine=frequency=440:sample_rate=48000');
    expect(tones['MIC-02']).toContain('sine=frequency=880:sample_rate=48000');
    expect(Object.values(tones).flat()).not.toContain(FIXTURE);
    // The output line of the speech microphone IS the tone microphone's: the worker reads one transport.
    const tail = (list: readonly string[] | undefined): string[] => (list ?? []).slice((list ?? []).indexOf('-vn'), -1);
    expect(tail(withSpeech['MIC-01'])).toEqual(tail(tones['MIC-01']));
    expect(tail(withSpeech['MIC-01']).length).toBeGreaterThan(5);
  });
});

describe('one reader: no production file but the one function reads the setting', () => {
  const production = codeOnly(readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts')));
  const join = (...parts: string[]): string => parts.join('');
  const READ = new RegExp(`\\.\\s*${join('captureDev', 'FakeMic')}\\b`, 'g');
  const VARIABLE = new RegExp(`\\b(?:ENV_CAPTURE_DEV_FAKE_MIC|${join('DEMS_CAPTURE_', 'DEV_FAKE_MIC')}['"\`\\]])`, 'g');
  const READER = 'src/capture/fence/fake-mic.ts';
  const violations = (files: readonly SourceFile[]): string[] => [
    ...occurrences(files, READ, (path) => path !== READER && path !== 'src/config.ts').map((place) => `${place} reads the setting`),
    ...occurrences(files, VARIABLE, (path) => path !== 'src/config.ts' && path !== 'src/plugins/config/load-config.ts').map((place) => `${place} names the variable`),
  ];

  it('finds a second reader and a read of the variable (control)', () => {
    expect(
      violations([
        { path: 'src/capture/fence/index.ts', text: `if (app.config.${join('captureDev', 'FakeMic')} === 'speech') speech();` },
        { path: 'src/engine/index.ts', text: `const mic = options.env[ENV_CAPTURE_DEV_FAKE_MIC];` },
      ]),
    ).toEqual(['src/capture/fence/index.ts:1 reads the setting', 'src/engine/index.ts:1 names the variable']);
  });

  it('holds for the production tree: one read in the one function; the configuration builds it with the default `tone`', () => {
    expect(violations(production)).toEqual([]);
    expect([...(production.find((file) => file.path === READER)?.text ?? '').matchAll(READ)]).toHaveLength(1);
    const config = production.find((file) => file.path === 'src/config.ts')?.text ?? '';
    expect([...config.matchAll(READ)]).toHaveLength(1);
    expect(config).toContain("captureDevFakeMic: input.captureDevFakeMic ?? 'tone',");
  });
});
