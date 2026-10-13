// Static guard: network exposure (spec SR-01, SR-03, SR-04, OR-5, OR-7; decision D26, finding
// F27; plan P5, P20, P21).
//
//   - Only the entry point listens, and on the constant host 127.0.0.1.
//   - No wildcard address, no `localhost` origin, no CORS plugin and no CORS header.
//   - The database endpoint comes from the connection file only: the default PostgreSQL port
//     appears once, where the configuration refuses it, and no driver variable is named.
//   - The environment is read by the entry point only.
//   - The server opens no outbound connection, and it imports nothing from mock-core.
// "Production sources" are `src/**` without test files; a test may listen on an ephemeral
// loopback port, and may name a forbidden value to assert that it is refused.
import { describe, expect, it } from 'vitest';
import { FOREIGN_DATABASE_PORT, LISTEN_HOST } from '../../src/config';
import {
  WORKSPACE,
  codeOnly,
  isProductionSource,
  literal,
  occurrences,
  readTree,
  stripComments,
  under,
  type SourceFile,
} from './scan';

const WILDCARD_ADDRESS = [0, 0, 0, 0].join('.');
const DEFAULT_PORT = new RegExp(`\\b${[54, 32].join('')}\\b`, 'g');
const DRIVER_VARIABLE = new RegExp(
  `\\b${'PG'}(?:HOST|HOSTADDR|PORT|USER|DATABASE|PASSFILE|SERVICE|SSLMODE|OPTIONS|APPNAME)\\b`,
  'g',
);
const LISTEN_CALL = /\.listen\s*\(/g;
const ENVIRONMENT = /\bprocess\s*\.\s*env\b/g;
const LOCALHOST_ORIGIN = new RegExp(`['"\`]https?://${['local', 'host'].join('')}`, 'gi');
const CORS_PLUGIN = literal(['@fastify', 'cors'].join('/'));
const CORS_HEADER = new RegExp(['access', 'control', 'allow', ''].join('-'), 'gi');
const MOCK_CORE_IMPORT = new RegExp(
  `(?:from\\s+|import\\s*\\(\\s*|require\\s*\\(\\s*)['"][^'"]*${['mock', 'core'].join('-')}`,
  'g',
);
const GLOBAL_FETCH = /(?<![.\w$])fetch\s*\(/g;
const OUTBOUND_MODULE = new RegExp(
  // The last name is the stream-socket module (named entry SR-6, decision C53 (4a)): until then this rule did not look at it at all.
  `['"](?:node:)?(?:${['https', 'http2', 'dgram', 'tls', 'undici', 'axios', ['node', 'fetch'].join('-'), ['n', 'et'].join('')].join('|')})['"]`,
  'g',
);

/** Root configuration files of the workspace, which are not under `src/`. */
const ROOT_CONFIGURATION = ['package.json', 'tsconfig.json', 'vitest.config.ts', 'drizzle.config.ts'];

const server = readTree(WORKSPACE);
// These rules are about what the code does, so comments are left out: a sentence that names
// `process.env` or a port is not a use of it.
const production = codeOnly(server.filter((file) => isProductionSource(file.path)));
const runtime = production.filter((file) => !file.path.startsWith('src/db/'));

describe('the scan itself', () => {
  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/a.ts', text: `await app.listen({ host: '${WILDCARD_ADDRESS}', port: ${[54, 32].join('')} });` },
      { path: 'src/b.ts', text: `const host = process.env.${'PG'}HOST ?? 'x';\nfetch('https://example.org');` },
      { path: 'src/c.ts', text: `const origins = ['http://${['local', 'host'].join('')}:5173'];` },
      { path: 'src/d.ts', text: `import cors from '${['@fastify', 'cors'].join('/')}';\nreply.header('${['Access', 'Control', 'Allow', 'Origin'].join('-')}', '*');` },
      { path: 'src/e.ts', text: `import { buildApp } from '../../${['mock', 'core'].join('-')}/src/app';\nimport https from 'node:https';` },
    ];
    expect(occurrences(planted, LISTEN_CALL)).toEqual(['src/a.ts:1']);
    expect(occurrences(planted, literal(WILDCARD_ADDRESS))).toEqual(['src/a.ts:1']);
    expect(occurrences(planted, DEFAULT_PORT)).toEqual(['src/a.ts:1']);
    expect(occurrences(planted, DRIVER_VARIABLE)).toEqual(['src/b.ts:1']);
    expect(occurrences(planted, ENVIRONMENT)).toEqual(['src/b.ts:1']);
    expect(occurrences(planted, GLOBAL_FETCH)).toEqual(['src/b.ts:2']);
    expect(occurrences(planted, LOCALHOST_ORIGIN)).toEqual(['src/c.ts:1']);
    expect(occurrences(planted, CORS_PLUGIN)).toEqual(['src/d.ts:1']);
    expect(occurrences(planted, CORS_HEADER)).toEqual(['src/d.ts:2']);
    expect(occurrences(planted, MOCK_CORE_IMPORT)).toEqual(['src/e.ts:1']);
    expect(occurrences(planted, OUTBOUND_MODULE)).toEqual(['src/e.ts:2']);
    // Not a call of the global: a method, another name.
    expect(occurrences([{ path: 'x.ts', text: 'query.refetch(); client.fetch(); prefetch();' }], GLOBAL_FETCH)).toEqual([]);
  });

  it('leaves comments out and keeps strings and line numbers', () => {
    const text = [
      '/* block: process.env */ const a = 1; // line: process.env',
      "const url = 'http://127.0.0.1:4420'; // the // inside the string is not a comment",
      '/**',
      ' * process.env',
      ' */',
      'const b = process.env.X;',
    ].join('\n');
    const stripped = stripComments(text);
    expect(stripped.split('\n')).toHaveLength(6);
    expect(stripped).toContain("const url = 'http://127.0.0.1:4420';");
    expect(occurrences([{ path: 'x.ts', text: stripped }], ENVIRONMENT)).toEqual(['x.ts:6']);
  });
});

describe('SR-01: one listener, on loopback', () => {
  it('only src/index.ts listens', () => {
    const elsewhere = occurrences(production, LISTEN_CALL, (path) => path !== 'src/index.ts');
    expect(elsewhere).toEqual([]);
    expect(occurrences(production, LISTEN_CALL)).toHaveLength(1);
  });

  it('the entry point binds the constant host and the configured port, and the constant is 127.0.0.1', () => {
    const entry = production.find((file) => file.path === 'src/index.ts');
    expect(entry?.text).toMatch(/await app\.listen\(\{ host: LISTEN_HOST, port: config\.port \}\);/);
    expect(LISTEN_HOST).toBe('127.0.0.1');
    // No other property named `host` is passed anywhere in the entry point.
    expect(occurrences(entry ? [entry] : [], /\bhost\s*:/g)).toHaveLength(1);
  });

  it('no production source names the wildcard address', () => {
    expect(occurrences(production, literal(WILDCARD_ADDRESS))).toEqual([]);
  });

  it('the environment is read by the entry point only', () => {
    expect(occurrences(runtime, ENVIRONMENT, (path) => path !== 'src/index.ts')).toEqual([]);
  });
});

describe('D26, F27: the database endpoint has no default', () => {
  it("PostgreSQL's default port appears once: in src/config.ts, where it is refused", () => {
    expect(FOREIGN_DATABASE_PORT).toBe(Number([54, 32].join('')));
    const rootConfiguration = server.filter((file) => under(file.path, ROOT_CONFIGURATION));
    const found = occurrences([...production, ...rootConfiguration], DEFAULT_PORT);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^src\/config\.ts:\d+$/);
  });

  it('no production source names a variable that the driver reads on its own', () => {
    expect(occurrences(production, DRIVER_VARIABLE)).toEqual([]);
  });
});

describe('SR-04, OR-5, OR-7: no CORS, no localhost origin', () => {
  it('nothing under apps/core-server imports the CORS plugin, and the manifest does not list it', () => {
    expect(occurrences(server, CORS_PLUGIN)).toEqual([]);
  });

  it('no production source sets a CORS header', () => {
    expect(occurrences(production, CORS_HEADER)).toEqual([]);
  });

  it('no production source holds a localhost origin', () => {
    expect(occurrences(production, LOCALHOST_ORIGIN)).toEqual([]);
  });
});

describe('SR-03, P5, P21: nothing leaves the process, nothing comes from mock-core', () => {
  // M4-SEC-NET-1 (SEC35-27): the exemptions are by FILE, pinned by name, one module each. Row 131
  // pins the datagram half; row 142 adds `onvif-session.ts` for the ONVIF client here, and nowhere else.
  const OUTBOUND_EXEMPTIONS: Readonly<Record<string, readonly string[]>> = {
    'src/capture/adapters/camera/ws-discovery.ts': [['node:', 'dg', 'ram'].join('')],
    // Row 142: the read-only connection test toward a camera candidate. Its agent of the secure module is the one
    // outbound import this pattern sees; the ONVIF client package itself is pinned to the same file by rule G-R11
    // (`src/capture/__tests__/static.test.ts`).
    'src/capture/adapters/camera/onvif-session.ts': [['node:', 'ht', 'tps'].join('')],
    // NAMED ENTRY SR-6 (decision C53 (4a); request line `row 105 (agent R7) | decisions/decisions.md`): `src/host-alias-socket.ts`,
    // a file of no unit, is the ONE importer of the stream-socket module in the server's production sources, for
    // `createConnection` with a PATH only; G-R1, G-R2 and G-R10 are unchanged (no socket module under the host units or
    // under `capture/`); the transport is handed into `capture/host-alias/caller.ts`.
    'src/host-alias-socket.ts': [['node:', 'n', 'et'].join('')],
  };

  it('the server runtime calls no global fetch and imports no outbound client, except from the pinned files', () => {
    expect(occurrences(runtime, GLOBAL_FETCH)).toEqual([]);
    expect(occurrences(runtime, OUTBOUND_MODULE, (path) => !(path in OUTBOUND_EXEMPTIONS))).toEqual([]);
    // A pinned file imports exactly its one module, and every pinned file exists.
    for (const [path, modules] of Object.entries(OUTBOUND_EXEMPTIONS)) {
      const file = runtime.find((entry) => entry.path === path);
      expect(file, path).toBeDefined();
      expect((file?.text.match(OUTBOUND_MODULE) ?? []).map((text) => text.replace(/['"]/g, '')), path).toEqual(modules);
    }
  });

  it('a third file that imports the datagram module, or a pinned file that imports a second outbound module, is found (positive control)', () => {
    const datagram = ['node:', 'dg', 'ram'].join('');
    const planted: SourceFile[] = [
      { path: 'src/capture/adapters/camera/ws-discovery.ts', text: `import { createSocket } from '${datagram}';\nimport { request } from 'node:${'https'}';` },
      { path: 'src/modules/capture-config/search.ts', text: `import { createSocket } from '${datagram}';` },
      { path: 'src/capture/adapters/camera/probe-answer.ts', text: `import dgram from '${['dg', 'ram'].join('')}';` },
    ];
    expect(occurrences(planted, OUTBOUND_MODULE, (path) => !(path in OUTBOUND_EXEMPTIONS))).toEqual(['src/modules/capture-config/search.ts:1', 'src/capture/adapters/camera/probe-answer.ts:1']);
    expect((planted[0]?.text.match(OUTBOUND_MODULE) ?? []).map((text) => text.replace(/['"]/g, ''))).not.toEqual(OUTBOUND_EXEMPTIONS['src/capture/adapters/camera/ws-discovery.ts']);
    // Row 142: a second file with a secure agent is found, and the pinned file with a second outbound module is not its pin.
    const secure = ['node:', 'ht', 'tps'].join('');
    const session: SourceFile[] = [
      { path: 'src/capture/adapters/camera/onvif-session.ts', text: `import { Agent } from '${secure}';\nimport { connect } from 'node:${'tls'}';` },
      { path: 'src/modules/capture-discovery/connect/service.ts', text: `import { request } from '${secure}';` },
    ];
    expect(occurrences(session, OUTBOUND_MODULE, (path) => !(path in OUTBOUND_EXEMPTIONS))).toEqual(['src/modules/capture-discovery/connect/service.ts:1']);
    expect((session[0]?.text.match(OUTBOUND_MODULE) ?? []).map((text) => text.replace(/['"]/g, ''))).not.toEqual(OUTBOUND_EXEMPTIONS['src/capture/adapters/camera/onvif-session.ts']);
  });

  it('nothing under apps/core-server imports from mock-core', () => {
    expect(occurrences(server, MOCK_CORE_IMPORT)).toEqual([]);
  });
});
