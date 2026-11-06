/**
 * The table of registered routes, filled by an `onRoute` hook. Its one use: when the router
 * finds no route, to tell "known path, other method" (405 with `allow`) from "unknown path"
 * (404). Fastify's router does not expose a lookup by path alone.
 *
 * Patterns are those of the registry (API-2, API-3): static segments and `:name` parameters.
 */

interface RecordedRoute {
  readonly method: string;
  readonly pattern: string;
  readonly matcher: RegExp;
}

/** A known path: its route pattern and the methods registered for it, sorted. */
export interface KnownPath {
  readonly pattern: string;
  readonly methods: readonly string[];
}

export interface RouteTable {
  /** The `onRoute` hook body: records one route for each of its methods. */
  record(route: { readonly method: string | readonly string[]; readonly url: string }): void;
  /** What is registered for a concrete path; null when no route has that path. */
  lookup(path: string): KnownPath | null;
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `/api/v1/session/:id/start` becomes `^/api/v1/session/[^/]+/start$`; a `*` segment matches the rest. */
export function patternToRegExp(pattern: string): RegExp {
  const source = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) return '[^/]+';
      if (segment === '*') return '.*';
      return escapeForRegExp(segment);
    })
    .join('/');
  return new RegExp(`^${source}$`);
}

export function createRouteTable(): RouteTable {
  const routes: RecordedRoute[] = [];
  return {
    record(route) {
      const matcher = patternToRegExp(route.url);
      const methods = typeof route.method === 'string' ? [route.method] : route.method;
      for (const method of methods) routes.push({ method: method.toUpperCase(), pattern: route.url, matcher });
    },
    lookup(path) {
      const matching = routes.filter((route) => route.matcher.test(path));
      const first = matching[0];
      if (first === undefined) return null;
      return { pattern: first.pattern, methods: [...new Set(matching.map((route) => route.method))].sort() };
    },
  };
}
