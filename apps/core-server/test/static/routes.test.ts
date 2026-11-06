// Static guard: the identity core and the health module register their routes from the registry
// and in no other way (checkpoint CP-B1, finding CPB1-17; decision D83 DN-8; standing rules M2
// and M3).
//
// The shape of a route (the registry's method and path, `config.operationId` naming it) is
// enforced at run time by the permission guard: its `onRoute` hook resolves every route against
// the registry and `app.ready()` stops on one that does not fit (`plugins/permission-guard`,
// tested in its `boot-registry.test.ts` and, on the real app, in `registered-routes.test.ts`).
// What the guard cannot see is HOW a module wrote the route. These two files once had a second
// way each: a local `routeOf` beside `routeOfOperation`, a bare `.get(path, …)`, and route-level
// `onRequest` hooks that repeated stage 6 and so hid a defect of it from an HTTP test. This
// test keeps the one way: every route is `.route({ ...routeOfOperation(<registry entry>), … })`,
// with no hook of its own.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from './scan';

/** The files that register the routes of the two modules, with the number of routes each registers. */
const ROUTE_FILES: Readonly<Record<string, number>> = {
  'src/modules/identity/routes.ts': 5,
  'src/modules/health/index.ts': 1,
};

const REGISTRATION = /\.\s*route\s*\(\s*\{/g;
const FROM_REGISTRY = /\.\s*route\s*\(\s*\{\s*\.\.\.routeOfOperation\(/g;
const SHORTHAND = /\.\s*(?:get|post|put|patch|delete|head|options|all)\s*\(/g;
const ROUTE_HOOK = /\b(?:onRequest|preParsing|preValidation|preHandler|preSerialization|onSend|onResponse)\s*:|\baddHook\s*\(/g;
const OWN_ROUTE_BUILDER = /\bfunction\s+routeOf\b|\bconst\s+routeOf\b|\bmethod\s*:\s*['"`]|\burl\s*:/g;
const HELPER_IMPORT = /import\s*\{[^}]*\brouteOfOperation\b[^}]*\}\s*from\s*'\.\.\/\.\.\/plugins\/permission-guard';/;

const production = codeOnly(readTree(WORKSPACE).filter((file) => isProductionSource(file.path)));
const sourceOf = (path: string): SourceFile => ({ path, text: production.find((file) => file.path === path)?.text ?? '' });

/** What is wrong with the way a file registers its routes; empty when nothing is. */
function problemsOf(file: SourceFile, routes: number): string[] {
  const count = (pattern: RegExp): number => occurrences([file], pattern).length;
  const problems: string[] = [];
  if (file.text === '') problems.push(`${file.path}: not found`);
  if (count(REGISTRATION) !== routes) problems.push(`${file.path}: ${count(REGISTRATION)} routes registered with .route({ … }), expected ${routes}`);
  if (count(FROM_REGISTRY) !== count(REGISTRATION)) problems.push(`${file.path}: a route is not built with routeOfOperation(<registry entry>)`);
  if (!HELPER_IMPORT.test(file.text)) problems.push(`${file.path}: routeOfOperation is not imported from plugins/permission-guard`);
  for (const place of occurrences([file], SHORTHAND)) problems.push(`${place}: a route registered by a method shorthand`);
  for (const place of occurrences([file], ROUTE_HOOK)) problems.push(`${place}: a hook of the module's own`);
  for (const place of occurrences([file], OWN_ROUTE_BUILDER)) problems.push(`${place}: a method or a path written by the module itself`);
  return problems;
}

describe('the scan itself', () => {
  it('finds each other way of registering a route when it is present (positive control)', () => {
    const good: SourceFile = {
      path: 'src/modules/x/routes.ts',
      text: "import { routeOfOperation } from '../../plugins/permission-guard';\nroutes.route({\n  ...routeOfOperation(operationOf('a')),\n  schema: {},\n  handler: async () => ({}),\n});",
    };
    expect(problemsOf(good, 1)).toEqual([]);
    expect(problemsOf(good, 2)).toEqual(['src/modules/x/routes.ts: 1 routes registered with .route({ … }), expected 2']);

    const planted = (text: string): string[] => problemsOf({ path: 'p.ts', text: `${good.text}\n${text}` }, 1).map((problem) => problem.replace(/^p\.ts(?::\d+)?: /, ''));
    expect(planted("app.get(HEALTH_PATH, { config: { operationId } }, async () => ({}));")).toEqual(['a route registered by a method shorthand']);
    expect(planted("routes.route({ ...routeOf('signIn'), handler });\nfunction routeOf(id: string) { return { method: 'GET', url: path }; }")).toEqual([
      '2 routes registered with .route({ … }), expected 1',
      'a route is not built with routeOfOperation(<registry entry>)',
      'a method or a path written by the module itself',
      'a method or a path written by the module itself',
      'a method or a path written by the module itself',
    ]);
    expect(planted('const options = { onRequest: operatorOnly };')).toEqual(["a hook of the module's own"]);
    expect(planted("app.addHook('preHandler', check);")).toEqual(["a hook of the module's own"]);
    expect(problemsOf({ path: 'q.ts', text: good.text.replace("'../../plugins/permission-guard'", "'./local'") }, 1)).toEqual(['q.ts: routeOfOperation is not imported from plugins/permission-guard']);
  });
});

describe('CPB1-17: the routes of the identity core and of the health module', () => {
  it('are built with routeOfOperation from their registry entries, by no other way, and carry no hook of their own', () => {
    const problems = Object.entries(ROUTE_FILES).flatMap(([path, routes]) => problemsOf(sourceOf(path), routes));
    expect(problems).toEqual([]);
  });
});
