// The static rules of `apps/transcriber` (test strategy §C: `src/__tests__/static.test.ts`;
// transcript spec §B.2 SEC35-14; D7(d); D230).
//
// THE RULES READ THE SYNTAX TREE, NOT THE TEXT (fix round 1, navigator finding N-1). Every file is
// parsed with the TypeScript compiler; a rule then looks at what the code IS:
//
//   imports      the module a file loads (`import`, `export … from`, `import()`, `require()`), with
//                and without the `node:` prefix, and the names it takes from it;
//   accesses     a member reached with a dot OR with a bracket and a text (`process.env`,
//                `process['env']`, `globalThis.process.env`), and a member taken apart by a
//                destructuring pattern (`const { env } = process`);
//   names        an identifier used as a value (`fetch`, `console`, `eval`), whoever it is handed to;
//   keys         a member name of an object, quoted or not (`{ Authorization: x }`);
//   texts        a text as the program will hold it: `'.om' + 'lx'` is the text `.omlx`, a template
//                is its fixed parts. Comments are not in the tree, and a `//` inside a text is text.
//
// A file the parser cannot read is itself a violation, never a silent pass.
//
// WHAT THIS IS NOT. It is a guard against a careless or convenient change, read by a reviewer; it
// is not a sandbox. Code that builds a name at run time from character codes is outside any static
// reading, and stays a documented residual. The rule `NO_DYNAMIC_CODE` closes the doors that make
// that easy (`eval`, `Function`, `createRequire`, `process.mainModule`, `node:vm`, `node:module`).
import ts from 'typescript';

export interface SourceFile {
  /** POSIX path relative to `apps/transcriber`, for example `src/backends/cpu-local.ts`. */
  readonly path: string;
  readonly text: string;
}

export interface Violation {
  readonly rule: string;
  readonly path: string;
  readonly match: string;
}

export const KEY_LOADER = 'src/key-loader.ts';
export const OMLX_HTTP = 'src/backends/omlx-http.ts';
export const CPU_LOCAL = 'src/backends/cpu-local.ts';
export const PHYSICAL_CORES = 'src/host/physical-cores.ts';
export const CONFIG = 'src/config.ts';
export const LOG = 'src/log.ts';
export const MEDIA_TIME = 'src/pipeline/media-time.ts';
/** The two files that hold the patterns and the planted cases themselves. */
export const RULE_FILES = ['src/__tests__/static-rules.ts', 'src/__tests__/static.test.ts'] as const;

export function isTestFile(path: string): boolean {
  return path.includes('/__tests__/') || path.startsWith('test/') || path.endsWith('.test.ts');
}

// ───────────────────────────────────────────────────────────────────────────────────────
// Facts of one file
// ───────────────────────────────────────────────────────────────────────────────────────

interface ImportFact {
  /** The module without the `node:` prefix. */
  readonly module: string;
  /** The names taken from it; `*` for a namespace, a default or a dynamic load. */
  readonly names: readonly string[];
}

interface Facts {
  readonly imports: ImportFact[];
  /** Dotted member chains, `globalThis.` removed: `process.env`, `Date.now`, `x.listen`. */
  readonly accesses: string[];
  /** Identifiers used as a value. */
  readonly names: string[];
  /** Member names of object literals, and the texts used as an element key. */
  readonly keys: string[];
  /** Texts as the program holds them, `+` of texts folded. */
  readonly texts: string[];
  readonly numbers: number[];
  /** `shell` members of object literals: the text of their value. */
  readonly shellValues: string[];
  /** `process` used as a VALUE (assigned, passed, listed): anything but the object of a member access. */
  readonly processValues: string[];
  /** Writes aimed at a standard descriptor: `write*(0|1|2, …)` and `{ fd: 0|1|2 }`. */
  readonly descriptorWrites: string[];
  readonly syntaxErrors: number;
  readonly source: ts.SourceFile;
}

const GLOBAL_OBJECTS = new Set(['globalThis', 'global', 'window', 'self']);
const DESCRIPTOR_WRITERS = ['write', 'writeSync', 'writev', 'writevSync', 'appendFileSync', 'appendFile', 'writeFileSync', 'writeFile'];
const STANDARD_DESCRIPTORS = [0, 1, 2];

function textOf(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return textOf(node.expression);
  return null;
}

/** A `+` chain of texts as one text; null when any part is not a text. */
function foldText(node: ts.Node): string | null {
  const direct = textOf(node);
  if (direct !== null) return direct;
  if (ts.isParenthesizedExpression(node)) return foldText(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = foldText(node.left);
    const right = foldText(node.right);
    return left !== null && right !== null ? left + right : null;
  }
  return null;
}

/** The dotted chain of a member access; `?` stands for a part that is not a name or a text. */
function chainOf(node: ts.Expression): string {
  if (ts.isIdentifier(node)) return node.text;
  if (node.kind === ts.SyntaxKind.ThisKeyword) return 'this';
  if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) || ts.isAsExpression(node)) return chainOf(node.expression);
  if (ts.isPropertyAccessExpression(node)) return `${chainOf(node.expression)}.${node.name.text}`;
  if (ts.isElementAccessExpression(node)) return `${chainOf(node.expression)}.${foldText(node.argumentExpression) ?? '?'}`;
  if (ts.isCallExpression(node)) return `${chainOf(node.expression)}()`;
  return '?';
}

function stripGlobal(chain: string): string {
  const parts = chain.split('.');
  while (parts.length > 1 && GLOBAL_OBJECTS.has(parts[0] ?? '')) parts.shift();
  return parts.join('.');
}

function collect(file: SourceFile): Facts {
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TS);
  const facts: Facts = {
    imports: [],
    accesses: [],
    names: [],
    keys: [],
    texts: [],
    numbers: [],
    shellValues: [],
    processValues: [],
    descriptorWrites: [],
    syntaxErrors: (source as unknown as { parseDiagnostics?: readonly unknown[] }).parseDiagnostics?.length ?? 0,
    source,
  };

  const visit = (node: ts.Node, insideFoldedText: boolean, insideAccess: boolean): void => {
    let folded = insideFoldedText;
    let access = false;

    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      const names: string[] = [];
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        if (clause?.name !== undefined) names.push('*');
        const bindings = clause?.namedBindings;
        if (bindings !== undefined && ts.isNamespaceImport(bindings)) names.push('*');
        if (bindings !== undefined && ts.isNamedImports(bindings)) for (const element of bindings.elements) names.push((element.propertyName ?? element.name).text);
      } else {
        names.push('*');
      }
      facts.imports.push({ module: node.moduleSpecifier.text.replace(/^node:/, ''), names });
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const text = foldText(node.moduleReference.expression);
      if (text !== null) facts.imports.push({ module: text.replace(/^node:/, ''), names: ['*'] });
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const dynamic = callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require');
      const first = node.arguments[0];
      if (dynamic) {
        const text = first === undefined ? null : foldText(first);
        // A module that is not a fixed text cannot be judged: it is recorded as `?` and refused.
        facts.imports.push({ module: (text ?? '?').replace(/^node:/, ''), names: ['*'] });
      }
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const called = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isElementAccessExpression(callee) ? (foldText(callee.argumentExpression) ?? '') : '';
      const first = node.arguments[0];
      if (DESCRIPTOR_WRITERS.includes(called) && first !== undefined && ts.isNumericLiteral(first) && STANDARD_DESCRIPTORS.includes(Number(first.text))) {
        facts.descriptorWrites.push(`${called}(${first.text}, …)`);
      }
    }
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'fd' && ts.isNumericLiteral(node.initializer) && STANDARD_DESCRIPTORS.includes(Number(node.initializer.text))) {
      facts.descriptorWrites.push(`fd: ${node.initializer.text}`);
    }
    if (ts.isIdentifier(node) && node.text === 'process') {
      const parent = node.parent;
      const isObjectOfAccess = (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === node;
      const isMemberName = ts.isPropertyAccessExpression(parent) && parent.name === node;
      const isDestructured = ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isObjectBindingPattern(parent.name);
      if (!isObjectOfAccess && !isMemberName && !isDestructured) facts.processValues.push(parent.getText(source).slice(0, 60));
    }

    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      if (!insideAccess) {
        const chain = stripGlobal(chainOf(node));
        facts.accesses.push(chain);
        // `globalThis.process` as a whole expression is the process object handed on as a value.
        if (chain === 'process') facts.processValues.push(node.getText(source));
      }
      if (ts.isElementAccessExpression(node)) {
        const key = foldText(node.argumentExpression);
        if (key !== null) facts.keys.push(key);
      }
      access = true;
    }
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer !== undefined) {
      const from = stripGlobal(chainOf(node.initializer));
      for (const element of node.name.elements) {
        const taken = element.propertyName ?? element.name;
        const name = ts.isIdentifier(taken) ? taken.text : (foldText(taken) ?? '?');
        facts.accesses.push(`${from}.${name}`);
      }
    }

    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      const isMemberName =
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        (ts.isMethodDeclaration(parent) && parent.name === node) ||
        (ts.isPropertySignature(parent) && parent.name === node) ||
        (ts.isPropertyDeclaration(parent) && parent.name === node) ||
        (ts.isBindingElement(parent) && parent.propertyName === node);
      if (!isMemberName) facts.names.push(node.text);
    }

    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isMethodDeclaration(node) || ts.isPropertySignature(node)) {
      const name = node.name;
      const key = name === undefined ? null : ts.isIdentifier(name) ? name.text : ts.isComputedPropertyName(name) ? foldText(name.expression) : textOf(name);
      if (key !== null) facts.keys.push(key);
      if (key === 'shell' && ts.isPropertyAssignment(node)) facts.shellValues.push(node.initializer.getText(source));
      if (key === 'shell' && ts.isShorthandPropertyAssignment(node)) facts.shellValues.push('(shorthand)');
    }

    if (!folded) {
      const whole = foldText(node);
      if (whole !== null) {
        facts.texts.push(whole);
        folded = true;
      }
    }
    if (ts.isTemplateExpression(node)) {
      // The fixed parts of a template, joined: `${a}/.omlx/${b}` holds the text `/.omlx/`.
      facts.texts.push([node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join('\u0000'));
    }
    if (ts.isNumericLiteral(node)) facts.numbers.push(Number(node.text));

    ts.forEachChild(node, (child) => visit(child, folded, access && (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && child === (node as ts.PropertyAccessExpression).expression));
  };
  visit(source, false, false);
  return facts;
}

// ───────────────────────────────────────────────────────────────────────────────────────
// Rules
// ───────────────────────────────────────────────────────────────────────────────────────

type Check = (facts: Facts, path: string) => string | null;

interface Rule {
  readonly id: string;
  readonly allowedIn: readonly string[];
  /** True: the rule also holds in test files. */
  readonly includesTests: boolean;
  readonly check: Check;
}

const text = (pattern: RegExp): Check => (facts) => facts.texts.find((value) => pattern.test(value)) ?? null;
const name = (...names: string[]): Check => (facts) => facts.names.find((value) => names.includes(value)) ?? null;
const access = (pattern: RegExp): Check => (facts) => facts.accesses.find((value) => pattern.test(value)) ?? null;
const module = (...modules: string[]): Check => (facts) => facts.imports.find((entry) => modules.includes(entry.module) || entry.module === '?')?.module ?? null;
const any = (...checks: Check[]): Check => (facts, path) => {
  for (const check of checks) {
    const found = check(facts, path);
    if (found !== null) return found;
  }
  return null;
};

// `inspector` opens a listening port; the rest open or accept connections.
const NETWORK_MODULES = ['http', 'https', 'http2', 'net', 'tls', 'dgram', 'dns', 'inspector', 'inspector/promises', 'undici', 'axios', 'node-fetch', 'ws', 'got', 'superagent'];
const HEADER_NAMES = ['authorization', 'proxy-authorization', 'x-api-key', 'api-key'];
/** What a file may take from `child_process`: nothing that goes through a shell. */
const PROCESS_STARTERS: Readonly<Record<string, readonly string[]>> = { [CPU_LOCAL]: ['spawn', 'spawnSync'], [PHYSICAL_CORES]: ['execFileSync'] };
/** The one text with a model-file extension the workspace may hold: the constant of the id-to-file rule. */
const MODEL_FILE_EXTENSION = '.bin';

export const RULES: readonly Rule[] = [
  // SEC35-14: the settings file is named and read in the single key-loader only.
  { id: 'KEY_FILE_ONLY_IN_KEY_LOADER', allowedIn: [KEY_LOADER], includesTests: true, check: text(/\.omlx(?![A-Za-z0-9_])|settings\.json/i) },
  // The key file is under the home directory: only the key-loader asks where that is.
  { id: 'HOME_DIRECTORY_ONLY_IN_KEY_LOADER', allowedIn: [KEY_LOADER], includesTests: false, check: any(name('homedir', 'userInfo'), access(/\.(homedir|userInfo)$/), text(/^~\/|\/Users\/|\/home\//)) },
  // SEC35-14: one function turns the credential into text, and one module uses it.
  { id: 'CREDENTIAL_TEXT_ONLY_IN_HTTP_CLIENT', allowedIn: [KEY_LOADER, OMLX_HTTP], includesTests: false, check: any(name('bearerHeaderValue'), access(/\.bearerHeaderValue$/)) },
  {
    id: 'AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT',
    allowedIn: [OMLX_HTTP],
    includesTests: false,
    check: (facts) => [...facts.keys, ...facts.texts].find((value) => HEADER_NAMES.includes(value.toLowerCase())) ?? null,
  },
  // E-31: nothing is printed; a log line goes through the blanking log.
  { id: 'NO_CONSOLE', allowedIn: [], includesTests: true, check: any(name('console'), access(/(^|\.)console(\.|$)/)) },
  { id: 'NO_STDOUT_WRITE', allowedIn: [], includesTests: true, check: any(access(/(^|\.)process\.stdout(\.|$)/), name('stdout')) },
  { id: 'STDERR_ONLY_IN_LOG', allowedIn: [LOG], includesTests: true, check: any(access(/(^|\.)process\.stderr(\.|$)/), name('stderr')) },
  // OD-13 / D7(d): one module opens a connection, with the one transport of the runtime.
  { id: 'FETCH_ONLY_IN_HTTP_CLIENT', allowedIn: [OMLX_HTTP], includesTests: false, check: any(name('fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'), access(/(^|\.)fetch$/)) },
  { id: 'NO_NETWORK_MODULE', allowedIn: [], includesTests: true, check: module(...NETWORK_MODULES) },
  { id: 'NO_URL_LITERAL', allowedIn: [], includesTests: false, check: text(/:\/\/|^(https?|wss?|ftp):/i) },
  { id: 'NO_PORT_8000_LITERAL', allowedIn: [], includesTests: false, check: any((facts) => (facts.numbers.includes(8000) ? '8000' : null), text(/(^|[^0-9])8000([^0-9]|$)/)) },
  // D7(d): the transcriber never listens: it binds no port at all.
  { id: 'NEVER_LISTENS', allowedIn: [], includesTests: true, check: any(access(/\.(listen|createServer|createSecureServer)$/), name('createServer', 'createSecureServer')) },
  // §B.4 / CS-22: model, model path and engine path come from configuration only.
  {
    id: 'NO_MODEL_OR_PATH_LITERAL',
    allowedIn: [],
    includesTests: false,
    check: (facts, path) =>
      facts.texts.find((value) => {
        if (value === MODEL_FILE_EXTENSION) return path !== CONFIG;
        return /ggml|\.gguf|\.safetensors|\.bin(?![A-Za-z0-9_])|\.cache\/|whisper-large|qwen3|omnivoice|whisper\.cpp|whisper-cli/i.test(value);
      }) ?? null,
  },
  {
    id: 'NO_ENVIRONMENT_READ',
    allowedIn: [],
    includesTests: false,
    check: any(access(/(^|\.)process\.(env|loadEnvFile)(\.|$)/), module('process'), (facts) => facts.imports.find((entry) => entry.module === 'os' && entry.names.includes('userInfo'))?.module ?? null),
  },
  // The process object is used in place, member by member, so that every use can be read here:
  // an alias (`const p = process`) or a hand-over (`Reflect.get(process, 'env')`) hides the member.
  { id: 'PROCESS_OBJECT_IS_NOT_PASSED_AROUND', allowedIn: [], includesTests: false, check: (facts) => facts.processValues[0] ?? null },
  // Output goes through the log: no write to a standard descriptor, no warning channel, no report.
  { id: 'NO_DIRECT_OUTPUT', allowedIn: [], includesTests: true, check: any((facts) => facts.descriptorWrites[0] ?? null, access(/(^|\.)process\.(emitWarning|report|_rawDebug)(\.|$)/)) },
  // No runtime download or install.
  { id: 'NO_DOWNLOAD_OR_INSTALL', allowedIn: [], includesTests: true, check: text(/^(brew|pip3?|npm|npx|curl|wget|git|apt|apt-get)$|\b(brew|pip3?|npm) install\b|huggingface|hf_hub/i) },
  // The engine is started as a process in one module, with no shell in between.
  {
    id: 'CHILD_PROCESS_ONLY_IN_ENGINE_MODULES',
    allowedIn: [CPU_LOCAL, PHYSICAL_CORES],
    includesTests: false,
    check: any(module('child_process', 'worker_threads', 'cluster'), access(/(^|\.)process\.(binding|dlopen)$/)),
  },
  {
    id: 'NO_SHELL',
    allowedIn: [],
    includesTests: false,
    check: (facts, path) => {
      const shell = facts.shellValues.find((value) => value !== 'false');
      if (shell !== undefined) return `shell: ${shell}`;
      for (const entry of facts.imports) {
        if (entry.module !== 'child_process') continue;
        const allowed = PROCESS_STARTERS[path] ?? [];
        const extra = entry.names.find((taken) => !allowed.includes(taken));
        if (extra !== undefined) return `child_process.${extra}`;
      }
      return null;
    },
  },
  // W1-C3: there is no `-otype`; and no GPU switch other than the constant `-ng`.
  { id: 'NO_OTYPE_FLAG', allowedIn: [], includesTests: false, check: text(/-otype/) },
  { id: 'NO_GPU_ENABLING_FLAG', allowedIn: [], includesTests: false, check: text(/^(--use-gpu|-ug|--gpu|-dev|--device)$|GGML_METAL|use_gpu/) },
  // D230: nothing measures or reports a speed.
  {
    id: 'NO_TIMING_MEASUREMENT',
    allowedIn: [],
    includesTests: true,
    check: any(
      access(/(^|\.)(performance|Date\.now|process\.hrtime|process\.uptime|process\.cpuUsage)(\.|$)/),
      (facts) => facts.names.find((value) => ['performance', 'hrtime', 'rtf', 'wer'].includes(value.toLowerCase())) ?? null,
      module('perf_hooks'),
      text(/throughput|real[- ]time factor|\bRTF\b|\bWER\b/i),
    ),
  },
  // Row 77 / D72(d): the media-time origin of the capture contract (the AAC priming, in samples) and
  // the frame length in milliseconds are IMPORTED, never written. `log.ts` holds a byte size that
  // happens to use the same number.
  {
    id: 'MEDIA_TIME_ORIGIN_NEVER_WRITTEN',
    allowedIn: [LOG],
    includesTests: false,
    check: (facts) => {
      const found = facts.numbers.find((value) => value === 1024 || (value > 21.3 && value < 21.4));
      return found === undefined ? null : String(found);
    },
  },
  // The two doors past a static reading.
  // …and the loaders that take a module name at run time, past the import rules.
  { id: 'NO_DYNAMIC_CODE', allowedIn: [], includesTests: true, check: any(name('eval', 'Function', 'createRequire'), module('vm', 'module'), access(/(^|\.)process\.mainModule(\.|$)|(^|\.)module\.(require|createRequire)$/)) },
];

// ───────────────────────────────────────────────────────────────────────────────────────
// What a named file must contain
// ───────────────────────────────────────────────────────────────────────────────────────

function findAll<T extends ts.Node>(root: ts.Node, test: (node: ts.Node) => node is T): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node): void => {
    if (test(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

function functionNamed(source: ts.SourceFile, wanted: string): ts.FunctionDeclaration | undefined {
  return findAll(source, ts.isFunctionDeclaration).find((declaration) => declaration.name?.text === wanted);
}

function member(literal: ts.ObjectLiteralExpression, wanted: string): ts.ObjectLiteralElementLike | undefined {
  return literal.properties.find((property) => property.name !== undefined && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === wanted);
}

/** The option objects of every `spawn(...)` call of a file. */
function spawnOptions(source: ts.SourceFile): (ts.ObjectLiteralExpression | null)[] {
  return findAll(source, ts.isCallExpression)
    .filter((call) => ts.isIdentifier(call.expression) && call.expression.text === 'spawn')
    .map((call) => {
      const options = call.arguments[2];
      return options !== undefined && ts.isObjectLiteralExpression(options) ? options : null;
    });
}

interface Required {
  readonly id: string;
  readonly path: string;
  readonly holds: (source: ts.SourceFile) => boolean;
}

export const REQUIRED: readonly Required[] = [
  {
    // `export const NO_GPU_FLAG = '-ng'`: exported, constant, a plain text.
    id: 'NO_GPU_FLAG_IS_A_CONSTANT',
    path: CPU_LOCAL,
    holds: (source) =>
      findAll(source, ts.isVariableStatement).some(
        (statement) =>
          (statement.declarationList.flags & ts.NodeFlags.Const) !== 0 &&
          statement.declarationList.declarations.some((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === 'NO_GPU_FLAG' && declaration.initializer !== undefined && textOf(declaration.initializer) === '-ng'),
      ),
  },
  {
    // In `buildWhisperCliArgs`, the list `args` starts as a literal that holds NO_GPU_FLAG as a plain element.
    id: 'NO_GPU_FLAG_IS_IN_EVERY_COMMAND',
    path: CPU_LOCAL,
    holds: (source) => {
      const builder = functionNamed(source, 'buildWhisperCliArgs');
      if (builder === undefined) return false;
      return findAll(builder, ts.isVariableDeclaration).some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === 'args' &&
          declaration.initializer !== undefined &&
          ts.isArrayLiteralExpression(declaration.initializer) &&
          declaration.initializer.elements.some((element) => ts.isIdentifier(element) && element.text === 'NO_GPU_FLAG'),
      );
    },
  },
  {
    // Every `spawn` passes `env: ENGINE_ENVIRONMENT`: the engine never inherits the parent's variables.
    id: 'ENGINE_ENVIRONMENT_IS_ALLOW_LISTED',
    path: CPU_LOCAL,
    holds: (source) => {
      const all = spawnOptions(source);
      return (
        all.length > 0 &&
        all.every((options) => {
          const env = options === null ? undefined : member(options, 'env');
          return env !== undefined && ts.isPropertyAssignment(env) && ts.isIdentifier(env.initializer) && env.initializer.text === 'ENGINE_ENVIRONMENT';
        })
      );
    },
  },
  {
    id: 'ENGINE_STARTS_WITHOUT_A_SHELL',
    path: CPU_LOCAL,
    holds: (source) => {
      const all = spawnOptions(source);
      return (
        all.length > 0 &&
        all.every((options) => {
          const shell = options === null ? undefined : member(options, 'shell');
          return shell !== undefined && ts.isPropertyAssignment(shell) && shell.initializer.kind === ts.SyntaxKind.FalseKeyword;
        })
      );
    },
  },
  {
    // Every `redirect` member of the HTTP client is 'error', and there is one.
    id: 'REDIRECTS_ARE_ERRORS',
    path: OMLX_HTTP,
    holds: (source) => {
      const redirects = findAll(source, ts.isPropertyAssignment).filter((property) => ts.isIdentifier(property.name) && property.name.text === 'redirect');
      return redirects.length > 0 && redirects.every((property) => textOf(property.initializer) === 'error');
    },
  },
  {
    // `createOmlxHttp` calls `assertLoopbackEndpoint` itself.
    id: 'HTTP_CLIENT_RECHECKS_LOOPBACK',
    path: OMLX_HTTP,
    holds: (source) => {
      const factory = functionNamed(source, 'createOmlxHttp');
      return factory !== undefined && findAll(factory, ts.isCallExpression).some((call) => ts.isIdentifier(call.expression) && call.expression.text === 'assertLoopbackEndpoint');
    },
  },
];

// Appended by row 77.
const ROW_77_REQUIRED: readonly Required[] = [
  {
    // `media-time.ts` takes CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES from the shared package, by name.
    id: 'MEDIA_TIME_ORIGIN_IS_IMPORTED',
    path: MEDIA_TIME,
    holds: (source) =>
      findAll(source, ts.isImportDeclaration).some(
        (declaration) =>
          ts.isStringLiteral(declaration.moduleSpecifier) &&
          ['@dems/shared', '@dems/shared/api'].includes(declaration.moduleSpecifier.text) &&
          declaration.importClause?.namedBindings !== undefined &&
          ts.isNamedImports(declaration.importClause.namedBindings) &&
          declaration.importClause.namedBindings.elements.some((element) => (element.propertyName ?? element.name).text === 'CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES'),
      ),
  },
];

export const UNPARSEABLE = 'UNPARSEABLE_SOURCE';
export const RULE_IDS: readonly string[] = [...RULES.map((rule) => rule.id), UNPARSEABLE];
const ALL_REQUIRED: readonly Required[] = [...REQUIRED, ...ROW_77_REQUIRED];
export const REQUIRED_IDS: readonly string[] = ALL_REQUIRED.map((required) => required.id);

export function scanSources(files: readonly SourceFile[]): Violation[] {
  const violations: Violation[] = [];
  const parsed = new Map<string, Facts>();
  for (const file of files) {
    if ((RULE_FILES as readonly string[]).includes(file.path)) continue;
    const facts = collect(file);
    parsed.set(file.path, facts);
    if (facts.syntaxErrors > 0) violations.push({ rule: UNPARSEABLE, path: file.path, match: `${facts.syntaxErrors} syntax error(s)` });
    for (const rule of RULES) {
      if (rule.allowedIn.includes(file.path)) continue;
      if (!rule.includesTests && isTestFile(file.path)) continue;
      const match = rule.check(facts, file.path);
      if (match !== null) violations.push({ rule: rule.id, path: file.path, match: match.slice(0, 80) });
    }
  }
  for (const required of ALL_REQUIRED) {
    const facts = parsed.get(required.path);
    if (facts === undefined || !required.holds(facts.source)) violations.push({ rule: required.id, path: required.path, match: '(absent)' });
  }
  return violations;
}
