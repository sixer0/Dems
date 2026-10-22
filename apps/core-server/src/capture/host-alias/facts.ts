/**
 * The reader of the host's facts for the address helper's caller (task 4 row 106, WP-19b; design
 * rule DR-4; review finding F-07; decision C64).
 *
 * THREE SOURCES, each HANDED IN (this file reads no interface, no file and no row itself):
 *   network          the Core's ONE reader of the network facts (`captureNetworkFacts(app)` of row
 *                    108): the stored subnet joined with the host's interface table, or null;
 *   storedInterface  `capture_network_config.interface_name`, or null when none was chosen;
 *   fileInterface    the one name of the helper's interface file, asked through the host runner
 *                    (row 81's command); anything that is not one name is "unreadable".
 *
 * WHAT THE CALLER THEN DECIDES (row 105): no stored interface = `NETWORK_NOT_CONFIGURED`; file and
 * row differ = `INTERFACE_FILE_DIFFERS_FROM_ROW`; the wrong-network guard on the three network
 * members. A stored interface with NO network facts (no subnet chosen, the host has no such
 * interface, a fact that cannot be read) THROWS here: the caller reads a reader that throws as a
 * host it cannot see and refuses (`HOST_FACTS_UNREADABLE`). Nothing is guessed.
 *
 * THE SWEEP'S CANDIDATES. The helper cannot list what it marked (its verbs are `add`, `del` and
 * root's `check`), and the Core does not read the helper's folder. Two honest sources remain:
 *   - `aliasAddressesHeld`: every private address the camera interface HOLDS NOW outside the
 *     camera subnet - the interface table the Core reads anyway. A marked address that is in
 *     place on the stored interface is in this list;
 *   - `aliasCandidatesOfConfiguration`: every address the stored configuration can produce (the
 *     /24 of each factory address with the configured alias host).
 * A `del` of an address the helper did not mark changes nothing (`NOT_MARKED`), so asking is safe.
 */
import type { DestinationContext } from '../destination-rule';
import type { HostAliasFacts } from './caller';
import { aliasQuadOf, dottedOf, quadOf } from './protocol';

export interface HostAliasFactSources {
  /** The network facts of the Core host, now; null when not configured. May throw. */
  readonly network: () => DestinationContext | null;
  /** The stored camera interface, or null. May throw or reject. */
  readonly storedInterface: () => Promise<unknown> | unknown;
  /** The one name the helper's interface file holds; anything else when it cannot be read. May throw or reject. */
  readonly fileInterface: () => Promise<unknown> | unknown;
}

/** The network facts are not known although an interface is stored. The text names no value. */
export class HostAliasFactsUnknownError extends Error {
  readonly code = 'HOST_ALIAS_FACTS_UNKNOWN';
  constructor() {
    super('the network facts of the host are not known: no alias address is added');
    this.name = 'HostAliasFactsUnknownError';
  }
}

/** The reader the caller of row 105 takes as `facts`. */
export function hostAliasFactsReaderOf(sources: HostAliasFactSources): () => Promise<HostAliasFacts> {
  return async () => {
    const storedInterface = await sources.storedInterface();
    if (storedInterface === null || storedInterface === undefined) {
      // Not configured: the caller refuses by that name before it looks at anything else.
      return Object.freeze({ storedInterface: null, fileInterface: null, cameraSubnet: null, cameraAddresses: Object.freeze([]), otherInterfaceSubnets: Object.freeze([]), hostAddresses: Object.freeze([]) });
    }
    let fileInterface: unknown;
    try {
      fileInterface = await sources.fileInterface();
    } catch {
      fileInterface = null;
    }
    const network = sources.network();
    if (network === null || typeof network !== 'object') throw new HostAliasFactsUnknownError();
    // Row 141 (D23): since row 105 (D-105-2) a stored interface whose camera network is not fully chosen reads as a
    // context with `cameraSubnet: null`, no longer as null. The helper never acts without a camera subnet (D16
    // Q96-04 a): that context is "facts unknown" too.
    if (network.cameraSubnet === null || network.cameraSubnet === undefined) throw new HostAliasFactsUnknownError();
    return Object.freeze({
      storedInterface,
      fileInterface,
      cameraSubnet: network.cameraSubnet,
      cameraAddresses: network.cameraAddresses,
      otherInterfaceSubnets: network.otherInterfaceSubnets,
      hostAddresses: network.hostAddresses,
    });
  };
}

// ── The third source: the helper's interface file (task 4 row 106b; request line `row 106`, (c)) ──

/** The helper's own pattern of an interface name, and the CHECK of the stored column (as in `caller.ts`). */
const INTERFACE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$/;
/** More text than this is no interface file. */
const INTERFACE_FILE_ANSWER_MAX = 256;

/**
 * The ONE name in what the host's runner answered for the question of the interface file (the
 * result of row 80's runner, by shape: `{ outcome: 'RAN', exitCode: 0, output }`). Anything else -
 * a program that did not start or did not end, another exit code, no line, a second line, a text
 * that is not an interface name - is null: "unreadable", which the caller refuses by name.
 */
export function interfaceFileNameOf(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) return null;
  const { outcome, exitCode, output } = result as { readonly outcome?: unknown; readonly exitCode?: unknown; readonly output?: unknown };
  if (outcome !== 'RAN' || exitCode !== 0 || typeof output !== 'string' || output.length > INTERFACE_FILE_ANSWER_MAX) return null;
  const lines = output.split('\n').map((line) => line.replace(/[ \t\r]+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const [named] = lines;
  return lines.length === 1 && named !== undefined && INTERFACE_FILE_NAME.test(named) ? named : null;
}

/**
 * The source `fileInterface` over a runner THE COMPOSITION HANDS IN (this folder reads no file and
 * starts no program: static rule G-R2) and the fixed question of the interface file. No runner:
 * the source answers null and every `add` is refused `INTERFACE_FILE_UNREADABLE` - fail closed. A
 * removal never asks this source (record 105 D-5).
 */
export function hostAliasInterfaceFileSourceOf<Command>(run: ((command: Command) => Promise<unknown>) | null, command: Command): () => Promise<string | null> {
  return async () => {
    if (run === null) return null;
    try {
      return interfaceFileNameOf(await run(command));
    } catch {
      return null;
    }
  };
}

/** The most addresses one sweep asks about beside the stored rows: the 32 of a factory list and a margin. */
export const HOST_ALIAS_SWEEP_CANDIDATES_MAX = 40;

/**
 * Every address the camera interface holds now that only a temporary address can be (the network
 * reader marks it `alias`), as strict private dotted quads, each once. Null when the facts are not
 * known: the sweep then says so instead of reporting "none".
 */
export function aliasAddressesHeld(network: () => DestinationContext | null): readonly string[] | null {
  let context: DestinationContext | null;
  try {
    context = network();
  } catch {
    return null;
  }
  if (context === null || typeof context !== 'object' || !Array.isArray(context.cameraAddresses)) return null;
  const held = new Set<string>();
  for (const entry of context.cameraAddresses as readonly unknown[]) {
    if (typeof entry !== 'object' || entry === null || (entry as { alias?: unknown }).alias !== true) continue;
    const decided = aliasQuadOf((entry as { address?: unknown }).address);
    if (decided.ok) held.add(dottedOf(decided.quad));
  }
  return Object.freeze([...held].slice(0, HOST_ALIAS_SWEEP_CANDIDATES_MAX));
}

/**
 * Every address the stored configuration can produce as a temporary address: for each factory
 * address its /24 with the alias host. Anything that is not a strict dotted quad or not a host
 * part of 1 to 254 is dropped; each address once.
 */
export function aliasCandidatesOfConfiguration(factoryAddresses: unknown, aliasHost: unknown): readonly string[] {
  if (!Array.isArray(factoryAddresses) || typeof aliasHost !== 'number' || !Number.isInteger(aliasHost) || aliasHost < 1 || aliasHost > 254) return Object.freeze([]);
  const candidates = new Set<string>();
  for (const entry of factoryAddresses as readonly unknown[]) {
    const quad = quadOf(entry);
    if (quad === null) continue;
    const decided = aliasQuadOf(`${String(quad[0])}.${String(quad[1])}.${String(quad[2])}.${String(aliasHost)}`);
    if (decided.ok) candidates.add(dottedOf(decided.quad));
  }
  return Object.freeze([...candidates].slice(0, HOST_ALIAS_SWEEP_CANDIDATES_MAX));
}
