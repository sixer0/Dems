// The static rule of `apps/transcriber` (test strategy §C; SEC35-14; D7(d); D230). The real tree
// has no violation, and every rule is shown RED on a planted one: a rule that cannot fail proves
// nothing (audit rule 3). Every planted case is an in-memory source text handed to the rule
// engine; nothing is planted on disk.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CPU_LOCAL, KEY_LOADER, MEDIA_TIME, OMLX_HTTP, PHYSICAL_CORES, REQUIRED_IDS, RULE_IDS, isTestFile, scanSources, type SourceFile } from './static-rules';

const WORKSPACE = resolve(import.meta.dirname, '..', '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules') return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function readTree(): SourceFile[] {
  return [join(WORKSPACE, 'src'), join(WORKSPACE, 'test')]
    .flatMap(walk)
    .filter((path) => path.endsWith('.ts'))
    .map((path) => ({ path: relative(WORKSPACE, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** A clean stand-in for the files the REQUIRED rules look into. */
const CLEAN_CPU_LOCAL = [
  "export const NO_GPU_FLAG = '-ng';",
  'export function buildWhisperCliArgs(config: C): string[] {',
  "  const args = ['-m', config.modelPath, NO_GPU_FLAG, '-t', String(1)];",
  '  return args;',
  '}',
  'function runEngine(): void {',
  "  spawn(nicePath, args, { stdio: ['ignore', 'ignore', 'pipe'], shell: false, env: ENGINE_ENVIRONMENT });",
  '}',
  '',
].join('\n');
const CLEAN_OMLX_HTTP = ['export function createOmlxHttp(options: O): void {', '  assertLoopbackEndpoint(options.endpoint);', "  const init = { redirect: 'error' };", '}', ''].join('\n');
const CLEAN_MEDIA_TIME = ["import { CAPTURE_AUDIO_SAMPLE_RATE_HZ, CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES } from '@dems/shared/api';", 'export const origin = CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES;', ''].join('\n');
const CLEAN: SourceFile[] = [
  { path: MEDIA_TIME, text: CLEAN_MEDIA_TIME },
  { path: CPU_LOCAL, text: CLEAN_CPU_LOCAL },
  { path: OMLX_HTTP, text: CLEAN_OMLX_HTTP },
  { path: KEY_LOADER, text: 'export const x = 1;\n' },
];

/** The rules reported for `text` planted as `path`. A file of CLEAN keeps its clean text and gets the planted lines appended. */
function planted(path: string, text: string): string[] {
  const base = CLEAN.find((file) => file.path === path);
  const file = { path, text: base === undefined ? text : `${base.text}${text}\n` };
  return [...new Set(scanSources([...CLEAN.filter((entry) => entry.path !== path), file]).map((violation) => violation.rule))].sort();
}

describe('static rule: the real tree', () => {
  const tree = readTree();
  const production = tree.filter((file) => !isTestFile(file.path)).map((file) => file.path);

  it('scans the production files of the workspace: the list is pinned, so an empty scan cannot pass', () => {
    expect(production).toEqual([
      'src/adapter.ts',
      'src/backends/cpu-local.ts',
      'src/backends/omlx-http.ts',
      'src/backends/omlx-server.ts',
      'src/config.ts',
      'src/cpu-priority.ts',
      'src/fixtures/tts-fixture-provider.ts',
      'src/host/physical-cores.ts',
      'src/index.ts',
      'src/key-loader.ts',
      'src/log.ts',
      'src/pipeline/assembly.ts',
      'src/pipeline/audio-source.ts',
      'src/pipeline/checkpoint.ts',
      'src/pipeline/chunker.ts',
      'src/pipeline/clamp.ts',
      'src/pipeline/constants.ts',
      'src/pipeline/diarization.ts',
      'src/pipeline/document.ts',
      'src/pipeline/media-time.ts',
      'src/pipeline/mirror.ts',
      'src/pipeline/runner.ts',
      'src/pipeline/silero-vad.ts',
      'src/probe.ts',
      'src/types.ts',
      'src/wav.ts',
    ]);
    expect(tree.filter((file) => isTestFile(file.path)).length).toBeGreaterThanOrEqual(12);
  });

  it('has no violation', () => {
    expect(scanSources(tree)).toEqual([]);
  });

  it('every file of the tree parses without a syntax error (a file the parser cannot read is a violation, never a pass)', () => {
    expect(scanSources([...CLEAN, { path: 'src/broken.ts', text: 'const = ;; {{{' }]).map((violation) => violation.rule)).toContain('UNPARSEABLE_SOURCE');
  });
});

describe('static rule: the navigator probes of fix round 1 (N-1), each one red', () => {
  it('the clean stand-in tree itself has no violation (the control of every case below)', () => {
    expect(scanSources(CLEAN)).toEqual([]);
  });

  // The six violations of the navigator's planted file, then the rest of the eleven single-line probes.
  const probes: readonly (readonly [string, string, string, readonly string[]])[] = [
    ['K: a token printed to stderr', 'src/adapter.ts', 'process.stderr.write(bearer);', ['STDERR_ONLY_IN_LOG']],
    ['B: code after // inside a string', 'src/adapter.ts', "const a = 'x//'; console.log(secret); fetch(a);", ['FETCH_ONLY_IN_HTTP_CLIENT', 'NO_CONSOLE']],
    ['A: an unquoted Authorization key', 'src/probe.ts', 'const init = { headers: { Authorization: token } };', ['AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT']],
    ['C: http without the node: prefix', 'src/probe.ts', "import { request } from 'http';\nrequest({ host: remote });", ['NO_NETWORK_MODULE']],
    ['D: child_process without the node: prefix', 'src/adapter.ts', "import { exec } from 'child_process';", ['CHILD_PROCESS_ONLY_IN_ENGINE_MODULES', 'NO_SHELL']],
    ['E: the environment by bracket', 'src/config.ts', "const k = process['env']['OMLX_API_KEY'];", ['NO_ENVIRONMENT_READ']],
    ['F: fetch through an alias', 'src/probe.ts', 'const f = globalThis.fetch; await f(url);', ['FETCH_ONLY_IN_HTTP_CLIENT']],
    ['G: the settings path by concatenation', 'src/probe.ts', "const p = join(homedir(), '.om' + 'lx', 'settings' + '.json');", ['HOME_DIRECTORY_ONLY_IN_KEY_LOADER', 'KEY_FILE_ONLY_IN_KEY_LOADER']],
    ['H: the environment by import', 'src/config.ts', "import { env } from 'node:process'; const k = env.OMLX_API_KEY;", ['NO_ENVIRONMENT_READ']],
    ['I: a net client on the port', 'src/probe.ts', "import net from 'net'; net.createConnection(8e3);", ['NO_NETWORK_MODULE', 'NO_PORT_8000_LITERAL']],
    ['J: a plain second reader', 'src/probe.ts', "const k = JSON.parse(readFileSync(homedir() + '/.omlx/settings.json', 'utf8')).auth.api_key;", ['HOME_DIRECTORY_ONLY_IN_KEY_LOADER', 'KEY_FILE_ONLY_IN_KEY_LOADER']],
  ];

  it.each(probes)('%s', (_name, path, text, rules) => {
    expect(planted(path, text)).toEqual([...rules].sort());
  });

  it('the six violations in ONE file, as the navigator planted them, are all reported', () => {
    const file = [
      "import { request } from 'http';",
      "import { exec } from 'child_process';",
      'process.stderr.write(token);',
      "const a = 'x//'; console.log(secret); fetch(a);",
      'request({ host: remote, headers: { Authorization: token } });',
      "const k = process['env']['OMLX_API_KEY'];",
    ].join('\n');
    expect(planted('src/planted-by-navigator.ts', file)).toEqual([
      'AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT',
      'CHILD_PROCESS_ONLY_IN_ENGINE_MODULES',
      'FETCH_ONLY_IN_HTTP_CLIENT',
      'NO_CONSOLE',
      'NO_ENVIRONMENT_READ',
      'NO_NETWORK_MODULE',
      'NO_SHELL',
      'STDERR_ONLY_IN_LOG',
    ]);
  });

  it('the same six lines appended to an EXISTING production file are reported too (no new file needed)', () => {
    expect(planted(OMLX_HTTP, "const a = 'x//'; console.log(secret);\nprocess.stderr.write(token);\nconst k = process['env'];")).toEqual(['NO_CONSOLE', 'NO_ENVIRONMENT_READ', 'STDERR_ONLY_IN_LOG']);
  });

  it('the three violations of the first on-disk demonstration (a second key reader that prints a header)', () => {
    const file = [
      "import { readFileSync } from 'node:fs';",
      "import { homedir } from 'node:os';",
      "const key = JSON.parse(readFileSync(homedir() + '/.omlx/settings.json', 'utf8')).auth.api_key;",
      "console.log('Authorization', 'Bearer ' + key);",
    ].join('\n');
    expect(planted('src/planted-violation.ts', file)).toEqual(['AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT', 'HOME_DIRECTORY_ONLY_IN_KEY_LOADER', 'KEY_FILE_ONLY_IN_KEY_LOADER', 'NO_CONSOLE']);
  });
});

describe('static rule: the four plain evasions of the navigator re-check (fix round 2, R-2), each one red', () => {
  const evasions: readonly (readonly [string, string, string, readonly string[]])[] = [
    ['a1: an alias of process, then .env', 'src/config.ts', 'const p = process; const k = p.env.OMLX_API_KEY;', ['PROCESS_OBJECT_IS_NOT_PASSED_AROUND']],
    ['a2: Reflect.get(process, "env")', 'src/config.ts', "const k = Reflect.get(process, 'env');", ['PROCESS_OBJECT_IS_NOT_PASSED_AROUND']],
    ['a3: an alias through globalThis', 'src/config.ts', "const p = globalThis['process']; const k = p.env;", ['PROCESS_OBJECT_IS_NOT_PASSED_AROUND']],
    ['a4: process in an object or a list', 'src/config.ts', 'const box = { process }; const list = [process];', ['PROCESS_OBJECT_IS_NOT_PASSED_AROUND']],
    ['b1: createRequire(...)("http")', 'src/probe.ts', "import { createRequire } from 'node:module'; const http = createRequire(import.meta.url)('http');", ['NO_DYNAMIC_CODE']],
    ['b2: process.mainModule.require', 'src/probe.ts', "const http = process.mainModule.require('http');", ['NO_DYNAMIC_CODE']],
    ['b3: module without the prefix', 'src/probe.ts', "const m = require('module');", ['NO_DYNAMIC_CODE']],
    ['c1: writeSync(1, token)', 'src/adapter.ts', "import { writeSync } from 'node:fs'; writeSync(1, token);", ['NO_DIRECT_OUTPUT']],
    ['c2: fs.writeSync(2, token)', 'src/adapter.ts', "import * as fs from 'node:fs'; fs.writeSync(2, token);", ['NO_DIRECT_OUTPUT']],
    ['c3: fs.write(2, …) and a bracket call', 'src/adapter.ts', "fs.write(2, token, done); fs['writeSync'](1, token);", ['NO_DIRECT_OUTPUT']],
    ['c4: process.emitWarning(token)', 'src/adapter.ts', 'process.emitWarning(token);', ['NO_DIRECT_OUTPUT']],
    ['c5: a write stream on a standard descriptor', 'src/adapter.ts', "createWriteStream('', { fd: 2 }).write(token);", ['NO_DIRECT_OUTPUT']],
    ['d1: node:inspector open()', 'src/probe.ts', "import { open } from 'node:inspector'; open(0);", ['NO_NETWORK_MODULE']],
    ['d2: inspector/promises without the prefix', 'src/probe.ts', "const i = await import('inspector/promises');", ['NO_NETWORK_MODULE']],
  ];

  it.each(evasions)('%s', (_name, path, text, rules) => {
    expect(planted(path, text)).toEqual([...rules].sort());
  });

  it('negative control: the uses this workspace does make are not violations', () => {
    expect(planted('src/backends/omlx-server.ts', 'const node = process.execPath; const v = process.version;')).toEqual([]);
    expect(planted('src/log.ts', 'process.stderr.write(line);')).toEqual([]);
    expect(planted('src/wav.ts', "import { writeSync, openSync } from 'node:fs'; const fd = openSync(path, 'w'); writeSync(fd, bytes); out.write(bytes);")).toEqual([]);
  });
});

describe('static rule: other ways round a text pattern, each one red', () => {
  const cases: readonly (readonly [string, string, string])[] = [
    ['KEY_FILE_ONLY_IN_KEY_LOADER', 'src/__tests__/some.test.ts', "readFileSync(home + '/.omlx/settings.json');"],
    ['KEY_FILE_ONLY_IN_KEY_LOADER', 'src/probe.ts', 'const p = `${home}/.omlx/x`;'],
    ['HOME_DIRECTORY_ONLY_IN_KEY_LOADER', 'src/probe.ts', "import * as os from 'node:os'; const h = os['homedir']();"],
    ['HOME_DIRECTORY_ONLY_IN_KEY_LOADER', 'src/probe.ts', "const p = '/Users/someone/x';"],
    ['CREDENTIAL_TEXT_ONLY_IN_HTTP_CLIENT', 'src/adapter.ts', 'log.info({ source: "x", message: bearerHeaderValue(credential) });'],
    ['CREDENTIAL_TEXT_ONLY_IN_HTTP_CLIENT', 'src/adapter.ts', 'const reveal = bearerHeaderValue;'],
    ['AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT', 'src/backends/omlx-server.ts', "headers.set('Authorization', value);"],
    ['AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT', 'src/backends/omlx-server.ts', "headers['AUTHORIZATION'] = value;"],
    ['AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT', 'src/backends/omlx-server.ts', "headers.set('Author' + 'ization', value);"],
    ['AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT', 'src/backends/omlx-server.ts', "const h = { 'x-api-key': value };"],
    ['NO_CONSOLE', 'src/backends/omlx-server.ts', 'console.log(headers);'],
    ['NO_CONSOLE', 'src/backends/omlx-server.ts', "globalThis['console'].error(headers);"],
    ['NO_CONSOLE', 'src/backends/omlx-server.ts', 'const { log } = console; log(headers);'],
    ['NO_CONSOLE', 'src/__tests__/some.test.ts', 'console.error(result);'],
    ['NO_STDOUT_WRITE', 'src/log.ts', 'process.stdout.write(line);'],
    ['NO_STDOUT_WRITE', 'src/log.ts', "process['stdout'].write(line);"],
    ['STDERR_ONLY_IN_LOG', 'src/key-loader.ts', 'const { stderr } = process; stderr.write(value);'],
    ['FETCH_ONLY_IN_HTTP_CLIENT', 'src/probe.ts', 'const r = await fetch(url);'],
    ['FETCH_ONLY_IN_HTTP_CLIENT', 'src/probe.ts', "const r = await globalThis['fetch'](url);"],
    ['NO_NETWORK_MODULE', 'src/probe.ts', "const https = await import('node:https');"],
    ['NO_NETWORK_MODULE', 'src/probe.ts', "const net = require('net');"],
    ['NO_NETWORK_MODULE', 'src/__tests__/some.test.ts', "import { createServer } from 'node:http';"],
    ['NO_NETWORK_MODULE', 'src/probe.ts', "import { request } from 'undici';"],
    ['NO_URL_LITERAL', 'src/config.ts', "const DEFAULT_ENDPOINT = 'http://127.0.0.1:9';"],
    ['NO_URL_LITERAL', 'src/config.ts', "const DEFAULT_ENDPOINT = 'http' + '://' + host;"],
    ['NO_URL_LITERAL', 'src/fixtures/tts-fixture-provider.ts', 'const MODEL_URL = `https://example.invalid/${name}`;'],
    ['NO_PORT_8000_LITERAL', 'src/config.ts', 'const OMLX_PORT = 8000;'],
    ['NO_PORT_8000_LITERAL', 'src/config.ts', 'const OMLX_PORT = 8_000;'],
    ['NO_PORT_8000_LITERAL', 'src/config.ts', "const OMLX_HOST = '127.0.0.1:8000';"],
    ['NEVER_LISTENS', 'src/adapter.ts', 'server.listen(port);'],
    ['NEVER_LISTENS', 'src/adapter.ts', "server['listen'](port);"],
    ['NEVER_LISTENS', 'src/adapter.ts', 'const s = createServer();'],
    ['NO_MODEL_OR_PATH_LITERAL', 'src/adapter.ts', "const DEFAULT_MODEL = 'ggml-large-v3-turbo';"],
    ['NO_MODEL_OR_PATH_LITERAL', 'src/adapter.ts', "const BINARY = '.cache/stt/whisper.cpp/build/bin/whisper-cli';"],
    ['NO_MODEL_OR_PATH_LITERAL', 'src/adapter.ts', "const file = name + '.bin';"],
    ['NO_ENVIRONMENT_READ', 'src/key-loader.ts', "const key = process.env['OMLX_API_KEY'];"],
    ['NO_ENVIRONMENT_READ', 'src/key-loader.ts', 'const { env } = process;'],
    ['NO_ENVIRONMENT_READ', 'src/key-loader.ts', "import process from 'node:process';"],
    ['NO_ENVIRONMENT_READ', 'src/key-loader.ts', 'const key = globalThis.process.env.OMLX_API_KEY;'],
    ['NO_DOWNLOAD_OR_INSTALL', 'src/adapter.ts', "run('brew', ['install', 'x']);"],
    ['NO_DOWNLOAD_OR_INSTALL', 'src/adapter.ts', "run('pip', ['install', 'x']);"],
    ['CHILD_PROCESS_ONLY_IN_ENGINE_MODULES', 'src/adapter.ts', "import { spawn } from 'node:child_process';"],
    ['CHILD_PROCESS_ONLY_IN_ENGINE_MODULES', 'src/adapter.ts', "const cp = require('child_process');"],
    ['NO_SHELL', CPU_LOCAL, "import { execSync } from 'node:child_process';"],
    ['NO_SHELL', CPU_LOCAL, "import * as cp from 'node:child_process';"],
    ['NO_SHELL', CPU_LOCAL, 'spawn(binary, args, { shell: true });'],
    ['NO_SHELL', CPU_LOCAL, "spawn(binary, args, { shell: '/bin/sh' });"],
    ['NO_SHELL', PHYSICAL_CORES, "import { execFileSync, exec } from 'node:child_process';"],
    ['NO_OTYPE_FLAG', CPU_LOCAL, "args.push('-otype', 'json');"],
    ['NO_GPU_ENABLING_FLAG', CPU_LOCAL, "args.push('--use-gpu');"],
    ['DIARIZATION_PROVIDER_IS_CPU', 'src/pipeline/diarization.ts', "args.push('--embedding.provider=coreml');"],
    ['DIARIZATION_PROVIDER_IS_CPU', 'src/pipeline/diarization.ts', "args.push('--segmentation.provider=' + 'cuda');"],
    ['DIARIZATION_PROVIDER_IS_CPU', 'src/pipeline/diarization.ts', 'args.push(`--provider=${provider}`);'],
    ['NO_UNCLEARED_DIARIZATION_MODEL', 'src/pipeline/diarization.ts', "const DEFAULT_SEGMENTATION = 'sherpa-onnx-reverb-diarization-v1';"],
    ['NO_UNCLEARED_DIARIZATION_MODEL', 'src/pipeline/diarization.ts', "const SEGMENTATION = 'sherpa-onnx-pyannote-segmentation-3-0';"],
    ['NO_TIMING_MEASUREMENT', CPU_LOCAL, 'const started = performance.now();'],
    ['NO_TIMING_MEASUREMENT', CPU_LOCAL, "const started = Date['now']();"],
    ['NO_TIMING_MEASUREMENT', CPU_LOCAL, 'const t = process.hrtime.bigint();'],
    ['NO_TIMING_MEASUREMENT', 'src/__tests__/some.test.ts', 'const rtf = elapsed / audio;'],
    ['MEDIA_TIME_ORIGIN_NEVER_WRITTEN', MEDIA_TIME, 'export const origin = 1024;'],
    ['MEDIA_TIME_ORIGIN_NEVER_WRITTEN', 'src/pipeline/chunker.ts', 'const fileSample = tapSample + 1_024;'],
    ['MEDIA_TIME_ORIGIN_NEVER_WRITTEN', 'src/pipeline/runner.ts', 'const startMs = tapMs + 21.333;'],
    ['MEDIA_TIME_ORIGIN_NEVER_WRITTEN', 'src/pipeline/clamp.ts', 'const frame = 0x400;'],
    ['NO_DYNAMIC_CODE', 'src/adapter.ts', "eval('con' + 'sole.log(key)');"],
    ['NO_DYNAMIC_CODE', 'src/adapter.ts', "const f = new Function('return process');"],
  ];

  it.each(cases)('%s is reported for a line planted in %s: %s', (rule, path, text) => {
    expect(planted(path, text)).toContain(rule);
  });

  it('every rule has a planted case', () => {
    const covered = new Set<string>(cases.map(([rule]) => rule));
    covered.add('NO_NETWORK_MODULE').add('STDERR_ONLY_IN_LOG').add('UNPARSEABLE_SOURCE').add('PROCESS_OBJECT_IS_NOT_PASSED_AROUND').add('NO_DIRECT_OUTPUT');
    expect([...covered].sort()).toEqual([...RULE_IDS].sort());
  });
});

describe('static rule: what a named file must contain, each one red when it is gone', () => {
  const only = (path: string, text: string): string[] => scanSources([...CLEAN.filter((file) => file.path !== path), { path, text }]).map((violation) => violation.rule).sort();

  it('a command without the constant -ng', () => {
    expect(only(CPU_LOCAL, CLEAN_CPU_LOCAL.replace("config.modelPath, NO_GPU_FLAG, '-t'", "config.modelPath, '-t'"))).toEqual(['NO_GPU_FLAG_IS_IN_EVERY_COMMAND']);
  });

  it('a -ng that became an option', () => {
    expect(only(CPU_LOCAL, CLEAN_CPU_LOCAL.replace('NO_GPU_FLAG, ', "...(config.noGpu ? [NO_GPU_FLAG] : []), "))).toEqual(['NO_GPU_FLAG_IS_IN_EVERY_COMMAND']);
    expect(only(CPU_LOCAL, CLEAN_CPU_LOCAL.replace("export const NO_GPU_FLAG = '-ng';", "export const NO_GPU_FLAG = flags.gpu ? '' : '-ng';"))).toEqual(['NO_GPU_FLAG_IS_A_CONSTANT']);
    expect(only(CPU_LOCAL, CLEAN_CPU_LOCAL.replace('export const NO_GPU_FLAG', 'export let NO_GPU_FLAG'))).toEqual(['NO_GPU_FLAG_IS_A_CONSTANT']);
  });

  it('an engine that inherits the environment of its parent, or is started without the shell switch off', () => {
    expect(only(CPU_LOCAL, CLEAN_CPU_LOCAL.replace(', env: ENGINE_ENVIRONMENT', ''))).toEqual(['ENGINE_ENVIRONMENT_IS_ALLOW_LISTED']);
    expect(only(CPU_LOCAL, CLEAN_CPU_LOCAL.replace('env: ENGINE_ENVIRONMENT', 'env: { ...parent }'))).toEqual(['ENGINE_ENVIRONMENT_IS_ALLOW_LISTED']);
    expect(only(CPU_LOCAL, CLEAN_CPU_LOCAL.replace('shell: false, ', ''))).toEqual(['ENGINE_STARTS_WITHOUT_A_SHELL']);
  });

  it('an HTTP client that follows redirects, or does not re-check loopback', () => {
    expect(only(OMLX_HTTP, CLEAN_OMLX_HTTP.replace("redirect: 'error'", "redirect: 'follow'"))).toEqual(['REDIRECTS_ARE_ERRORS']);
    expect(only(OMLX_HTTP, CLEAN_OMLX_HTTP.replace("  const init = { redirect: 'error' };\n", ''))).toEqual(['REDIRECTS_ARE_ERRORS']);
    expect(only(OMLX_HTTP, CLEAN_OMLX_HTTP.replace('  assertLoopbackEndpoint(options.endpoint);\n', ''))).toEqual(['HTTP_CLIENT_RECHECKS_LOOPBACK']);
    expect(only(OMLX_HTTP, `${CLEAN_OMLX_HTTP.replace('  assertLoopbackEndpoint(options.endpoint);\n', '')}function other(): void { assertLoopbackEndpoint(x); }\n`)).toEqual(['HTTP_CLIENT_RECHECKS_LOOPBACK']);
    expect([...REQUIRED_IDS].sort()).toEqual([
      'ENGINE_ENVIRONMENT_IS_ALLOW_LISTED',
      'ENGINE_STARTS_WITHOUT_A_SHELL',
      'HTTP_CLIENT_RECHECKS_LOOPBACK',
      'MEDIA_TIME_ORIGIN_IS_IMPORTED',
      'NO_GPU_FLAG_IS_A_CONSTANT',
      'NO_GPU_FLAG_IS_IN_EVERY_COMMAND',
      'REDIRECTS_ARE_ERRORS',
    ]);
  });

  it('row 77: a media-time module that writes its own origin instead of importing the shared constant', () => {
    expect(only(MEDIA_TIME, 'const CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES = 512 * 2;\nexport const origin = CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES;\n')).toEqual(['MEDIA_TIME_ORIGIN_IS_IMPORTED']);
    expect(only(MEDIA_TIME, "import { CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES } from './constants';\nexport const origin = CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES;\n")).toEqual(['MEDIA_TIME_ORIGIN_IS_IMPORTED']);
    expect(only(MEDIA_TIME, "import { CAPTURE_AUDIO_SAMPLE_RATE_HZ } from '@dems/shared/api';\nexport const origin = 1024;\n").sort()).toEqual(['MEDIA_TIME_ORIGIN_IS_IMPORTED', 'MEDIA_TIME_ORIGIN_NEVER_WRITTEN']);
    // The control: the real file of the tree holds the import and no such number.
    const real = readTree().find((file) => file.path === MEDIA_TIME);
    expect(real).toBeDefined();
    expect(scanSources([...CLEAN.filter((file) => file.path !== MEDIA_TIME), real!])).toEqual([]);
  });
});

describe('static rule: what is NOT a violation (a rule is about what the code does)', () => {
  it('a forbidden word inside a comment', () => {
    expect(planted('src/config.ts', "// never http://127.0.0.1:8000 here, nor console.log\n/* nor ggml-x.bin, process.env, fetch(url) */\nexport const a = 1;")).toEqual([]);
  });

  it('a slash pair inside a string does not hide the code after it, and does not hide the string either', () => {
    expect(planted('src/config.ts', "const a = 'x//y'; const b = 1;")).toEqual([]);
  });

  it('ordinary names that only contain a forbidden word', () => {
    expect(planted('src/adapter.ts', 'const fetchImpl = deps.fetchImpl; const listener = 1; const environment = 2; const prefetch = queue.fetched;')).toEqual([]);
    expect(planted('src/host/physical-cores.ts', "const m = /core id/.exec(block);")).toEqual([]);
  });
});
