// Static guard: the development camera stub of a lane stays a development tool (fix wave H,
// driver D; gate 70 finding B-1; decision D196; test strategy CR-5; SEC35-27 (6), SEC35-41 (a)).
//
//   1. NO PRODUCTION SOURCE CAN LOAD IT. No file under `src/` (tests apart) imports the launcher,
//      the stub or anything else under `test/` (rule CPB1-12 holds that server-wide; here it is
//      held for these files BY NAME, comments apart), and none names the launcher's npm script.
//      The product's entry point `src/index.ts` names none of them even in a comment.
//   2. ONE PROGRAM STARTS IT. The launcher program is the only file of the workspace that calls
//      `prepareLaneCameraStub`, tests apart; the workspace has exactly one script that runs it.
//   3. THE LAUNCHER STARTS THE SAME CORE. Its start order is the entry point's, line for line:
//      ready, boot, capture boot, ONE listener on the constant host. It asks the fence before
//      `app.ready()`, and a refusal of the fence ends in the boot's own final line.
//   4. THE LANE SCRIPT. `scripts/lane/lane.sh` runs the launcher only in the branch of
//      `--with-camera-stub`; every other start is the product's `start:server`. It sets no
//      attendance variable and hands the launcher no address, no port and no credential.
//
// Every rule has a control: the same reader, on a planted text, reads the other value.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY, WORKSPACE, codeOnly, isProductionSource, readTree, type SourceFile } from './scan';

const LAUNCHER = 'test/support/lane-camera-stub-cli.ts';
const LIBRARY = 'test/support/lane-camera-stub.ts';
const SCRIPT_NAME = ['start', ['camera', 'stub'].join('-')].join(':');
/** The names a production source must not hold: the two files, the stub, the script. Built from fragments. */
const NAMES = new RegExp([['lane', 'camera', 'stub'].join('-'), ['fake', 'onvif', 'stub'].join('-'), ['prepare', 'Lane', 'Camera', 'Stub'].join(''), SCRIPT_NAME].join('|'));
const PREPARE_CALL = new RegExp(`\\b${['prepare', 'Lane', 'Camera', 'Stub'].join('')}\\s*\\(`);

const tree = readTree(WORKSPACE);
const production = tree.filter((file) => isProductionSource(file.path));
const text = (path: string): string => tree.find((file) => file.path === path)?.text ?? '';
const naming = (files: readonly SourceFile[], pattern: RegExp): string[] => files.filter((file) => pattern.test(file.text)).map((file) => file.path);

describe('rule 1: no production source can load the camera stub', () => {
  it('finds a production file that names it (control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/capture/fence/x.ts', text: `import { ${['prepare', 'Lane', 'Camera', 'Stub'].join('')} } from '../../../test/support/${['lane', 'camera', 'stub'].join('-')}';` },
      { path: 'src/modules/y.ts', text: '// a comment may say that the fake ONVIF stub exists\nexport const a = 1;' },
    ];
    expect(naming(codeOnly(planted), NAMES)).toEqual(['src/capture/fence/x.ts']);
  });

  it('no file under src/ names the launcher, its library, the stub or the script in code; the entry point names none of them at all', () => {
    expect(production.length).toBeGreaterThan(200);
    expect(naming(codeOnly(production), NAMES)).toEqual([]);
    expect(NAMES.test(text('src/index.ts'))).toBe(false);
    expect(NAMES.test(text('src/app.ts'))).toBe(false);
    expect(NAMES.test(text('src/config.ts'))).toBe(false);
  });
});

describe('rule 2: one program starts it', () => {
  it('the launcher is the only caller outside the tests, and the workspace has one script that runs it', () => {
    const callers = naming(codeOnly(tree.filter((file) => file.path.endsWith('.ts') && !file.path.endsWith('.test.ts') && file.path !== LIBRARY)), PREPARE_CALL);
    expect(callers).toEqual([LAUNCHER]);
    const scripts = (JSON.parse(text('package.json')) as { scripts: Record<string, string> }).scripts;
    expect(Object.entries(scripts).filter(([, command]) => command.includes('lane-camera-stub'))).toEqual([[SCRIPT_NAME, `tsx ${LAUNCHER}`]]);
    // The product's start is untouched.
    expect(scripts['start']).toBe('tsx src/index.ts');
  });
});

describe('rule 3: the launcher starts the same Core', () => {
  const START_ORDER = ['await app.ready();', 'await app.readiness.boot();', 'await app.capture.boot();', 'await app.listen({ host: LISTEN_HOST, port: config.port });'];
  const orderOf = (source: string): number[] => START_ORDER.map((line) => source.indexOf(line));
  const inOrder = (positions: readonly number[]): boolean => positions.every((position, index) => position >= 0 && (index === 0 || position > (positions[index - 1] ?? -1)));

  it('reads a start order that is out of step (control)', () => {
    expect(inOrder(orderOf(START_ORDER.join('\n')))).toBe(true);
    expect(inOrder(orderOf([START_ORDER[1], START_ORDER[0], START_ORDER[2], START_ORDER[3]].join('\n')))).toBe(false);
    expect(inOrder(orderOf(START_ORDER.slice(0, 3).join('\n')))).toBe(false);
  });

  it('the entry point and the launcher hold the same four steps in the same order, each once; the launcher has one listener, on the constant host', () => {
    const entry = text('src/index.ts');
    const launcher = text(LAUNCHER);
    expect(inOrder(orderOf(entry))).toBe(true);
    expect(inOrder(orderOf(launcher))).toBe(true);
    for (const line of START_ORDER) expect(launcher.split(line).length - 1, line).toBe(1);
    expect([...launcher.matchAll(/\.listen\s*\(/g)]).toHaveLength(1);
    // The same configuration loader and the same app factory, with the same error log.
    for (const shared of ["config = loadConfig({ env: process.env });", 'const app = buildApp({ config, errorLogFile: DEFAULT_ERROR_LOG_FILE });', 'removeDriverEnvironment(process.env)']) {
      expect(entry, shared).toContain(shared);
      expect(launcher, shared).toContain(shared);
    }
  });

  it('the fence is asked before app.ready(), the factory is handed in right after it, and a refusal ends in the boot\'s final line with its check and code', () => {
    const launcher = text(LAUNCHER);
    const prepare = launcher.indexOf('await prepareLaneCameraStub(app, files);');
    const ready = launcher.indexOf('await app.ready();');
    const announce = launcher.indexOf('cameraStub.announce();');
    const boot = launcher.indexOf('await app.readiness.boot();');
    expect(prepare).toBeGreaterThan(0);
    expect(prepare < ready && ready < announce && announce < boot).toBe(true);
    expect(launcher).toContain("if (error instanceof DevelopmentDiscoveryError) fatal('boot', error, { check: LANE_CAMERA_STUB_CHECK, code: error.code });");
    // The library asks the fence's one function with the one decision of the capture operation, and nothing else decides.
    const library = text(LIBRARY);
    expect(library).toContain('developmentDiscoveryAdmissionOf(captureOperationDecisionOf(app.config), true)');
    expect(library.indexOf('developmentDiscoveryAdmissionOf(')).toBeLessThan(library.indexOf('createFakeOnvifStub('));
    expect(library).not.toMatch(/process\s*\.\s*env/);
    // It takes no address and no port from outside: the stub's own constant host and the system's ephemeral ports.
    expect(library).toContain('const ports = await freeFakeOnvifPorts();');
  });
});

describe('rule 4: the lane script', () => {
  const lane = readFileSync(join(REPOSITORY, 'scripts/lane/lane.sh'), 'utf8');
  /** The lines of the script that are commands, not comments. */
  const commands = (source: string): string[] => source.split('\n').filter((line) => !line.trim().startsWith('#'));
  const running = (source: string): string[] => commands(source).filter((line) => line.includes(`npm run -s ${SCRIPT_NAME}`));

  it('reads a script that runs the launcher outside the option (control)', () => {
    const planted = `  ( cd "$ROOT" && nohup env $LANE_ENV npm run -s ${SCRIPT_NAME} -w @dems/core-server >"$LOG" 2>&1 & )\n`;
    expect(running(planted)).toHaveLength(1);
    expect(running(`# npm run -s ${SCRIPT_NAME}\n`)).toEqual([]);
  });

  it('the launcher is run in ONE place, inside the branch of --with-camera-stub; the other start is the product\'s; the option is the only third argument of start', () => {
    const lines = commands(lane);
    expect(running(lane)).toHaveLength(1);
    const at = lines.findIndex((line) => line.includes(`npm run -s ${SCRIPT_NAME}`));
    const opened = lines.slice(0, at).map((line) => line.trim()).lastIndexOf('if [ "$2" = --with-camera-stub ]; then');
    const otherwise = lines.slice(at).findIndex((line) => line.trim() === 'else');
    expect(opened).toBeGreaterThan(0);
    // Nothing closes the branch between its opening and the launcher's line.
    expect(lines.slice(opened, at).some((line) => /^\s*(?:fi|else)\b/.test(line))).toBe(false);
    expect(otherwise).toBeGreaterThan(0);
    expect(lines.slice(at + otherwise).find((line) => line.includes('npm run -s'))).toContain('npm run -s start:server >"$LOG"');
    expect(lane).toContain('--with-camera-stub) [ -z "$START_STUB" ] || usage; START_STUB=$option ;;');
    expect(lane).toContain('cmd_start "$START_LANE" "$START_STUB" ;;');
    // What the launcher is handed: two file paths under .locks/, nothing else.
    expect(running(lane)[0]).toMatch(/-- --fixture-file "\$STUB_FIXTURE" --mode-file "\$STUB_MODE" >"\$LOG" 2>&1 & \)$/);
    expect(lane).toContain('STUB_FIXTURE="$LOCKS/camera-stub.lane$1.fixture"; STUB_MODE="$LOCKS/camera-stub.lane$1.mode"');
  });

  it('it still sets no attendance variable and unsets the capture family before it writes the plan of the lane', () => {
    const lines = commands(lane).join('\n');
    expect(lines).not.toMatch(/DEMS_(?:LOCAL_SESSION|USER)_ATTENDED=/);
    expect(lines).toContain('-u DEMS_LOCAL_SESSION_ATTENDED -u DEMS_USER_ATTENDED');
    // No variable of the environment carries the stub: the option is an argument of the script, and the launcher is another program.
    expect(lines).not.toMatch(/DEMS_[A-Z_]*STUB[A-Z_]*=/);
  });

  it('--speech-mic (ruling D198): the variable is unset for every lane, set only inside the development branch with the option, and the option is refused on a lane that is not development capture', () => {
    const lines = commands(lane).join('\n');
    expect(lines).toContain('-u DEMS_CAPTURE_DEV_FAKE_MIC');
    expect(lines.split('DEMS_CAPTURE_DEV_FAKE_MIC=speech').length - 1).toBe(1);
    const branch = lines.slice(lines.indexOf('if [ "$MODE" = REAL_DEVELOPMENT ]; then\n    set --'));
    expect(branch.indexOf('DEMS_CAPTURE_DEV_FAKE_MIC=speech')).toBeGreaterThan(0);
    expect(branch.indexOf('DEMS_CAPTURE_DEV_FAKE_MIC=speech')).toBeLessThan(branch.indexOf('\n  fi'));
    expect(lines).toContain('if [ "${SPEECH_MIC:-}" = --speech-mic ] && [ "$MODE" != REAL_DEVELOPMENT ]; then');
  });
});
