// Static guards of the capture-discovery module (blueprint row 132; R-9, decisions D86 C-4, D106,
// D114; static rules G-R9 and G-R13). They read sources and two task documents as text.
//
//   1. ONE place sends a probe: `search.ts` holds the only `.discover(` call of the module, and no
//      other production file of the Core server holds one outside the adapter layer.
//   2. The loopback fixture of the fake ONVIF stub is named by no production file of the module:
//      a test reaches it through `provideAdapter` only.
//   3. The module writes to the capture registry in ONE place of its own (`adoption.ts`, inside the
//      unit of the adoption); the connect flow's statements are row 142's (`connect/statements.ts`).
//      Nothing else in the folder holds a write statement, so a search writes nothing to it.
//   4. `replaceForTest` of the connect flow is called by no production file.
//   5. THE LIFT (D86 C-4): `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` may be `true` only while
//      `M4-SEC-DISC-1` and `M4-SEC-DISC-3` are recorded PASS in BOTH documents: row 131's
//      (`62_r9_onvif_discovery.md`) and this row's (`63_r9_search_api.md`).
//   6. A RE-ADDRESS IS NEVER AUTOMATIC (task 4 row 97; NEW-1 / U12 A7): the confirmation of an
//      operator is made by one function, whose production callers are a CLOSED list - since task 4
//      row 197 the ONE route file of operation 100 (`readdress-route.ts`), which makes it from the
//      body of the request it answers and from nothing else; the re-address function has the same
//      closed list; and no file of the search path imports `readdress.ts` or the route file.
//
// Every rule has a control: the same reader, on a planted text, reads the other value.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { SCAN_COVERS, scanCoverage } from '../../../../test/static/scan';

const SERVER_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url));
const FOLDER = 'src/modules/capture-discovery';
const TASK_DOCS = 'docs/2026-10-07_dems_real_capture_sealing/implementation';

interface Source {
  readonly path: string;
  readonly text: string;
}

/** Production sources under a folder of the Core server: `.ts`, no test folder, no declaration file. */
function sourcesUnder(folder: string): Source[] {
  const found: Source[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.ts')) {
        found.push({ path: relative(SERVER_ROOT, full).replaceAll('\\', '/'), text: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(join(SERVER_ROOT, folder));
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

/** The text without comments: a rule is about code, and a comment may name what the code must not hold. */
const codeOf = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const holding = (sources: readonly Source[], pattern: RegExp): string[] => sources.filter((source) => pattern.test(codeOf(source.text))).map((source) => source.path);

const DISCOVER_CALL = /\.\s*discover\s*\(/;
const LOOPBACK_FIXTURE = /\bloopbackFixture\b/;
const WRITE_STATEMENT = /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_.]+\s+SET|DELETE\s+FROM|TRUNCATE)\b/i;
const REPLACE_FOR_TEST_CALL = /\.\s*replaceForTest\s*\(/;

const moduleSources = sourcesUnder(FOLDER);
const serverSources = sourcesUnder('src');

describe('the scan itself', () => {
  it('reads the production sources of the folder, the connect flow among them', () => {
    // Rule R1 (test/static/scan.ts): the scan equals an independent walk of the folder and is not empty.
    const paths = moduleSources.map((source) => source.path);
    expect(scanCoverage(paths, [FOLDER])).toEqual(SCAN_COVERS);
    expect(paths.some((path) => path.startsWith(`${FOLDER}/connect/`))).toBe(true);
    expect(moduleSources.every((source) => source.text.length > 200)).toBe(true);
    expect(serverSources.length).toBeGreaterThan(200);
  });

  it('every pattern finds its planted text, and a comment that names it is not code (control)', () => {
    const planted = (text: string): Source[] => [{ path: 'planted.ts', text }];
    expect(holding(planted('await adapter . discover ({ windowMs });'), DISCOVER_CALL)).toEqual(['planted.ts']);
    expect(holding(planted('create({ loopbackFixture: address });'), LOOPBACK_FIXTURE)).toEqual(['planted.ts']);
    expect(holding(planted("const SQL = 'UPDATE public.capture_devices SET enabled = false';"), WRITE_STATEMENT)).toEqual(['planted.ts']);
    expect(holding(planted("const SQL = 'insert into capture_devices (id) VALUES ($1)';"), WRITE_STATEMENT)).toEqual(['planted.ts']);
    expect(holding(planted('control.replaceForTest({ limits });'), REPLACE_FOR_TEST_CALL)).toEqual(['planted.ts']);
    for (const pattern of [DISCOVER_CALL, LOOPBACK_FIXTURE, WRITE_STATEMENT, REPLACE_FOR_TEST_CALL]) {
      expect(holding(planted('// adapter.discover( loopbackFixture UPDATE x SET y; control.replaceForTest(\n/* INSERT INTO t */\nexport const a = 1;'), pattern)).toEqual([]);
    }
  });
});

describe('rule 1 (G-R13): one place sends a probe', () => {
  it('`search.ts` holds the only `.discover(` call of the module, and of the Core server outside the adapter layer', () => {
    expect(holding(moduleSources, DISCOVER_CALL)).toEqual([`${FOLDER}/search.ts`]);
    expect(holding(serverSources.filter((source) => !source.path.startsWith('src/capture/adapters/')), DISCOVER_CALL)).toEqual([`${FOLDER}/search.ts`]);
  });
});

describe('rule 2 (G-R9): the loopback fixture is a test\'s', () => {
  it('no production file of the module names it', () => {
    expect(holding(moduleSources, LOOPBACK_FIXTURE)).toEqual([]);
  });
});

describe('rule 3: a search writes nothing to the registry', () => {
  it('the write statements of the folder are the adoption\'s one and the connect flow\'s own file', () => {
    expect(holding(moduleSources, WRITE_STATEMENT)).toEqual([`${FOLDER}/adoption.ts`, `${FOLDER}/connect/statements.ts`]);
    // The adoption's statements: one UPDATE of the row the engine's unit has just written, and (task 4 row 51) the
    // INSERT of that camera's stream rows - the minted code with its ONVIF tokens. Nothing else, and nothing of a search.
    const adoption = codeOf(moduleSources.find((source) => source.path === `${FOLDER}/adoption.ts`)?.text ?? '');
    expect(adoption.match(/\b(?:INSERT\s+INTO|UPDATE\s+[a-z_.]+\s+SET|DELETE\s+FROM|TRUNCATE)\b/gi)).toEqual(['UPDATE public.capture_devices SET', 'INSERT INTO']);
    expect(adoption).toMatch(/INSERT INTO public\.capture_device_streams \(/);
    // AD-06 (4), in code: the profile list is held to the code rule before the engine's action and before any statement.
    expect(adoption).toMatch(/export async function registerAdoptedCamera\([^)]*\): Promise<CaptureDeviceStatus> \{\s*assertAdoptedProfiles\(device\);/);
  });
});

describe('rule 4: the test seam of the connect flow stays a test\'s', () => {
  it('no production file of the Core server calls `replaceForTest`', () => {
    expect(holding(serverSources, REPLACE_FOR_TEST_CALL)).toEqual([]);
  });
});

// ── Rule 5: the lift ───────────────────────────────────────────────────────────────────────────

const LIFT_CHECKS = ['M4-SEC-DISC-1', 'M4-SEC-DISC-3'] as const;
const LIFT_DOCUMENTS = [`${TASK_DOCS}/62_r9_onvif_discovery.md`, `${TASK_DOCS}/63_r9_search_api.md`] as const;

/** The checks a document does NOT record as passed: a check counts when one line names it and says PASS, and no line names it with FAIL. */
function notRecorded(text: string): string[] {
  const lines = text.split('\n');
  return LIFT_CHECKS.filter((check) => {
    const naming = lines.filter((line) => line.includes(`\`${check}\``));
    return !naming.some((line) => /\bPASS\b/.test(line)) || naming.some((line) => /\bFAIL(?:ED)?\b/.test(line));
  });
}

describe('rule 5 (D86 C-4): the lift of the 409 during RECORDING is on only while its two checks are recorded PASS', () => {
  it('the reader: a document without the line, with one check only, or with a FAIL line does not record the lift (control)', () => {
    expect(notRecorded('nothing about the checks')).toEqual([...LIFT_CHECKS]);
    expect(notRecorded('| `M4-SEC-DISC-1` | PASS |')).toEqual(['M4-SEC-DISC-3']);
    expect(notRecorded('`M4-SEC-DISC-1` and `M4-SEC-DISC-3` are PASS here')).toEqual([]);
    expect(notRecorded('| `M4-SEC-DISC-1` | PASS |\n| `M4-SEC-DISC-3` | PASS |\n| `M4-SEC-DISC-3` | run 2 | FAIL |')).toEqual(['M4-SEC-DISC-3']);
    // The name alone is no record.
    expect(notRecorded('| `M4-SEC-DISC-1` | not run |\n| `M4-SEC-DISC-3` | not run |')).toEqual([...LIFT_CHECKS]);
  });

  it('both documents record both checks, or the constant is off', () => {
    const missing = LIFT_DOCUMENTS.flatMap((document) => {
      let text = '';
      try {
        text = readFileSync(join(REPO_ROOT, document), 'utf8');
      } catch {
        return LIFT_CHECKS.map((check) => `${document}: ${check} (the document is not there)`);
      }
      return notRecorded(text).map((check) => `${document}: ${check}`);
    });
    if (CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED) expect(missing).toEqual([]);
    // Off is always allowed: the 409 is the safe side.
    expect(typeof CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED).toBe('boolean');
  });
});

// ── Rule 6: a re-address is never automatic ───────────────────────────────────────────────────

const READDRESS_FILE = `${FOLDER}/readdress.ts`;
/** Built from parts, so that this file is not itself an occurrence. */
const CONFIRMATION_MAKER = ['operator', 'Readdress', 'Confirmation'].join('');
const READDRESS_FUNCTION = ['confirm', 'Camera', 'Readdress'].join('');
/**
 * The production files that may MAKE an operator's confirmation or CALL the re-address, besides
 * the file that defines both. ONE entry since task 4 row 197 (decision C47 (29); the contract's
 * operation 100, row 194): the route edge of that operation - never the search, the candidate
 * store, a timer, a tick or a file of the capture session.
 */
const READDRESS_ROUTE_FILE = `${FOLDER}/readdress-route.ts`;
const READDRESS_CALLERS: readonly string[] = [READDRESS_ROUTE_FILE];
/** The search path: what runs without an operator's act on a device. None of these may import the re-address. */
const SEARCH_PATH = [`${FOLDER}/search.ts`, `${FOLDER}/store.ts`, `${FOLDER}/registered.ts`, `${FOLDER}/search-ids.ts`, `${FOLDER}/limits.ts`, `${FOLDER}/session-expiry.ts`, `${FOLDER}/adoption.ts`] as const;
const READDRESS_IMPORT = /from\s+['"][^'"]*\/readdress['"]/;
const naming = (sources: readonly Source[], name: string): string[] => holding(sources, new RegExp(`\\b${name}\\b`));
/** An import of the route file: only the module's plugin registers it. */
const READDRESS_ROUTE_IMPORT = /from\s+['"][^'"]*\/readdress-route['"]/;
/** What runs without a request: a timer, a hook of the app, a listener of a commit or of a closed search. */
const UNATTENDED = /\b(?:setInterval|setTimeout|setImmediate)\s*\(|\.\s*(?:after|every|addHook|onCommit|onClosed|onSearchClosed|afterCommit)\s*\(/;

/**
 * What is wrong with a route file of the re-address, as text: the maker must be called ONCE, with
 * the body of the request and nothing else, as the argument of the ONE call of the re-address
 * function, which stands in a handler of a route built from the registry; and the file holds
 * nothing that runs without a request. Empty = the call is a confirming request's.
 */
function unconfirmedCalls(text: string): string[] {
  const code = codeOf(text);
  const problems: string[] = [];
  const makerCalls = code.match(new RegExp(`\\b${CONFIRMATION_MAKER}\\s*\\(([^()]*)\\)`, 'g')) ?? [];
  if (makerCalls.length !== 1) problems.push(`the confirmation is made ${makerCalls.length} times`);
  if (makerCalls.some((call) => !new RegExp(`^${CONFIRMATION_MAKER}\\s*\\(\\s*request\\.body\\s*\\)$`).test(call))) problems.push('a confirmation is made from something that is not the body of the request');
  const calls = code.match(new RegExp(`\\b${READDRESS_FUNCTION}\\s*\\(`, 'g')) ?? [];
  if (calls.length !== 1) problems.push(`the re-address is called ${calls.length} times`);
  if (!new RegExp(`await\\s+${READDRESS_FUNCTION}\\s*\\([^;]*\\b${CONFIRMATION_MAKER}\\s*\\(\\s*request\\.body\\s*\\)\\s*\\)\\s*;`).test(code)) problems.push('the re-address is not called with the confirmation of the request');
  const handler = /handler:\s*async\s*\(request\)[^{]*\{([\s\S]*)\}\s*,?\s*\}\s*\)\s*;/.exec(code)?.[1] ?? '';
  if (!new RegExp(`\\b${READDRESS_FUNCTION}\\s*\\(`).test(handler)) problems.push('the re-address is not called inside a route handler');
  if (!/\.\.\.routeOfOperation\(/.test(code)) problems.push('the route is not built from its registry entry');
  if (UNATTENDED.test(code)) problems.push('the file holds something that runs without a request');
  return problems;
}

describe('rule 6 (task 4 rows 97 and 197): a re-address is never automatic', () => {
  it('the confirmation maker and the re-address function are named by the file that defines them and by the closed list of callers: the ONE route file of operation 100', () => {
    expect(moduleSources.some((source) => source.path === READDRESS_FILE)).toBe(true);
    expect(naming(serverSources, CONFIRMATION_MAKER)).toEqual([READDRESS_FILE, ...READDRESS_CALLERS].sort());
    expect(naming(serverSources, READDRESS_FUNCTION)).toEqual([READDRESS_FILE, ...READDRESS_CALLERS].sort());
    expect(READDRESS_CALLERS).toEqual([`${FOLDER}/readdress-route.ts`]);
  });

  it('no file of the search path imports it or the route file; the route file is imported by the module\'s plugin only', () => {
    expect(SEARCH_PATH.every((path) => moduleSources.some((source) => source.path === path))).toBe(true);
    expect(holding(serverSources, READDRESS_IMPORT)).toEqual([...READDRESS_CALLERS]);
    expect(holding(serverSources, READDRESS_ROUTE_IMPORT)).toEqual([`${FOLDER}/index.ts`]);
    // The plugin registers the route and exports its control: it names neither the maker nor the function (first case).
    const plugin = codeOf(moduleSources.find((source) => source.path === `${FOLDER}/index.ts`)?.text ?? '');
    expect(plugin.match(/\bregisterCaptureReaddressRoute\s*\(/g)).toHaveLength(1);
  });

  it('row 197: the route file makes the confirmation ONCE, from the body of the request it answers, inside the handler of the registry\'s route - and holds nothing that runs without a request', () => {
    const route = moduleSources.find((source) => source.path === READDRESS_ROUTE_FILE)?.text ?? '';
    expect(codeOf(route).length).toBeGreaterThan(1_000);
    expect(unconfirmedCalls(route)).toEqual([]);
    // It holds no statement and sends nothing: the registry is reached through the engine's door only.
    expect(WRITE_STATEMENT.test(codeOf(route))).toBe(false);
    expect(DISCOVER_CALL.test(codeOf(route))).toBe(false);
    expect(/\b(?:fetch|createConnection|createSocket|testConnection)\s*\(|\bfrom\s+['"]node:(?:net|dgram|http|https|tls|child_process)['"]/.test(codeOf(route))).toBe(false);
    // It holds no network fact of its own: no dotted quad, no prefix.
    expect(codeOf(route)).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
  });

  it('CONTROL (row 197): a planted call without a confirming request is found - a made-up confirmation, a call from a listener, a second call, a timer', () => {
    const route = moduleSources.find((source) => source.path === READDRESS_ROUTE_FILE)?.text ?? '';
    const confirming = `await ${READDRESS_FUNCTION}(seams, { principal }, ${CONFIRMATION_MAKER}(request.body));`;
    expect(route).toContain(confirming);
    // The candidate of a search, confirmed by nobody.
    expect(unconfirmedCalls(route.replace(confirming, `await ${READDRESS_FUNCTION}(seams, { principal }, ${CONFIRMATION_MAKER}({ deviceId: found.registeredDeviceId, candidateId: found.candidateId, address: found.camera.host }));`))).toContain('a confirmation is made from something that is not the body of the request');
    // A second call beside the handler's, from a listener of the search.
    const following = `${route}\nrunner.onClosed(async ({ search }) => { await ${READDRESS_FUNCTION}(seams, system, ${CONFIRMATION_MAKER}(search.moved)); });\n`;
    expect(unconfirmedCalls(following)).toEqual(expect.arrayContaining(['the confirmation is made 2 times', 'the re-address is called 2 times', 'the file holds something that runs without a request']));
    // The call moved out of the handler.
    const outside = `import { routeOfOperation } from 'x';\nexport function follow(request) { return ${READDRESS_FUNCTION}(seams, caller, ${CONFIRMATION_MAKER}(request.body)); }\nroutes.route({ ...routeOfOperation(entry), handler: async (request) => { return {}; }, });\n`;
    expect(unconfirmedCalls(outside)).toEqual(expect.arrayContaining(['the re-address is not called with the confirmation of the request', 'the re-address is not called inside a route handler']));
    // A timer in the file.
    expect(unconfirmedCalls(`${route}\nsetInterval(() => {}, 1_000);\n`)).toEqual(['the file holds something that runs without a request']);
  });

  it('the re-address file sends nothing and holds no statement: it reaches a device through no adapter and the registry through the engine\'s door only', () => {
    const code = codeOf(moduleSources.find((source) => source.path === READDRESS_FILE)?.text ?? '');
    expect(code.length).toBeGreaterThan(1_000);
    expect(WRITE_STATEMENT.test(code)).toBe(false);
    expect(DISCOVER_CALL.test(code)).toBe(false);
    expect(/\b(?:fetch|createConnection|createSocket|testConnection)\s*\(|\bfrom\s+['"]node:(?:net|dgram|http|https|tls|child_process)['"]/.test(code)).toBe(false);
    // Its imports from the adapter layer and the engine are types only.
    expect(code.match(/^import\s+(?!type\b)[^;]*from\s+['"][^'"]+['"]/gm)?.map((line) => /from\s+['"]([^'"]+)['"]/.exec(line)?.[1])).toEqual(['@dems/shared/api', '@dems/shared/sim']);
  });

  it('CONTROL: a planted caller, a planted import and a planted maker in a tick are each found', () => {
    const planted: Source[] = [
      { path: `${FOLDER}/search.ts`, text: `import { ${READDRESS_FUNCTION} } from './readdress';\nawait ${READDRESS_FUNCTION}(seams, caller, ${CONFIRMATION_MAKER}(found));` },
      { path: 'src/capture-session/tick.ts', text: `import * as followed from '../modules/capture-discovery/readdress';` },
      { path: 'src/other.ts', text: `// ${READDRESS_FUNCTION} is never called from here\nexport const a = 1;` },
    ];
    expect(naming(planted, CONFIRMATION_MAKER)).toEqual([`${FOLDER}/search.ts`]);
    expect(naming(planted, READDRESS_FUNCTION)).toEqual([`${FOLDER}/search.ts`]);
    expect(holding(planted, READDRESS_IMPORT)).toEqual([`${FOLDER}/search.ts`, 'src/capture-session/tick.ts']);
  });
});
