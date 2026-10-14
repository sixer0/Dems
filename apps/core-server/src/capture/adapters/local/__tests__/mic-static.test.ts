// Static rules of the microphone helper (blueprint row 135; capture spec §G.1 G-R6, G-R12, G-R14;
// checks M4-SEC-HELPER-1, M4-SEC-PRIV-1; R-11 AC-5, AC-8, AC-9). They cover the files this row owns -
// `mic-*.ts` and `pipe-files.ts` of `adapters/local/` - and, for the one rule that is the folder's
// (a local device is never replaced by a fake), every production file of the folder. Each rule has a
// planted source that must be found.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../../../test/static/scan';

const FOLDER = 'src/capture/adapters/local/';
const production = codeOnly(readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts')));
const folder = production.filter((file) => file.path.startsWith(FOLDER));
const mic = folder.filter((file) => /\/(?:mic-[a-z-]+|pipe-files)\.ts$/.test(file.path));

const join = (...parts: string[]): string => parts.join('');
const moduleImport = (names: readonly string[]): RegExp => new RegExp(`['"](?:node:)?(?:${names.join('|')})(?:/[a-z]+)?['"]`, 'g');
const PROCESS_MODULE = moduleImport([join('child', '_process')]);
const FILE_SYSTEM = moduleImport(['fs']);
const SOCKET_OR_THREAD = moduleImport(['net', 'dgram', 'tls', 'http', 'https', 'http2', join('worker', '_threads'), 'cluster']);
const PROCESS_START = new RegExp(`(?<![.\\w$])(?:${['spawn', 'spawnSync', 'fork', 'exec', 'execSync', 'execFile', 'execFileSync'].join('|')})\\s*\\(`, 'g');
const GLOBAL_TIMER = new RegExp(`\\b(?:set|clear)(?:${['Interval', 'Timeout', 'Immediate'].join('|')})\\s*\\(`, 'g');
const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\b`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`].join('|'), 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b`, 'g');
const RANDOM = new RegExp([`\\bMath\\s*\\.\\s*${'random'}\\b`, `\\brandom${'UUID'}\\b`, `['"](?:node:)?${'crypto'}['"]`].join('|'), 'g');
const LOG_CALL = /\b(?:log|logger|app\.log)\s*\.\s*(?:trace|debug|info|warn|error|fatal)\s*\(|\bconsole\s*\.\s*\w+\s*\(|errorLog\s*\.\s*append/g;
/** A function of the file system that writes, moves, copies or opens a file; the pipe door owns the four it needs. */
const FILE_WRITER = new RegExp(`\\b(?:write${'File'}|append${'File'}|createWrite${'Stream'}|copy${'File'}|rename|chmod|chown|truncate|symlink|link|rm|rmdir|open|write|mkdtemp)Sync\\s*\\(|\\b(?:write${'File'}|append${'File'}|createWrite${'Stream'}|copy${'File'}|chmod|chown|symlink)\\s*\\(`, 'g');
const NETWORK_TEXT = /0\.0\.0\.0|\bINADDR_ANY\b|\bnet\.createServer\b|\bdgram\b|rtsp:\/\/|-rtsp_flags|\blisten\b/gi;
/** Anything that reaches the macOS permission database or the system settings (R-11 AC-9; D74 (3)). */
const PERMISSION_TOOL = new RegExp([`tccu${'til'}`, `TCC\\.${'db'}`, `sqlite${'3'}`, `osa${'script'}`, `System ${'Settings'}`, `System ${'Preferences'}`, `defaults ${'write'}`, `\\bopen\\s+-b\\b`, `x-apple\\.system${'preferences'}`].join('|'), 'gi');
const FAKE_IMPORT = /from\s+['"](?:\.\.?\/)+(?:fake|\.\.\/fake)(?:\/[^'"]*)?['"]|createFake\w*|\bFakeTopology\b|FAKE_MIC|from\s+['"][^'"]*\/fake\/[^'"]*['"]/g;

const places = (files: readonly SourceFile[], pattern: RegExp): string[] => [...new Set(occurrences(files, pattern).map((place) => place.replace(/:\d+$/, '')))];

/** Row N10: THE KEEPER'S ONE OPEN, by its text - for reading, without waiting for a writer. */
const KEEPER_OPEN = 'openSync(path, constants.O_RDONLY | constants.O_NONBLOCK)';
/** Every open that is not that one; every write, creation, truncation or flag of writing. */
const keeperViolations = (text: string): string[] => [
  ...[...text.matchAll(/\bopenSync\([^)]*\)/g)].map((match) => match[0]).filter((call) => call !== KEEPER_OPEN).map((call) => `an open that is not the keeper's: ${call}`),
  ...[...text.matchAll(/\b(?:writeSync|writevSync|ftruncateSync)\(|\bO_(?:WRONLY|RDWR|CREAT|APPEND|TRUNC)\b/g)].map((match) => `a write, a creation or a flag of writing: ${match[0]}`),
];

describe('the scan itself', () => {
  it('reads exactly the microphone files of this row', () => {
    expect(mic.map((file) => file.path.slice(FOLDER.length))).toEqual(['mic-adapter.ts', 'mic-helper-args.ts', 'mic-helper.ts', 'mic-pipe.ts', 'pipe-files.ts']);
    expect(folder.length).toBeGreaterThan(mic.length);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `import { spawn } from 'node:${join('child', '_process')}';\nconst child = spawn('x');\nexecFile('y');\nconst m = PATTERN.exec(text);` },
      { path: 'b.ts', text: `import { lstatSync } from 'node:${'fs'}';\nimport { x } from '${'fs'}/promises';` },
      { path: 'c.ts', text: `import net from 'node:${'net'}';\nimport d from 'node:${'dgram'}';` },
      { path: 'd.ts', text: `set${'Timeout'}(later, 50);\nconst t = Date.${'now'}();\nconst u = new Date();` },
      { path: 'e.ts', text: `const mode = process.${'env'}.HOME;\nMath.${'random'}();` },
      { path: 'f.ts', text: `app.log.info({ a: 1 }, 'x');\nconsole.error('y');` },
      { path: 'g.ts', text: `writeFileSync(path, data);\nconst h = openSync(path);\nrmSync(path);\ncreateWrite${'Stream'}(path);` },
      { path: 'h.ts', text: `const args = ['-listen', '1', 'rtsp://127.0.0.1:8554/x', '0.0.0.0'];` },
      { path: 'i.ts', text: `run('tccu${'til'} reset Microphone');\nrun('osa${'script'} -e x');\nconst db = 'TCC.${'db'}';` },
      { path: 'j.ts', text: `import { createFakeAudioInputAdapter } from '../fake/audio';\nimport { x } from '../../fake';\nconst standby = FAKE_MIC_STANDBY_DBFS;` },
    ];
    expect(places(planted, PROCESS_MODULE)).toEqual(['a.ts']);
    expect(occurrences(planted, PROCESS_START)).toEqual(['a.ts:2', 'a.ts:3']);
    expect(places(planted, FILE_SYSTEM)).toEqual(['b.ts']);
    expect(places(planted, SOCKET_OR_THREAD)).toEqual(['c.ts']);
    expect(occurrences(planted, GLOBAL_TIMER)).toEqual(['d.ts:1']);
    expect(occurrences(planted, SYSTEM_TIME)).toEqual(['d.ts:2', 'd.ts:3']);
    expect(places(planted, ENVIRONMENT)).toEqual(['e.ts']);
    expect(places(planted, RANDOM)).toEqual(['e.ts']);
    expect(places(planted, LOG_CALL)).toEqual(['f.ts']);
    expect(occurrences(planted, FILE_WRITER)).toEqual(['g.ts:1', 'g.ts:2', 'g.ts:3', 'g.ts:4']);
    expect(places(planted, NETWORK_TEXT)).toEqual(['c.ts', 'h.ts']);
    expect(occurrences(planted, PERMISSION_TOOL).length).toBeGreaterThanOrEqual(3);
    expect(places(planted, PERMISSION_TOOL)).toEqual(['i.ts']);
    expect(occurrences(planted, FAKE_IMPORT).length).toBeGreaterThanOrEqual(3);
    expect(places(planted, FAKE_IMPORT)).toEqual(['j.ts']);
  });
});

describe('G-R6, G-R12: the microphone files start no process of their own and touch the file system in one place', () => {
  it('none imports the process module or starts a process: the door of the folder is the only one', () => {
    expect(places(mic, PROCESS_MODULE)).toEqual([]);
    expect(occurrences(mic, PROCESS_START)).toEqual([]);
  });

  // WIDENED BY ROW N10 (decision C118 (1); request line 552 of row N9): the product's pipe keeper lives in this one file and adds
  // exactly three calls - open (for reading, NON-BLOCKING), read, close - and the flag constants of the open. Nothing else.
  it('only pipe-files.ts imports the file system, and it names exactly lstat, mkdir, realpath and unlink - and the keeper\'s open, read and close (row N10)', () => {
    expect(places(mic, FILE_SYSTEM)).toEqual([`${FOLDER}pipe-files.ts`]);
    const text = mic.find((file) => file.path === `${FOLDER}pipe-files.ts`)?.text ?? '';
    const imported = /import\s*\{([^}]*)\}\s*from\s*'node:fs'/.exec(text)?.[1]?.split(',').map((name) => name.trim()).sort();
    expect(imported).toEqual(['closeSync', 'constants', 'lstatSync', 'mkdirSync', 'openSync', 'readSync', 'realpathSync', 'unlinkSync']);
    expect(keeperViolations(text)).toEqual([]);
    expect(text.match(/\b(?:openSync|readSync|closeSync)\(/g)).toEqual(['openSync(', 'readSync(', 'closeSync(']);
  });

  it('finds an open for writing, a blocking open and a write in a planted keeper (control)', () => {
    expect(keeperViolations('const a = openSync(path, constants.O_RDWR | constants.O_NONBLOCK);')).toEqual(['an open that is not the keeper\'s: openSync(path, constants.O_RDWR | constants.O_NONBLOCK)', 'a write, a creation or a flag of writing: O_RDWR']);
    expect(keeperViolations('const a = openSync(path, constants.O_RDONLY);')).toEqual(['an open that is not the keeper\'s: openSync(path, constants.O_RDONLY)']);
    expect(keeperViolations("writeSync(descriptor, data);\nconst b = openSync(path, 'w');")).toEqual(["an open that is not the keeper's: openSync(path, 'w')", 'a write, a creation or a flag of writing: writeSync(']);
    expect(keeperViolations('openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);')).toEqual([]);
  });

  it('no microphone file writes, moves, copies or links a file, and none opens one but the keeper\'s ONE open of a pipe for reading: the pipe is made by mkfifo, through the door', () => {
    // `remove(…)`/`unlinkSync` is the pipe's own removal; nothing else is a writer. Row N10: the keeper's open is the one match of the
    // pattern (it names `open` among the writers), pinned by its text above.
    expect(occurrences(mic, FILE_WRITER).map((place) => place.replace(/:\d+$/, ''))).toEqual([`${FOLDER}pipe-files.ts`]);
  });

  it('only the argument table names the device layer; nothing outside it composes an argument list for FFmpeg', () => {
    expect(places(mic, /avfoundation/g)).toEqual([`${FOLDER}mic-helper-args.ts`]);
    expect(places(mic, /-loglevel|-flush_packets|pcm_f32le/g)).toEqual([`${FOLDER}mic-helper-args.ts`]);
  });
});

describe('G-R4, G-R8, SEC35-23: no log, no time, no timer, no environment, no chance, no socket, no listen', () => {
  it('holds for every microphone file', () => {
    expect(occurrences(mic, LOG_CALL)).toEqual([]);
    expect(occurrences(mic, SYSTEM_TIME)).toEqual([]);
    expect(occurrences(mic, GLOBAL_TIMER)).toEqual([]);
    expect(occurrences(mic, ENVIRONMENT)).toEqual([]);
    expect(occurrences(mic, RANDOM)).toEqual([]);
    expect(occurrences(mic, SOCKET_OR_THREAD)).toEqual([]);
    expect(occurrences(mic, NETWORK_TEXT)).toEqual([]);
  });
});

describe('R-11 AC-9 / D74 (3): no file reaches the permission database or the system settings', () => {
  it('holds for every production file of the folder', () => {
    expect(occurrences(folder, PERMISSION_TOOL)).toEqual([]);
  });
});

describe('G-R14, R-11 AC-5: a local device is never replaced by a fake', () => {
  it('no production file of the folder imports a fake adapter or builds one', () => {
    expect(occurrences(folder, FAKE_IMPORT)).toEqual([]);
  });
});
