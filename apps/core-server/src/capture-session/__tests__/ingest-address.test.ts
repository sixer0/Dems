// Task 4 row 47 (WP-06b): the ingest address of a camera track, the ingest window of production,
// and the static rule of the row (security checks AD-05 (1), AD-11 and BR-07 (1), (3), (4)).
//
// No database, no process, no port. The first block calls the one function that builds the
// address; the second reads the argument builder of the worker; the third reads SOURCES of
// `src/` and holds where an ingest address may stand. It edits no rule list of the capture static
// files: a new reader of the address is added HERE, by decision.
import { CAPTURE_MEDIA_PORT_MAX, CAPTURE_MEDIA_PORT_MIN, CAPTURE_WORKER_SETTINGS, CapturePlanCameraSchema, LOOPBACK_RTSP_URL } from '@dems/capture-protocol';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CAPTURE_WORKER_PROCESS_SETTINGS, CAPTURE_WORKER_PRODUCTION_SETTINGS, PRODUCTION_INGEST_OPEN_WINDOW_MS, captureWorkerArguments } from '../../capture/worker-arguments';
import { randomBytes } from 'node:crypto';
// Integration pass I-3: the function moved from the session file into a unit of the capture area that imports nothing
// (the supervisor reaches it there, row 179); the session hands it the random source. The pins below follow it.
import { CAPTURE_INGEST_CHANCE_REFUSED, CAPTURE_INGEST_PORT, CAPTURE_INGEST_SECRET_BYTES, captureIngestAddress as addressFrom, type CaptureIngestTrackId } from '../../capture/ingest-address';
import { PRODUCTION_CAMERA_OPEN_BOUND_MS } from '../index';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../..');
const SESSION_FILE = 'capture-session/index.ts';
const ADDRESS_FILE = 'capture/ingest-address.ts';
/** The function as the session calls it: with the random source of the runtime's cryptography module. */
const captureIngestAddress = (sessionId: string, trackId: CaptureIngestTrackId): string => addressFrom(sessionId, trackId, randomBytes);
const read = (path: string): string => readFileSync(resolve(SRC, path), 'utf8');

/** Every production source of the server: no test file, nothing under a `__tests__` folder. */
function productionSources(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(path);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) found.push(relative(SRC, path));
    }
  };
  walk(SRC);
  return found.sort();
}

/** The lines of a source that are code: a line that is only a comment is left out. */
const codeLines = (text: string): string[] => text.split('\n').filter((line) => !/^\s*(?:\/\/|\/?\*)/.test(line));
const SESSION = 'SES-20261013-0001';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const elementOf = (address: string): string => address.slice(address.lastIndexOf('/') + 1);

describe('row 47, BR-07 (1) and (3): the one function that builds the ingest address of a camera track', () => {
  it('the address is the loopback listener of the track, the session, the track and one last element: in the grammar of the protocol, no trailing slash, no query, nothing to decode', () => {
    for (const trackId of ['VIDEO-01', 'VIDEO-02'] as const) {
      const address = captureIngestAddress(SESSION, trackId);
      const element = elementOf(address);
      expect(address.slice(0, address.lastIndexOf('/'))).toBe(`rtsp://127.0.0.1:${CAPTURE_INGEST_PORT[trackId]}/${SESSION}/${trackId.toLowerCase()}`);
      expect(LOOPBACK_RTSP_URL.test(address)).toBe(true);
      expect(address.length).toBeLessThanOrEqual(256);
      expect(/[?#%@]|\/$/.test(address)).toBe(false);
      // The plan of the protocol takes it as it is (the worker compares THIS string with what the client announces).
      expect(CapturePlanCameraSchema.safeParse({ deviceId: 'CAM-01', trackId, profile: null, ingestUrl: address, outputPath: '/media/x.mp4' }).success).toBe(true);
      // The form the secret scan counts (request of row 5): one path element of 22 URL-safe characters that is no UUID.
      expect(/^[A-Za-z0-9_-]{22}$/.test(element)).toBe(true);
      expect(UUID.test(element)).toBe(false);
    }
    expect(Object.values(CAPTURE_INGEST_PORT).every((port) => port >= CAPTURE_MEDIA_PORT_MIN && port <= CAPTURE_MEDIA_PORT_MAX)).toBe(true);
  });

  it('the element is at least 128 bits of the system random source, new at every call: it differs between the two tracks, between two starts, and over 2,000 calls', () => {
    expect(CAPTURE_INGEST_SECRET_BYTES * 8).toBeGreaterThanOrEqual(128);
    const one = elementOf(captureIngestAddress(SESSION, 'VIDEO-01'));
    expect(Buffer.from(one, 'base64url').length).toBe(CAPTURE_INGEST_SECRET_BYTES);
    expect(Buffer.from(one, 'base64url').toString('base64url') === one).toBe(true);
    // Two tracks of one start, and the same track of two starts.
    expect(one === elementOf(captureIngestAddress(SESSION, 'VIDEO-02'))).toBe(false);
    expect(one === elementOf(captureIngestAddress(SESSION, 'VIDEO-01'))).toBe(false);
    const many = new Set<string>();
    for (let call = 0; call < 2_000; call += 1) many.add(elementOf(captureIngestAddress(SESSION, call % 2 === 0 ? 'VIDEO-01' : 'VIDEO-02')));
    expect(many.size).toBe(2_000);
    // Not a constant with a counter: every one of the 16 bytes takes more than one value over the calls.
    const bytes = [...many].map((element) => Buffer.from(element, 'base64url'));
    expect(Array.from({ length: CAPTURE_INGEST_SECRET_BYTES }, (_, index) => new Set(bytes.map((value) => value[index])).size > 100)).toEqual(Array.from({ length: CAPTURE_INGEST_SECRET_BYTES }, () => true));
  });

  it('the source of the element is the cryptographic random source of the runtime, and no other', () => {
    // The session names the source and hands it in at TWO lines: the one call of the start, and the start of the worker
    // (row 179: the supervisor builds the addresses of a later attempt from the SAME source). `randomBytes` stands at its import and there, nowhere else.
    const session = codeLines(read(SESSION_FILE)).map((line) => line.trim());
    expect(session.filter((line) => /\brandomBytes\b/.test(line))).toEqual([
      "import { randomBytes } from 'node:crypto';",
      'cameras[trackId] = { ingestUrl: captureIngestAddress(sessionId, trackId, randomBytes), outputPath };',
      // Task 4 row 191: the same line gained the member `sources` (the microphones of a later worker); it takes no address and no source of chance.
      'await supervisor.start(sessionId, plan, { chance: randomBytes, renewed: (_attempt, addresses) => addressesInForce(addresses), sources: (attempt) => microphonesAgain(current, registry, ready, attempt) });',
    ]);
    // The supervisor draws nothing itself and imports no source: its one call takes the source it was handed with `start`.
    const supervisor = codeLines(read('capture/supervisor.ts')).map((line) => line.trim());
    expect(supervisor.filter((line) => /node:crypto|randomBytes|Math\.random|randomUUID|getRandomValues/.test(line))).toEqual([]);
    expect(supervisor.filter((line) => /\.chance\b/.test(line))).toEqual(['address = captureIngestAddress(current.id, camera.trackId, source.chance);']);
    // The unit of the function imports NOTHING (static rule G-R8 of the capture folder: no source of chance there) and asks its parameter once, for 16 bytes.
    const unit = codeLines(read(ADDRESS_FILE)).map((line) => line.trim());
    expect(unit.filter((line) => /^import\b|\brequire\(|\bimport\(/.test(line))).toEqual([]);
    expect(unit.filter((line) => /\bchance\(/.test(line))).toEqual(['const drawn = chance(CAPTURE_INGEST_SECRET_BYTES);']);
    expect(unit.filter((line) => line.includes(".toString('base64url')")).map((line) => line.includes('Buffer.from(drawn)'))).toEqual([true]);
    for (const lines of [session, unit]) expect(lines.filter((line) => /Math\.random|randomUUID|getRandomValues|Date\.now\(\)/.test(line))).toEqual([]);
    // The element IS what was drawn, asked for once; a draw of another length, or no bytes at all, builds no address.
    const asked: number[] = [];
    const fixed = Uint8Array.from({ length: CAPTURE_INGEST_SECRET_BYTES }, (_, index) => 255 - index);
    const built = addressFrom(SESSION, 'VIDEO-01', (bytes) => (asked.push(bytes), fixed));
    expect(asked).toEqual([CAPTURE_INGEST_SECRET_BYTES]);
    expect(elementOf(built)).toBe(Buffer.from(fixed).toString('base64url'));
    for (const length of [0, 1, 15, 17, 32]) expect(() => addressFrom(SESSION, 'VIDEO-02', () => new Uint8Array(length))).toThrow(CAPTURE_INGEST_CHANCE_REFUSED);
    expect(() => addressFrom(SESSION, 'VIDEO-02', () => 'AAAAAAAAAAAAAAAA' as unknown as Uint8Array)).toThrow(CAPTURE_INGEST_CHANCE_REFUSED);
  });
});

describe('row 47, AD-11: the ingest window of production is a constant of the operation', () => {
  const windowOf = (list: readonly string[]): string | undefined => list[list.indexOf(CAPTURE_WORKER_SETTINGS.ingestOpenWindowMs.argument) + 1];

  it('30,000 ms in production, the protocol default everywhere else; the two argument lists differ in that ONE word and in no name', () => {
    expect(PRODUCTION_INGEST_OPEN_WINDOW_MS).toBe(30_000);
    expect(CAPTURE_WORKER_PRODUCTION_SETTINGS).toEqual({ ...CAPTURE_WORKER_PROCESS_SETTINGS, ingestOpenWindowMs: 30_000 });
    expect(Object.isFrozen(CAPTURE_WORKER_PRODUCTION_SETTINGS)).toBe(true);
    const other = captureWorkerArguments('/x/worker.jsonl');
    const production = captureWorkerArguments('/x/worker.jsonl', true);
    expect(windowOf(other)).toBe(String(CAPTURE_WORKER_SETTINGS.ingestOpenWindowMs.default));
    expect(windowOf(other)).toBe('15000');
    expect(captureWorkerArguments('/x/worker.jsonl', false)).toEqual(other);
    expect(windowOf(production)).toBe('30000');
    expect(production).toHaveLength(other.length);
    expect(production.map((word, index) => (word === other[index] ? null : index)).filter((index) => index !== null)).toEqual([other.indexOf(CAPTURE_WORKER_SETTINGS.ingestOpenWindowMs.argument) + 1]);
  });

  it('the bound of one camera open of production is the window minus 5,000 ms', () => {
    expect(PRODUCTION_CAMERA_OPEN_BOUND_MS).toBe(PRODUCTION_INGEST_OPEN_WINDOW_MS - 5_000);
    expect(PRODUCTION_CAMERA_OPEN_BOUND_MS).toBe(25_000);
  });

  it('no environment variable, configuration key or setting reaches the figure: the builder reads none, and no configuration source names the window', () => {
    const builder = read('capture/worker-arguments.ts');
    expect(codeLines(builder).filter((line) => /process\.env|\bconfig\b|\benv\b|getenv|readFile|require\(/.test(line))).toEqual([]);
    // Its imports: the protocol and two packages of constants. Nothing of the server, so nothing that holds a configuration.
    expect(codeLines(builder).filter((line) => line.startsWith('import ')).map((line) => /from '([^']+)'/.exec(line)?.[1])).toEqual(['@dems/capture-protocol', '@dems/shared/api', '@dems/shared/evidence-verify']);
    expect(codeLines(builder).filter((line) => line.includes('30_000'))).toEqual(['export const PRODUCTION_INGEST_OPEN_WINDOW_MS = 30_000;']);
    for (const source of ['config.ts', 'plugins/config/load-config.ts']) expect(/ingest|INGEST|open.?window/i.test(read(source))).toBe(false);
    // CONTROL: the same test finds a key that does exist there.
    expect(/DEMS_CAPTURE_RELAY/.test(read('config.ts'))).toBe(true);
  });
});

describe('row 47, AD-05 (1) and BR-07 (4): where an ingest address is built, and the only places it reaches', () => {
  /** The development files that take the address: the local camera helper and the generated source, both of REAL_DEVELOPMENT only. */
  const DEVELOPMENT_EXCEPTION = ['capture/adapters/local/camera-adapter.ts', 'capture/adapters/local/camera-helper-args.ts', 'capture/adapters/local/camera-helper.ts', 'capture/fence/generated-sources.ts'];
  /**
   * EVERY production source that names the member `ingestUrl`, by decision:
   *   the contract (a declaration), the plan builder (it copies the member into the plan frame),
   *   the session start (it builds the address and hands it to the plan and to the open),
   *   and the development exception.
   * An adapter of production that reads its target (row 46, the relay start) is added here with
   * the proof that it hands the address to the start message on standard input and nowhere else.
   * Row 179: the supervisor, which writes the member into the plan of a LATER attempt (the proof is
   * the case below: three lines, none of them an event, a report, a status or a message).
   * Row 46: the production camera adapter, `capture/adapters/camera/onvif-relay.ts`. Its proof is the
   * source case of `capture/adapters/camera/__tests__/onvif-relay.test.ts`: ONE line names the member,
   * as an argument of the relay start, whose message goes to the relay's standard input and nowhere else.
   */
  const READERS = ['capture-session/index.ts', 'capture/adapters/camera/onvif-relay.ts', 'capture/adapters/types.ts', 'capture/supervisor.ts', 'modules/capture-config/plan.ts', ...DEVELOPMENT_EXCEPTION].sort();

  it('ONE function builds an ingest address: one source of the server composes a loopback RTSP address, once, and that function is called at one place', () => {
    // No source writes an RTSP address as a text (the capture folder may not hold one at all: static rule G-R4).
    const written = productionSources().filter((path) => codeLines(read(path)).some((line) => /rtsp:\/\/127\.0\.0\.1|rtsp:\/\/\$\{|'rtsp:\/\/'|"rtsp:\/\/"|`rtsp:\/\//.test(line)));
    expect(written).toEqual([]);
    // An address is COMPOSED from a scheme constant in two sources: the injection point (a camera's locator, from a
    // parsed camera address: never the loopback listener) and the unit of the ingest address. No third one.
    const FROM_SCHEME = /\$\{\w*SCHEME\w*\}\/\//;
    expect(productionSources().filter((path) => codeLines(read(path)).some((line) => FROM_SCHEME.test(line)))).toEqual(['capture/adapters/credential.ts', ADDRESS_FILE]);
    expect(productionSources().filter((path) => codeLines(read(path)).some((line) => /\bINGEST_(?:SCHEME|HOST)\b/.test(line)))).toEqual([ADDRESS_FILE]);
    const lines = codeLines(read(ADDRESS_FILE));
    expect(lines.filter((line) => /\bINGEST_(?:SCHEME|HOST)\b/.test(line))).toHaveLength(3);
    expect(lines.filter((line) => line.startsWith('const INGEST_'))).toEqual(["const INGEST_SCHEME = 'rtsp:';", "const INGEST_HOST = '127.0.0.1';"]);
    expect(lines.filter((line) => FROM_SCHEME.test(line))).toHaveLength(1);
    expect(lines.filter((line) => FROM_SCHEME.test(line))[0]).toMatch(/^ {2}return `\$\{INGEST_SCHEME\}\/\/\$\{INGEST_HOST\}:\$\{CAPTURE_INGEST_PORT\[trackId\]\}\/\$\{sessionId\}\/\$\{trackId\.toLowerCase\(\)\}\//);
    // Called at TWO places in the whole server: where the session start fills the cameras of the plan (the first worker),
    // and where the supervisor renews them for a later worker of the session (row 179, BR-07 (2)).
    const calls = productionSources().flatMap((path) => codeLines(read(path)).filter((line) => /captureIngestAddress\(/.test(line) && !line.includes('export function')).map((line) => `${path}: ${line.trim()}`));
    expect(calls).toEqual([
      `${SESSION_FILE}: cameras[trackId] = { ingestUrl: captureIngestAddress(sessionId, trackId, randomBytes), outputPath };`,
      'capture/supervisor.ts: address = captureIngestAddress(current.id, camera.trackId, source.chance);',
    ]);
  });

  it('row 179: in the supervisor the member stands at two lines - the renewed plan, and the plan of the start read for its elements - and nothing that says or reports holds an address', () => {
    const lines = codeLines(read('capture/supervisor.ts')).map((line) => line.trim());
    expect(lines.filter((line) => /\bingestUrl\b/.test(line))).toEqual([
      'const renewed = CapturePlanSchema.safeParse({ ...current.plan, cameras: current.plan.cameras.map((camera) => ({ ...camera, ingestUrl: addresses.get(camera.deviceId) })) });',
      'ingestElements: new Set(parsed.data.cameras.map((camera) => ingestElementOf(camera.ingestUrl))),',
    ]);
    // What holds an address or an element there: handed to the receiver of the session and to the plan, and to no event, report or error.
    const holders = lines.filter((line) => /\baddress(?:es)?\b|\belements?\b|ingestElements/.test(line));
    expect(holders.length).toBeGreaterThan(8);
    expect(holders.filter((line) => /emit\(|emitFromWorker\(|report\(|new CaptureSupervisorError|new Error|console\.|JSON\.stringify|status\(/.test(line))).toEqual([]);
    expect(lines.filter((line) => line.includes('source.renewed('))).toEqual(['source.renewed(attempt, addresses);']);
    // The plan is put into ONE frame, the START, and into no message of an error (as before the row).
    expect(lines.filter((line) => /\bplan: current\.plan\b/.test(line))).toEqual(['(envelope) => ({ ...envelope, type: SupervisorMessageType.START, attempt: from.attempt, plan: current.plan }),']);
  });

  it('the sources that name the address are a closed list; the session start names it at three lines: the type of the plan input, the build, and the target of the open', () => {
    expect(productionSources().filter((path) => /\bingestUrl\b/.test(codeLines(read(path)).join('\n')))).toEqual(READERS);
    const lines = codeLines(read(SESSION_FILE)).filter((line) => /\bingestUrl\b/.test(line)).map((line) => line.trim());
    // Row 179 moved the target from the plan's member to the address of the worker IN FORCE, and added the line that fills it from the plan of the start.
    // Integration pass I-7 (row 46's request): the target also names the session the plan was built for and the attempt of the worker in force.
    expect(lines).toEqual([
      "const target: CameraSourceTarget = { ingestUrl: address, sessionId, attempt: current.supervisor.status().attempt, ...(camera.profile === null ? {} : { profile: camera.profile }) };",
      "const cameras: Partial<Record<VideoTrackId, { ingestUrl: string; outputPath: string }>> = {};",
      'cameras[trackId] = { ingestUrl: captureIngestAddress(sessionId, trackId, randomBytes), outputPath };',
      'addressesInForce(new Map(plan.cameras.map((camera) => [camera.deviceId, camera.ingestUrl])));',
    ]);
    // The addresses in force (row 179): one map of the live capture, written by one function, read at one line.
    const all = codeLines(read(SESSION_FILE)).map((line) => line.trim());
    expect(all.filter((line) => /\bcurrent\.ingest\b/.test(line))).toEqual(['const address = current.ingest.get(deviceId);', 'current.ingest.clear();', 'for (const [deviceId, address] of addresses) current.ingest.set(deviceId, address);']);
    expect(all.filter((line) => /\baddress(?:es)?\b/.test(line) && /persist\(|app\.log\.|errorLog|tell\(|audit\.append|\.query\(|writeFacts\(|JSON\.stringify|console\.|new \w*Error\(/.test(line))).toEqual([]);
  });

  it('the address reaches the plan frame and the open only: the plan goes to the plan builder\'s result, the worker start and the camera opens; the target goes to `openSource`; no line that logs, tells, audits or stores takes either', () => {
    const lines = codeLines(read(SESSION_FILE)).map((line) => line.trim());
    // The plan: built once, and named where its device IDs and tracks are read, where the worker is started, and where the cameras are opened.
    const planUses = lines.filter((line) => /\bplan\b/.test(line) && !/\bplan\.cameras\.map\(\(camera\) => (?:\[camera\.deviceId, camera\.trackId as VideoTrackId\]|camera\.deviceId)\)/.test(line) && !line.startsWith('for (const camera of plan.cameras)'));
    // Row 179: also where the addresses in force are first filled, and where the cameras are opened AGAIN for a later worker.
    expect(planUses).toEqual([
      'function openCameras(current: Live, registry: CaptureDeviceRegistry, plan: CapturePlan, round: CameraRound): Promise<void> {',
      'function cameraRoundAgain(current: Live, registry: CaptureDeviceRegistry, plan: CapturePlan): void {',
      'track(round.closing.then(() => openCameras(current, registry, plan, round)).then(round.settle));',
      'const plan: CapturePlan = buildCapturePlan({ selector: ready.selector, registry, cameras, mics, pcmTapPath });',
      'addressesInForce(new Map(plan.cameras.map((camera) => [camera.deviceId, camera.ingestUrl])));',
      'if (event.phase === CapturePhase.RECORDING && event.previous === CapturePhase.RESTARTING) cameraRoundAgain(current, registry, plan);',
      'await supervisor.start(sessionId, plan, { chance: randomBytes, renewed: (_attempt, addresses) => addressesInForce(addresses), sources: (attempt) => microphonesAgain(current, registry, ready, attempt) });',
      'void openCameras(current, registry, plan, first).then(first.settle);',
    ]);
    // The target: made at one line, used at one line.
    expect(lines.filter((line) => /\btarget\b/.test(line))).toEqual([
      "const target: CameraSourceTarget = { ingestUrl: address, sessionId, attempt: current.supervisor.status().attempt, ...(camera.profile === null ? {} : { profile: camera.profile }) };",
      "asked = Promise.resolve(registry.resolve('CAMERA', deviceId).openSource(deviceId, target, own?.signal ?? current.abort.signal));",
    ]);
    // The map the plan builder is given: filled at one line, handed to the builder, nothing else.
    expect(lines.filter((line) => /\bcameras\b/.test(line) && /persist\(|app\.log\.|tell\(|audit|query\(|writeFacts|JSON\.stringify/.test(line) && !/cameras: (?:inPlanOrder|opened|of\.files)/.test(line))).toEqual([]);
    // No line that says something to a log, the error log, a listener, the audit trail, a statement or a file names the address, the plan or the target.
    const sinks = lines.filter((line) => /persist\(|app\.log\.|errorLog|tell\(|audit\.append|\.query\(|writeFacts\(|JSON\.stringify|console\./.test(line));
    expect(sinks.length).toBeGreaterThan(40);
    expect(sinks.filter((line) => /\bingestUrl\b|\btarget\b|\bplan\b(?!\.cameras\.map)|camera\.ingestUrl/.test(line))).toEqual([]);
    // A camera of the plan is only ever read for its device, its track and its profile outside the target line.
    expect(lines.filter((line) => /\bcamera\.(?!deviceId|trackId|profile|ingestUrl)\w+/.test(line) && /plan\.cameras|const \{ deviceId \} = camera/.test(line))).toEqual([]);
  });

  it('a camera is opened in `begin` only, and `begin` runs only in the background after the commit of the start: never in the unit of the start', () => {
    const text = read(SESSION_FILE);
    const lines = codeLines(text).map((line) => line.trim());
    expect(lines.filter((line) => line.includes('.openSource('))).toHaveLength(1);
    // Two calls: in `begin` (the first worker of a session), and in `cameraRoundAgain` (row 179: a later worker), which runs
    // from the supervisor's phase event - a worker's acknowledgement after a back-off, never the unit of a start.
    expect(lines.filter((line) => /\bopenCameras\(/.test(line) && !line.startsWith('function openCameras('))).toEqual([
      'track(round.closing.then(() => openCameras(current, registry, plan, round)).then(round.settle));',
      'void openCameras(current, registry, plan, first).then(first.settle);',
    ]);
    expect(lines.filter((line) => /\bcameraRoundAgain\(/.test(line) && !line.startsWith('function cameraRoundAgain('))).toEqual(['if (event.phase === CapturePhase.RECORDING && event.previous === CapturePhase.RESTARTING) cameraRoundAgain(current, registry, plan);']);
    // (`begin(ready` is this unit's own function; the transcriber's `begin(sessionId)` is another one.)
    expect(lines.filter((line) => /\bbegin\(ready\b/.test(line) && !line.startsWith('async function begin('))).toEqual(["inBackground(sessionId, 'begin', () => begin(ready));"]);
    // The function that runs inside the unit of the start resolves no adapter and opens nothing.
    const inUnit = text.slice(text.indexOf('async function recordingStartedIn('), text.indexOf('// ── The start, after the commit'));
    expect(inUnit.length).toBeGreaterThan(1_000);
    expect(/openSource|openCameras|\.resolve\(|\bbegin\(|credential/i.test(inUnit)).toBe(false);
  });

  it('THE EXCEPTION, limited to the development operation: the local camera helper takes the address as the last word of its arguments; only development adapters reach it, and they are registered in the registry of REAL_DEVELOPMENT only', () => {
    // The argument (`camera-helper-args.ts`, the line the security check names): the address is the last word of the list.
    const pushLine = codeLines(read('capture/adapters/local/camera-helper-args.ts')).filter((line) => line.includes('input.ingestUrl]'));
    expect(pushLine).toHaveLength(1);
    expect(pushLine[0]).toMatch(/return Object\.freeze\(\[.*\.\.\.PUSH, input\.ingestUrl\]\);$/);
    // Who builds that list, and who starts a helper with it: the local helper file, used by the local adapter and by the generated source of the fence.
    const naming = (word: RegExp, skip: readonly string[] = []): string[] => productionSources().filter((path) => !skip.includes(path) && word.test(codeLines(read(path)).join('\n')));
    const BARREL = ['capture/adapters/local/index.ts'];
    expect(naming(/\bcameraPushArguments\b/, BARREL)).toEqual(['capture/adapters/local/camera-helper-args.ts', 'capture/adapters/local/camera-helper.ts']);
    expect(naming(/\bcreateCameraHelpers\b/, BARREL)).toEqual(['capture/adapters/local/camera-adapter.ts', 'capture/adapters/local/camera-helper.ts', 'capture/fence/generated-sources.ts', 'capture/fence/index.ts']);
    // The fence asks a helper for presence only (no push); the two adapters that push are made in the fence file and nowhere else.
    const fence = codeLines(read('capture/fence/index.ts'));
    expect(fence.filter((line) => line.includes('createCameraHelpers(')).map((line) => /\.presence\('LOCAL'\)/.test(line))).toEqual([true]);
    expect(naming(/\bcreateLocalCameraAdapter\(/)).toEqual(['capture/adapters/local/camera-adapter.ts', 'capture/fence/index.ts']);
    expect(naming(/\bcreateGeneratedCameraAdapter\(/)).toEqual(['capture/fence/generated-sources.ts', 'capture/fence/index.ts']);
    // In the fence file both are made inside the function that builds the registry of REAL_DEVELOPMENT, before the registry of production begins.
    const fenceText = read('capture/fence/index.ts');
    const development = fenceText.indexOf('createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_DEVELOPMENT');
    const production = fenceText.indexOf('createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION');
    expect(development).toBeGreaterThan(0);
    expect(production).toBeGreaterThan(development);
    for (const made of ['createLocalCameraAdapter({', 'createGeneratedCameraAdapter({']) {
      const at = fenceText.indexOf(made);
      expect(at > development && at < production).toBe(true);
      expect(fenceText.indexOf(made, at + 1)).toBe(-1);
    }
    // The worker's own argument list holds no address in any operation.
    for (const list of [captureWorkerArguments('/x/worker.jsonl'), captureWorkerArguments('/x/worker.jsonl', true)]) expect(list.filter((word) => /rtsp|127\.0\.0\.1/.test(word))).toEqual([]);
  });
});
