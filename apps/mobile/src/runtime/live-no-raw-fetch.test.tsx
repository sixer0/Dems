// Backend task W51, static test (decision D69, rule D34-6 a; 04_client_integration_spec §4.4 WT-6):
// NO RAW REQUEST TO THE CORE SERVER'S ORIGIN anywhere in the app.
//
// Why: React Native's socket sends, on the upgrade, whatever cookie the app's store holds for the
// host (measured on the emulator, finding F55), and the Core server answers a cookie together with
// a bearer header with 401. The store is filled only by a request with default options. The typed
// client (`@dems/shared/client`) sends every request with `credentials: 'omit'`: it neither sends
// nor stores a cookie. So every request to the Core server goes through it, and through nothing else.
//
// Three rules over every production file under `apps/mobile/src` (comments are not code):
//  1. No file calls a network API itself (`fetch`, `XMLHttpRequest`, `sendBeacon`, `EventSource`, a
//     socket constructor, a fetch package). The typed client and the socket client of
//     `@dems/shared` own the calls.
//  2. The Core server's address (its port, its constants) is named by ONE file: since D263 (row 236, the
//     user's Core server address setting) that is the runtime's address source, `runtime/core-address.ts`,
//     in ONE line (its default, `DEFAULT_CORE_LINE`). An origin is built from an address by that file's
//     `coreOriginOf` and called by the adapters of the Live source, `runtime/sim-adapters.ts`, and nowhere else.
//  3. The adapters hold no network call but the socket constructor of their socket factory, and no
//     address of their own. They use the origin in exactly THREE places: the typed client, the Live socket
//     client, and - the named allowance of integration pass D11 - the media transport (`mediaTransport()`,
//     pass D5): the origin and the session header HANDED to the video player, which makes the requests
//     of the media route itself. That line builds an object; it fetches nothing. A real request in
//     the file (a `fetch(` beside the transport, a fourth use of the origin, the address named) still fails.
//     (Before D263 the adapters named the shared constants in the same three lines; each pin moved by its line.)
// And one rule over `packages/shared/src`: its only raw `fetch` outside the typed client is the
// health read of mock-core, which is built from the mock-core origin.
//
// One exemption, by name: `runtime/dev-probes.ts`, the debug-only device probe of the early proofs.
// It measures what a raw request does (that is how F55 was found), runs only from a `?probe=` deep
// link in a debug build, and is in no release bundle.
//
// One named allowance of rule 1, ruling D217 (task 2026-11-05 row 195, M3-09; renderer D202): the live
// camera preview's stream is `multipart/x-mixed-replace`, which the typed client cannot hand on. Its ONE
// request lives in `runtime/camera-stream-transport.ts`: one import of Expo's streaming fetch and one call,
// both pinned by their exact text below (`CAMERA_STREAM_IMPORT_LINE`, `CAMERA_STREAM_CALL_LINE`), with the
// origin and the bearer from the Live source's media transport and `credentials: 'omit'`. Any other network
// call in that file, a changed call, or the same import in any other file (a feature file included) fails.
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { CORE_SERVER_HTTP_ORIGIN, CORE_SERVER_PORT, CORE_SERVER_WS_URL } from '@dems/shared/api';

const SRC = join(__dirname, '..');
const SHARED_SRC = join(__dirname, '..', '..', '..', '..', 'packages', 'shared', 'src');
const ADAPTERS = 'runtime/sim-adapters.ts';
const PROBE = 'runtime/dev-probes.ts';
/** D263: the runtime's one source of the Core server address. */
const ADDRESS_SOURCE = 'runtime/core-address.ts';
/** D263: the ONE line of the address source that names the Core server's address: the default. */
const DEFAULT_CORE_LINE = `export const DEFAULT_CORE_ADDRESS: CoreAddress = Object.freeze({ host: ${['CORE', 'SERVER', 'HOST'].join('_')}, port: ${['CORE', 'SERVER', 'PORT'].join('_')} });`;
/** D263: the adapters' one origin of their source, built once from the address in force. */
const ORIGIN_LINE = 'const coreOrigin = coreOriginOf(coreAddress);';
/** A use of the adapters' origin. */
const ORIGIN_USE = /\bcoreOrigin\b/;

/** The ONE line of the adapters that hands the origin to the media player (rule 3, the named allowance). Moved by D263 (was the shared constant). */
const MEDIA_TRANSPORT_LINE = 'const transport = { origin: coreOrigin.http } as MobileMediaTransport;';

const FETCH = ['fe', 'tch'].join('');
const SOCKET = ['Web', 'Socket'].join('');
/** A use of the global `fetch` as a value: not a member (`options.fetch`), not a key (`fetch:`), not part of a longer name. */
const RAW_FETCH = new RegExp(`(?:(?<![.\\w$'"\`/-])|(?<=\\b(?:globalThis|global|window|self)\\.))${FETCH}(?![\\w$'"\`-]|\\s*\\??\\s*:)`);
/** A use of the global socket constructor as a value. */
const RAW_SOCKET = new RegExp(`(?<![.\\w$'"\`])${SOCKET}(?![\\w$'"\`]|\\s*\\??\\s*:)`);
const OTHER_NETWORK = new RegExp(
  [
    ['XML', 'Http', 'Request'].join(''),
    ['send', 'Beacon'].join(''),
    ['Event', 'Source'].join(''),
    `['"\`]expo/${FETCH}['"\`]`,
    `['"\`]axios['"\`]`,
    `['"\`]whatwg-${FETCH}['"\`]`,
    `['"\`]cross-${FETCH}['"\`]`,
  ].join('|'),
);
/** The Core server's address in any form: its port as a number or in a URL, or one of the shared constants that hold it. */
const CORE_ADDRESS = new RegExp(`(?<![\\w.])${CORE_SERVER_PORT}(?![\\w])|\\b${['CORE', 'SERVER'].join('_')}_(?:HTTP_ORIGIN|WS_URL|HOST|PORT)\\b`);

/** D217: the one named allowance of rule 1 (row 195): this file, this import and this call, nothing else. */
const CAMERA_STREAM = 'runtime/camera-stream-transport.ts';
const STREAM_FETCH = ['stream', 'Fetch'].join('');
const CAMERA_STREAM_IMPORT_LINE = `import { ${FETCH} as ${STREAM_FETCH} } from 'expo/${FETCH}';`;
const CAMERA_STREAM_CALL_LINE =
  `const response = await ${STREAM_FETCH}(\`\${transport.origin}\${path}\`, { method: 'GET', headers: { Authorization: transport.authorization }, credentials: 'omit', signal });`;

/**
 * Code without its comments. The `//` of a URL (`http://…`) is no comment: an address inside a
 * string must stay visible to the rules below.
 */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');
}

function sourceFiles(folder: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(folder)) {
    if (name === 'node_modules') continue;
    const path = join(folder, name);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name)) found.push(path);
  }
  return found;
}

const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path) || /(?:^|\/)(?:testing|__tests__)\//.test(path);
const rel = (root: string, path: string): string => relative(root, path).split(sep).join('/');

function production(root: string): { path: string; text: string }[] {
  return sourceFiles(root)
    .map((path) => ({ path: rel(root, path), text: code(readFileSync(path, 'utf8')) }))
    .filter((file) => !isTest(file.path));
}

function matching(root: string, pattern: RegExp): string[] {
  return production(root)
    .filter((file) => pattern.test(file.text))
    .map((file) => file.path)
    .sort();
}

/**
 * Rule 3 over the code of the adapters: what it holds that it must not, as sentences. Empty: the
 * file hands the address to the typed client, to the Live socket client and to the media player's
 * transport, and makes no request itself.
 */
function adapterProblems(adapters: string): string[] {
  const problems: string[] = [];
  if (RAW_FETCH.test(adapters)) problems.push(`a raw ${FETCH}`);
  if (OTHER_NETWORK.test(adapters)) problems.push('another network API');
  // D263: the adapters name no address; the origin comes from the runtime's address source.
  if (CORE_ADDRESS.test(adapters)) problems.push('the Core server address');
  const uses = adapters.split('\n').filter((line) => ORIGIN_USE.test(line) && !/^\s*import\b/.test(line)).map((line) => line.trim());
  const allowed = [ORIGIN_LINE, 'baseUrl: coreOrigin.http,', MEDIA_TRANSPORT_LINE, 'url: coreOrigin.ws,'];
  if (JSON.stringify(uses) !== JSON.stringify(allowed)) problems.push(`the uses of the origin are ${JSON.stringify(uses)}`);
  // The allowance is the transport of the media player and nothing else: an object with the origin, its header not enumerable.
  if (!adapters.includes(`Object.defineProperty(transport, 'headers', {`) || !/enumerable:\s*false/.test(adapters)) problems.push('the media transport does not hide its header');
  if (!adapters.includes('createCoreClient({') || !adapters.includes('createLiveSim({')) problems.push('the typed client or the Live source is not built here');
  return problems;
}

/**
 * D217: what the stream transport holds that it must not, as sentences. Empty: its only network text is the
 * pinned import and the pinned call, and it names no Core address and no socket.
 */
function cameraStreamProblems(text: string): string[] {
  const problems: string[] = [];
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const network = lines.filter((line) => RAW_FETCH.test(line) || OTHER_NETWORK.test(line));
  if (JSON.stringify(network) !== JSON.stringify([CAMERA_STREAM_IMPORT_LINE])) problems.push(`the network imports are ${JSON.stringify(network)}`);
  const uses = lines.filter((line) => line.includes(STREAM_FETCH));
  if (JSON.stringify(uses) !== JSON.stringify([CAMERA_STREAM_IMPORT_LINE, CAMERA_STREAM_CALL_LINE])) problems.push(`the stream calls are ${JSON.stringify(uses)}`);
  if (CORE_ADDRESS.test(text)) problems.push('the Core server address');
  if (RAW_SOCKET.test(text)) problems.push('a socket constructor');
  return problems;
}

/** Rule 1 over a list of files: every file with a network call that is neither the debug probe nor the D217 allowance. */
function ruleOneOffenders(files: readonly { path: string; text: string }[]): string[] {
  return files
    .filter((file) => file.path !== PROBE && file.path !== CAMERA_STREAM)
    .filter((file) => RAW_FETCH.test(file.text) || OTHER_NETWORK.test(file.text))
    .map((file) => file.path)
    .sort();
}

describe('no raw request to the Core server (D69, D34-6 a)', () => {
  it('the matchers find every way of calling the network, and nothing else', () => {
    const raw = [
      `const answer = await ${FETCH}(url);`,
      `await ${FETCH} (url, { method: 'POST' });`,
      `const send = ${FETCH};`,
      `return globalThis.${FETCH}(url);`,
      `window.${FETCH}(url)`,
      `createCoreClient({ baseUrl, credentials, ${FETCH} });`,
      `[${FETCH}, other]`,
    ];
    for (const text of raw) expect([text, RAW_FETCH.test(text)]).toEqual([text, true]);
    const notRaw = [
      `...(options.${FETCH} ? { ${FETCH}: options.${FETCH} } : {})`,
      `${FETCH}?: CoreFetch;`,
      `  ${FETCH}: fake.${FETCH},`,
      `queryFn: () => ${FETCH}Health(),`,
      `const { re${FETCH} } = query;`,
      `void re${FETCH}();`,
      `import { ${FETCH}Health } from '@dems/shared/api';`,
      `t('features.evidence.${FETCH}')`,
    ];
    for (const text of notRaw) expect([text, RAW_FETCH.test(text)]).toEqual([text, false]);

    for (const text of [`new ${SOCKET}(url)`, `const Ctor = ${SOCKET};`, `(globalThis as { ${SOCKET}?: unknown }).${SOCKET}`.replace(`.${SOCKET}`, ` ?? ${SOCKET}`)]) {
      expect([text, RAW_SOCKET.test(text)]).toEqual([text, true]);
    }
    for (const text of [`heartbeat${SOCKET}Factory`, `${SOCKET}?: HeaderSocketConstructor`, `globalThis.${SOCKET}`, `'${SOCKET}'`]) {
      expect([text, RAW_SOCKET.test(text)]).toEqual([text, false]);
    }

    expect(OTHER_NETWORK.test(`import { ${FETCH} as expoFetch } from 'expo/${FETCH}';`)).toBe(true);
    expect(OTHER_NETWORK.test(`new ${['XML', 'Http', 'Request'].join('')}()`)).toBe(true);
    expect(OTHER_NETWORK.test(`import { ${FETCH}Health } from '@dems/shared/api';`)).toBe(false);

    for (const text of [`'http://127.0.0.1:${CORE_SERVER_PORT}'`, `port: ${CORE_SERVER_PORT},`, `baseUrl: ${['CORE', 'SERVER', 'HTTP', 'ORIGIN'].join('_')},`, `url: ${['CORE', 'SERVER', 'WS', 'URL'].join('_')},`]) {
      expect([text, CORE_ADDRESS.test(text)]).toEqual([text, true]);
    }
    for (const text of [`'http://127.0.0.1:4400'`, `CORE_HTTP_ORIGIN`, `CORE_WS_URL`, `1${CORE_SERVER_PORT}`, `${CORE_SERVER_PORT}5`, `v${CORE_SERVER_PORT}`]) {
      expect([text, CORE_ADDRESS.test(text)]).toEqual([text, false]);
    }
    // Comments are not code: a file may say the address in its documentation. A URL in a string is code.
    expect(CORE_ADDRESS.test(code(`/** over ws://127.0.0.1:${CORE_SERVER_PORT}/ws */\n// port ${CORE_SERVER_PORT}\nconst x = 1; // ${CORE_SERVER_PORT}`))).toBe(false);
    expect(CORE_ADDRESS.test(code(`const origin = 'http://127.0.0.1:${CORE_SERVER_PORT}'; // the Core server`))).toBe(true);
    expect(CORE_SERVER_HTTP_ORIGIN).toBe(`http://127.0.0.1:${CORE_SERVER_PORT}`);
    expect(CORE_SERVER_WS_URL).toBe(`ws://127.0.0.1:${CORE_SERVER_PORT}/ws`);
  });

  it('reads the whole source tree, production files only', () => {
    const files = production(SRC).map((file) => file.path);
    expect(files.length).toBeGreaterThan(200);
    expect(files).toContain(ADAPTERS);
    expect(files).toContain(PROBE);
    expect(files).toContain('features/home/use-health.ts');
    expect(files.some(isTest)).toBe(false);
  });

  it('rule 1: no production file calls `fetch` or another network API itself (the debug probe is the one exemption)', () => {
    // D217: the stream transport of the camera preview is the one named allowance (its own case below).
    expect(matching(SRC, RAW_FETCH)).toEqual([CAMERA_STREAM, PROBE].sort());
    expect(matching(SRC, OTHER_NETWORK)).toEqual([CAMERA_STREAM, PROBE].sort());
    expect(ruleOneOffenders(production(SRC))).toEqual([]);
  });

  it('rule 1, the D217 allowance is narrow: the stream transport holds the pinned import and the pinned call, and nothing else', () => {
    const transport = production(SRC).find((file) => file.path === CAMERA_STREAM)!.text;
    expect(cameraStreamProblems(transport)).toEqual([]);
    expect(transport.split('\n').filter((line) => line.trim() === CAMERA_STREAM_CALL_LINE)).toHaveLength(1);
    const after = (planted: string): string => transport.replace(CAMERA_STREAM_CALL_LINE, `${CAMERA_STREAM_CALL_LINE}\n  ${planted}`);
    // A second request through the same import.
    expect(cameraStreamProblems(after(`void ${STREAM_FETCH}(\`\${transport.origin}/api/v1/evidence\`);`))).toHaveLength(1);
    // A raw request beside it.
    expect(cameraStreamProblems(after(`void ${FETCH}(path);`))).toHaveLength(1);
    // The pinned call changed: a cookie sent with the bearer.
    expect(cameraStreamProblems(transport.replace(`credentials: 'omit'`, `credentials: 'include'`))).toHaveLength(1);
    // The Core address named here.
    expect(cameraStreamProblems(after(`const origin = ${['CORE', 'SERVER', 'HTTP', 'ORIGIN'].join('_')};`))).toEqual(['the Core server address']);
  });

  it('rule 1, D217: Expo\'s streaming fetch planted in a feature file (or anywhere but the allowance) still fails', () => {
    const files = production(SRC);
    const planted = (path: string, text: string) => ruleOneOffenders([...files.filter((file) => file.path !== path), { path, text }]);
    expect(planted('features/devices/camera-live-stream.ts', `${CAMERA_STREAM_IMPORT_LINE}\nvoid ${STREAM_FETCH}(url);`)).toEqual(['features/devices/camera-live-stream.ts']);
    expect(planted('features/evidence/media-session.ts', `import { ${FETCH} } from 'expo/${FETCH}';`)).toEqual(['features/evidence/media-session.ts']);
    expect(planted('runtime/sim-adapters.ts', CAMERA_STREAM_IMPORT_LINE)).toEqual(['runtime/sim-adapters.ts']);
  });

  it('rule 1: the socket constructor is named by the socket factory of the adapters only', () => {
    expect(matching(SRC, RAW_SOCKET)).toEqual([PROBE, ADAPTERS].sort());
  });

  it('rule 2: one production file names the Core server\'s address: the runtime\'s address source (D263; was the adapters)', () => {
    expect(matching(SRC, CORE_ADDRESS)).toEqual([PROBE, ADDRESS_SOURCE].sort());
    // In one line, its default; the import of the two shared constants aside. It makes no request.
    const source = production(SRC).find((file) => file.path === ADDRESS_SOURCE)!.text;
    const named = source.split('\n').filter((line) => CORE_ADDRESS.test(line) && !/^\s*import\b/.test(line)).map((line) => line.trim());
    expect(named).toEqual([DEFAULT_CORE_LINE]);
    expect(RAW_FETCH.test(source) || OTHER_NETWORK.test(source) || RAW_SOCKET.test(source)).toBe(false);
    // The origin still comes only from the runtime: built by the address source, asked for by the adapters alone.
    expect(matching(SRC, /\bcoreOriginOf\(/)).toEqual([ADDRESS_SOURCE, ADAPTERS].sort());
  });

  it('rule 3: the adapters hand the address to the typed client and to the Live socket client, and make no request themselves', () => {
    const adapters = production(SRC).find((file) => file.path === ADAPTERS)!.text;
    // The three uses of the address (the typed client, the media transport, the Live socket), and no fourth.
    expect(adapterProblems(adapters)).toEqual([]);
  });

  it('rule 3, the allowance is narrow (pass D11): the media transport line is allowed by name; a real request planted in the same file still fails', () => {
    const adapters = production(SRC).find((file) => file.path === ADAPTERS)!.text;
    expect(adapters.split('\n').filter((line) => line.trim() === MEDIA_TRANSPORT_LINE)).toHaveLength(1);
    const after = (planted: string): string => adapters.replace(MEDIA_TRANSPORT_LINE, `${MEDIA_TRANSPORT_LINE}\n      ${planted}`);
    // A request made beside the transport, with the address it was just given.
    expect(adapterProblems(after(`void ${FETCH}(\`\${transport.origin}/api/v1/evidence\`, { headers: transport.headers });`))).toEqual([`a raw ${FETCH}`]);
    // A request that names the address itself: the raw call AND the address named (D263: the adapters name none).
    const direct = adapterProblems(after(`void ${FETCH}(\`\${${['CORE', 'SERVER', 'HTTP', 'ORIGIN'].join('_')}}/media/x\`);`));
    expect(direct[0]).toBe(`a raw ${FETCH}`);
    expect(direct).toHaveLength(2);
    // A second object built from the address is a fourth use: the allowance is ONE line, not a pattern.
    expect(adapterProblems(after(`const other = { origin: ${['CORE', 'SERVER', 'HTTP', 'ORIGIN'].join('_')} };`))).toHaveLength(1);
    // D263: the same with the source's origin: a fourth use of it.
    expect(adapterProblems(after('const other = { origin: coreOrigin.http };'))).toHaveLength(1);
    // A transport whose header is enumerable (it would print with the object) is not the allowed one.
    expect(adapterProblems(adapters.replace(/enumerable:\s*false/g, 'enumerable: true'))).toEqual(['the media transport does not hide its header']);
  });

  it('the shared package: outside the typed client, the only raw `fetch` reads are built from the mock-core origin', () => {
    const shared = production(SHARED_SRC).filter((file) => !file.path.startsWith('live/testing/'));
    expect(shared.length).toBeGreaterThan(80);
    const callers = shared.filter((file) => new RegExp(`(?<![.\\w$])${FETCH}(?:Impl)?\\s*\\(`).test(file.text)).map((file) => file.path);
    // D61 leftover (2026-11-04): `api/lcd-panel.ts` (operation 114, added in 1358318d) joins the allow-list
    // exactly as `api/health.ts` does: it is the public mock-core read (port 4400, `CORE_HTTP_ORIGIN`),
    // never the Core server's address, and the mobile app calls neither — the two are exempt by the same rule.
    expect(callers).toEqual(['api/health.ts', 'api/lcd-panel.ts'].sort());
    const health = shared.find((file) => file.path === 'api/health.ts')!.text;
    // Built from the mock-core origin (port 4400), never from the Core server's.
    expect(health).toContain(`${FETCH}Impl(\`\${CORE_HTTP_ORIGIN}\${HEALTH_PATH}\`)`);
    expect(/CORE_SERVER_(?:HTTP_ORIGIN|WS_URL|HOST|PORT)/.test(health)).toBe(false);
    // The panel read of operation 114: the same shape, the same origin, no Core-server constant.
    const panel = shared.find((file) => file.path === 'api/lcd-panel.ts')!.text;
    expect(panel).toContain(`${FETCH}Impl(\`\${CORE_HTTP_ORIGIN}\${PANEL_FIRMWARE_PATH}\`)`);
    expect(/CORE_SERVER_(?:HTTP_ORIGIN|WS_URL|HOST|PORT)/.test(panel)).toBe(false);
    // The typed client calls the transport it was given, or looks the global up by name.
    const client = shared.find((file) => file.path === 'client/core-client.ts')!.text;
    expect(client).toContain(`(globalThis as { ${FETCH}?: unknown }).${FETCH}`);
    expect(client).toContain(`credentials: credentials === 'browser-cookie' ? 'same-origin' : 'omit'`);
  });
});
