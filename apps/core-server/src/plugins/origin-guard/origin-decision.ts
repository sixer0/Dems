/**
 * The Origin decision of the Core server (plan row W23; hand-built element HB-6; spec §2.4,
 * §14.2 OR-1 to OR-4; SR-19, SR-69, SR-70). Pure functions: no Fastify instance, no state, no
 * clock. Stage 3 of the request pipeline and the seam `originDecision` are built on them
 * (`index.ts`), and the realtime channel's upgrade is decided by the same function.
 *
 * Three steps, each one function:
 *   1. `classifyOrigin`   where the `Origin` header falls: absent, a web console origin, one of
 *                         the instance's own origins, anything else;
 *   2. `requestKindOf`    what kind of request it is: a read, a command, a socket upgrade;
 *   3. `decideOrigin`     the two decision tables of spec §14.2.
 *
 * The decision looks at the presence of a credential only. Whether the credential is valid is
 * stage 4's question, and a request that carries two credentials is refused there (ID-12).
 */

/** Where the `Origin` header of a request falls (spec §14.2, the columns of the decision table). */
export const OriginCategory = {
  /** No `Origin` header. */
  ABSENT: 'ABSENT',
  /** One of the web console origins (the Vite dev server of the main instance or of a lane). */
  WEB_CONSOLE: 'WEB_CONSOLE',
  /** One of the instance's own origins; never counts as a web console. */
  OWN: 'OWN',
  /** Any other value, the literal `null` included. */
  OTHER: 'OTHER',
} as const;
export type OriginCategory = (typeof OriginCategory)[keyof typeof OriginCategory];

/** What stage 3 found on a request. Presence only: whether a credential is valid is stage 4's. */
export interface OriginFacts {
  readonly category: OriginCategory;
  /** This instance's session cookie is present. */
  readonly hasCookie: boolean;
  /** An `Authorization` header is present. */
  readonly hasBearer: boolean;
}

/** The two lists of the server configuration (spec §2.4). */
export interface OriginLists {
  readonly webConsoleOrigins: readonly string[];
  readonly ownOrigins: readonly string[];
}

/**
 * Classifies the value of the `Origin` header by an exact string match on the serialised origin
 * (OR-1): scheme, host and port, with no case folding, no trimming, no trailing slash and no
 * wildcard. So `http://localhost:5173`, `HTTP://127.0.0.1:5173`, `http://127.0.0.1:5173/`,
 * another port, the literal `null`, an empty value and a repeated header are all OTHER.
 */
export function classifyOrigin(header: string | readonly string[] | undefined, lists: OriginLists): OriginCategory {
  if (header === undefined) return OriginCategory.ABSENT;
  // A header that was sent twice is not one origin.
  if (typeof header !== 'string') return OriginCategory.OTHER;
  if (lists.webConsoleOrigins.includes(header)) return OriginCategory.WEB_CONSOLE;
  if (lists.ownOrigins.includes(header)) return OriginCategory.OWN;
  return OriginCategory.OTHER;
}

/** What the request is, as far as the cookie's rule is concerned (OR-2, OR-3). */
export const OriginRequestKind = {
  /** A GET: it never changes state (API-2). */
  READ: 'READ',
  /** Every other method: a command. */
  COMMAND: 'COMMAND',
  /** A request that carries an `Upgrade` header: the handshake of the realtime channel. */
  UPGRADE: 'UPGRADE',
} as const;
export type OriginRequestKind = (typeof OriginRequestKind)[keyof typeof OriginRequestKind];

/**
 * An `Upgrade` header makes the request an upgrade, whatever its method: Node hands a request
 * to the socket path only when that header is present, so no upgrade escapes the stricter rule,
 * and a plain request that adds the header only makes its own rule stricter.
 */
export function requestKindOf(method: string, upgradeHeader: string | undefined): OriginRequestKind {
  if (upgradeHeader !== undefined) return OriginRequestKind.UPGRADE;
  return method === 'GET' ? OriginRequestKind.READ : OriginRequestKind.COMMAND;
}

export const OriginVerdict = {
  /** Stage 3 lets the request through. */
  ALLOW: 'ALLOW',
  /** 403 `ORIGIN_NOT_ALLOWED`; on an upgrade, the HTTP 403 of the handshake. */
  REFUSE: 'REFUSE',
} as const;
export type OriginVerdict = (typeof OriginVerdict)[keyof typeof OriginVerdict];

/**
 * The two decision tables of spec §14.2, as stage 3 applies them.
 *
 *   credential present   no Origin              own origin   web console origin   other, or `null`
 *   cookie               READ: allow            refuse       allow                refuse
 *                        COMMAND, UPGRADE:
 *                        refuse
 *   bearer               allow                  allow        refuse               refuse
 *   none                 allow                  allow        allow                refuse
 *   cookie and bearer    as the cookie row; what stage 3 allows, stage 4 refuses with 401
 *
 * The HTTP table and the upgrade table differ in one place only: a cookie without an `Origin`
 * is accepted on a read (a same-origin GET carries none, OR-3) and refused on a command and on
 * an upgrade (a browser always sends its `Origin` on those, OR-2).
 */
export function decideOrigin(facts: OriginFacts, kind: OriginRequestKind): OriginVerdict {
  const { category, hasCookie, hasBearer } = facts;

  // An origin in neither list is refused whatever the request carries (OR-1).
  if (category === OriginCategory.OTHER) return OriginVerdict.REFUSE;

  if (hasCookie) {
    // The cookie is valid only together with a web console origin (OR-2); one of the
    // instance's own origins never satisfies that (OR-1).
    if (category === OriginCategory.WEB_CONSOLE) return OriginVerdict.ALLOW;
    if (category === OriginCategory.OWN) return OriginVerdict.REFUSE;
    return kind === OriginRequestKind.READ ? OriginVerdict.ALLOW : OriginVerdict.REFUSE;
  }

  // A browser never attaches a bearer value by itself, so a bearer request with a web console
  // origin is one no client of this design produces (OR-4).
  if (hasBearer) return category === OriginCategory.WEB_CONSOLE ? OriginVerdict.REFUSE : OriginVerdict.ALLOW;

  // No credential: ANONYMOUS. Whether it counts as a web console is the identity module's
  // question (ID-1), which reads the category through the seam.
  return OriginVerdict.ALLOW;
}

/** What the log shows for a value that does not have the shape of a serialised origin. */
export const UNLOGGABLE_ORIGIN = '[not an origin]';

// scheme "://" host [":" port], with a bounded length for each part. No path, no query, no
// user part, no whitespace, no control character can match.
const SERIALISED_ORIGIN =
  /^[a-z][a-z0-9+.-]{0,31}:\/\/(?:[a-z0-9.-]{1,253}|\[[0-9a-f:.]{2,45}\])(?::[0-9]{1,5})?$/i;

/**
 * The `Origin` value as a log line may hold it: scheme, host and port when the value has
 * exactly that shape, the literal `null`, or a fixed text. A path, a query string or anything
 * else a caller appends is never written to the log.
 */
export function originForLog(header: string | readonly string[] | undefined): string | null {
  if (header === undefined) return null;
  if (typeof header !== 'string') return UNLOGGABLE_ORIGIN;
  if (header === 'null') return header;
  return SERIALISED_ORIGIN.test(header) ? header : UNLOGGABLE_ORIGIN;
}
