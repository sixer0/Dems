/**
 * The routes of the router, read back from Fastify's printed route table (plan row W28;
 * decision D82, condition 4).
 *
 * Why a printed table. The guard's `onRoute` hook sees every route that is registered once the
 * guard is loaded: the routes of every unit. A route that was added to the instance BEFORE the
 * plugins ran is in the router and was never shown to that hook, and Fastify has no call that
 * lists the registered routes: `findRoute` wants the route named, and gives back neither a list
 * nor the route's configuration. `printRoutes()` is the one public view of the whole router, so
 * the boot step reads the routes from it and holds each one against the registry.
 *
 * The default form is the router's radix tree, one node per line:
 *
 *     └── /
 *         ├── api/v1/
 *         │   ├── health (GET)
 *         │   └── session (POST)
 *         │       └── /
 *         │           └── :id
 *         │               └── /start (POST)
 *         └── ws (GET)
 *
 * Every level is four characters of drawing, the text after it is a fragment of the path, and a
 * node that is a route ends with its methods in brackets. The path of a route is the fragments
 * from the root to its node, joined. (The flat form, `commonPrefix: false`, is NOT used: it
 * prints a wildcard route without the path in front of it.)
 *
 * What the table cannot give: a route's `config`, so not its `operationId`. A route found here
 * is therefore held to the registry by method and path only.
 *
 * Pure: text in, routes out.
 */

/** A route of the router: its method and its pattern. */
export interface RouterRoute {
  readonly method: string;
  readonly url: string;
}

/** One level of tree drawing: `│   `, `    `, `├── ` or `└── `. */
const LEVEL_WIDTH = 4;
/** The drawing in front of a node's text: any number of levels, the last one a branch. */
const NODE = /^((?:[│ ] {3})*)[├└]── (.*)$/;
/** A node that is a route: its fragment, then the methods in brackets. */
const ROUTE = /^(.*) \(([A-Z]+(?:, [A-Z]+)*)\)$/;

/**
 * The routes of a printed route table, in the order they are printed. A line that is no node of
 * the tree makes the whole table unreadable: the function throws rather than skip it, because a
 * route that is skipped is a route that is not checked.
 */
export function routesOfPrintedTable(table: string): RouterRoute[] {
  const routes: RouterRoute[] = [];
  /** The fragments from the root down to the node that was read last. */
  const fragments: string[] = [];

  for (const line of table.split('\n')) {
    if (line.trim() === '') continue;
    const node = NODE.exec(line);
    if (node === null) throw new Error('the printed route table holds a line that is no node of the route tree');
    const depth = (node[1] ?? '').length / LEVEL_WIDTH;
    const text = node[2] ?? '';
    const route = ROUTE.exec(text);
    // Methods in a form this file does not know (a constrained route, for example): unreadable.
    if (route === null && /\([A-Z]/.test(text)) throw new Error('the printed route table holds a route in a form that is not known');
    fragments.length = depth;
    fragments[depth] = route === null ? text : (route[1] ?? '');
    if (route === null) continue;
    const url = fragments.join('');
    for (const method of (route[2] ?? '').split(', ')) routes.push({ method, url });
  }
  return routes;
}
