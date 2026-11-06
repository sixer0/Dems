/**
 * The Core server address of this device (task 2026-11-05 row 236, decision D263, the user's own request:
 * "make a configuration to input the host address, do not hard-code it").
 *
 * THE ONE SOURCE OF THE CORE ORIGIN. The Live source's adapters (`sim-adapters.ts`) build the typed client, the
 * Live socket and the media transport from `coreOriginOf(getCoreAddress())`, and the preview stream
 * (`camera-stream-transport.ts`) takes its origin from that media transport. No other production file names the
 * Core server's address (the D69 guard `live-no-raw-fetch.test.tsx`, rule 2; the debug-only `dev-probes.ts` keeps
 * its own constants and is exempt by name).
 *
 * | Rule | How |
 * |------|-----|
 * | Default `127.0.0.1:4420`: the emulator and the `adb reverse` path keep working | `DEFAULT_CORE_ADDRESS`, from the shared constants |
 * | Stored as a preference, not a secret | field `coreAddress` of `dems.mobile.prefs.v1`, written by merge (D57); it is not stored with the credential, so the secure store is not used for it |
 * | Accepted: IPv4 private (10/8, 172.16/12, 192.168/16), loopback (127/8), link-local (169.254/16), or a host name (letters, digits, dots, hyphens; `localhost`); port 1-65535 | `validateCoreAddress` |
 * | Refused: a scheme, a path, a public (or any other non-private) IPv4 address, IPv6 | IPv6 is refused by choice: the DEMS network is IPv4, and a bracketed literal would need its own URL, cleartext and validation rules |
 * | A different address is a different Core: a new pairing (R225-F3: never send a credential to another Core) | `setCoreAddress` deletes the stored device credential (with the biometric items, MB-2), the owed sign-out (row 224) and the simulator snapshot BEFORE the new address is in force; the runtime then builds a new Live source, so the replica of the old Core is dropped |
 * | A deletion that fails leaves the address unchanged | `setCoreAddress` answers `resetFailed`; nothing was sent anywhere new |
 * | Release builds | unchanged: LIVE only (rows 170/174). This file opens no other source |
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { CORE_SERVER_HOST, CORE_SERVER_PORT, WS_PATH } from '@dems/shared/api';
import { SIM_STORAGE_KEY } from '@dems/shared/sim';
import { MOBILE_PREFS_KEY } from '@/motion/prefs';
import { reportRuntimeIssue } from './log';

/** Where the Core server is reached: a host (IPv4 address or host name) and a TCP port. */
export interface CoreAddress {
  readonly host: string;
  readonly port: number;
}

/** The address of a device that was never configured: the loopback Core over `adb reverse` (D263). */
export const DEFAULT_CORE_ADDRESS: CoreAddress = Object.freeze({ host: CORE_SERVER_HOST, port: CORE_SERVER_PORT });

/** The field of `dems.mobile.prefs.v1` this module owns. */
export const CORE_ADDRESS_PREFS_FIELD = 'coreAddress';

// ---------------------------------------------------------------------------------------------
// Validation (pure)
// ---------------------------------------------------------------------------------------------

/** Why a host was refused. Each has its own sentence (`features.pairing.live.address.problems.host.*`). */
export type CoreHostProblem = 'empty' | 'scheme' | 'path' | 'withPort' | 'ipv6' | 'badIpv4' | 'notPrivateIpv4' | 'badHost';
/** Why a port was refused (`features.pairing.live.address.problems.port.*`). */
export type CorePortProblem = 'empty' | 'notNumber' | 'range';

export type CoreHostCheck = { readonly ok: true; readonly host: string } | { readonly ok: false; readonly problem: CoreHostProblem };
export type CorePortCheck = { readonly ok: true; readonly port: number } | { readonly ok: false; readonly problem: CorePortProblem };
export type CoreAddressCheck =
  | { readonly ok: true; readonly address: CoreAddress }
  | { readonly ok: false; readonly host: CoreHostProblem | null; readonly port: CorePortProblem | null };

const HOST_MAX = 253;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** No leading zero: `010` is octal to some resolvers and decimal to others, so it is refused, not guessed. */
const OCTET = /^(?:0|[1-9][0-9]{0,2})$/;

/** The four octets of a dotted IPv4 address, or null. */
function ipv4Octets(text: string): number[] | null {
  const parts = text.split('.');
  if (parts.length !== 4 || !parts.every((part) => OCTET.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

/** 10/8, 172.16/12, 192.168/16 (RFC 1918), 127/8 (loopback), 169.254/16 (link-local). */
export function isAllowedIpv4(octets: readonly number[]): boolean {
  const [a, b] = octets as [number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127 || (a === 169 && b === 254);
}

/** The host as it will be used (trimmed, lower case), or the first reason it is refused. */
export function checkCoreHost(text: string): CoreHostCheck {
  const host = text.trim().toLowerCase();
  const refuse = (problem: CoreHostProblem): CoreHostCheck => ({ ok: false, problem });
  if (host === '') return refuse('empty');
  if (host.includes('://') || /^[a-z][a-z0-9+.-]*:\/\//.test(host)) return refuse('scheme');
  // IPv6 (decision of row 236): a bracketed literal or more than one colon.
  if (host.includes('[') || host.includes(']') || host.split(':').length > 2) return refuse('ipv6');
  if (/[/?#\\]/.test(host)) return refuse('path');
  if (host.includes(':')) return refuse(/^[^:]+:[0-9]*$/.test(host) ? 'withPort' : 'badHost');
  if (/^[0-9.]+$/.test(host)) {
    // Digits and dots only: an IPv4 address or nothing (never a host name such as `10.0.0`).
    const octets = ipv4Octets(host);
    if (octets === null) return refuse('badIpv4');
    return isAllowedIpv4(octets) ? { ok: true, host } : refuse('notPrivateIpv4');
  }
  if (host.length > HOST_MAX || !host.split('.').every((label) => LABEL.test(label))) return refuse('badHost');
  return { ok: true, host };
}

/** The port as a number, or the reason it is refused. */
export function checkCorePort(text: string): CorePortCheck {
  const value = text.trim();
  if (value === '') return { ok: false, problem: 'empty' };
  if (!/^[0-9]{1,5}$/.test(value)) return { ok: false, problem: 'notNumber' };
  const port = Number(value);
  return port >= 1 && port <= 65_535 ? { ok: true, port } : { ok: false, problem: 'range' };
}

/** Both fields of the Pair screen, checked together. Pure. */
export function validateCoreAddress(hostText: string, portText: string): CoreAddressCheck {
  const host = checkCoreHost(hostText);
  const port = checkCorePort(portText);
  if (host.ok && port.ok) return { ok: true, address: { host: host.host, port: port.port } };
  return { ok: false, host: host.ok ? null : host.problem, port: port.ok ? null : port.problem };
}

/** `host:port`, as the screens print it. */
export function formatCoreAddress(address: CoreAddress): string {
  return `${address.host}:${address.port}`;
}

export function sameCoreAddress(a: CoreAddress, b: CoreAddress): boolean {
  return a.host === b.host && a.port === b.port;
}

/** The origins of an address: HTTP for the typed client and the media routes, WS for the Live socket. */
export interface CoreOrigin {
  readonly http: string;
  readonly ws: string;
}

/** The ONE place an origin is built from an address. Read by the Live source's adapters only. */
export function coreOriginOf(address: CoreAddress): CoreOrigin {
  const authority = formatCoreAddress(address);
  return { http: `http://${authority}`, ws: `ws://${authority}${WS_PATH}` };
}

// ---------------------------------------------------------------------------------------------
// The preference (`dems.mobile.prefs.v1` → `coreAddress`)
// ---------------------------------------------------------------------------------------------

/** Reads `coreAddress` from a stored prefs value. Missing → the default; present but refused by the rules → the default and `invalid`. */
export function parseStoredCoreAddress(raw: string | null): { readonly address: CoreAddress; readonly invalid: boolean } {
  if (raw == null) return { address: DEFAULT_CORE_ADDRESS, invalid: false };
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${MOBILE_PREFS_KEY} is not a JSON object`);
  const stored = (value as Record<string, unknown>)[CORE_ADDRESS_PREFS_FIELD];
  if (stored === undefined) return { address: DEFAULT_CORE_ADDRESS, invalid: false };
  const host = (stored as { host?: unknown } | null)?.host;
  const port = (stored as { port?: unknown } | null)?.port;
  if (typeof host !== 'string' || typeof port !== 'number' || !Number.isInteger(port)) return { address: DEFAULT_CORE_ADDRESS, invalid: true };
  const checked = validateCoreAddress(host, String(port));
  return checked.ok ? { address: checked.address, invalid: false } : { address: DEFAULT_CORE_ADDRESS, invalid: true };
}

interface CoreAddressState {
  readonly address: CoreAddress;
  readonly hydrated: boolean;
  /** A failed read or write of the preference; the address in memory still applies. */
  readonly error: 'read' | 'write' | null;
}

// Named `use…` because it is a hook (React Compiler; see `core-link.ts`).
const useCoreAddressStore = create<CoreAddressState>(() => ({ address: DEFAULT_CORE_ADDRESS, hydrated: false, error: null }));

let hydration: Promise<void> | null = null;

/** Reads the stored address once per process. Never rejects. */
export function hydrateCoreAddress(): Promise<void> {
  hydration ??= AsyncStorage.getItem(MOBILE_PREFS_KEY)
    .then((raw) => {
      const { address, invalid } = parseStoredCoreAddress(raw);
      if (invalid) reportRuntimeIssue('warn', 'runtime.coreAddress.readPrefs', 'The stored Core server address is not valid; the default is used', { key: MOBILE_PREFS_KEY });
      // An address set before the read finished wins over the stored one.
      if (!useCoreAddressStore.getState().hydrated) useCoreAddressStore.setState({ address, hydrated: true });
    })
    .catch((error: unknown) => {
      reportRuntimeIssue('warn', 'runtime.coreAddress.readPrefs', error, { key: MOBILE_PREFS_KEY });
      if (!useCoreAddressStore.getState().hydrated) useCoreAddressStore.setState({ hydrated: true, error: 'read' });
    });
  return hydration;
}

export function isCoreAddressHydrated(): boolean {
  return useCoreAddressStore.getState().hydrated;
}

/** The address in force now, outside React (the Live source reads it once, when it is built). */
export function getCoreAddress(): CoreAddress {
  return useCoreAddressStore.getState().address;
}

/** The address in force; re-renders when it changes. Reads the stored value once. */
export function useCoreAddress(): CoreAddress {
  const address = useCoreAddressStore((s) => s.address);
  useEffect(() => {
    void hydrateCoreAddress();
  }, []);
  return address;
}

/** `host:port` of the address in force: a string, so a re-render happens only on a real change (the runtime keys its Live source on it). */
export function useCoreAddressKey(): string {
  return useCoreAddressStore((s) => formatCoreAddress(s.address));
}

/** What `setCoreAddress` did. */
export type CoreAddressChange = 'unchanged' | 'changed' | 'invalid' | 'resetFailed';

/** How long the deletions of the old pairing may take before the change is given up (the secure store is the OS keystore). */
export const CORE_ADDRESS_RESET_BUDGET_MS = 4_000;

function withinBudget<T>(task: Promise<T>, budgetMs: number): Promise<T | 'late'> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve('late'), budgetMs);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Forgets everything that belongs to the Core of the old address: the stored device credential (and with it the
 * biometric items, MB-2), the owed sign-out (row 224) and the simulator snapshot. True when the two secure items are
 * gone; a snapshot that stays is logged only (LIVE never reads it, MD-5).
 */
async function forgetCoreBinding(): Promise<boolean> {
  // Loaded at the first change, as the adapters load it: the wrapper is the only importer of the secure store (MP-1).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const store = require('./secure-credentials') as typeof import('./secure-credentials');
  let ok = true;
  for (const [item, remove] of [
    ['deviceCredential', () => store.deleteDeviceCredential()],
    ['owedSignOut', () => store.deleteOwedSignOut()],
  ] as const) {
    try {
      const outcome = await withinBudget(remove(), CORE_ADDRESS_RESET_BUDGET_MS);
      if (outcome === 'late' || !outcome.ok) {
        ok = false;
        reportRuntimeIssue('error', 'runtime.coreAddress.reset', 'A stored item of the previous Core was not deleted', {
          item,
          ...(outcome === 'late' ? { late: true, budgetMs: CORE_ADDRESS_RESET_BUDGET_MS } : { errorCode: outcome.code }),
        });
      }
    } catch (error) {
      ok = false;
      reportRuntimeIssue('error', 'runtime.coreAddress.reset', error, { item });
    }
  }
  try {
    await AsyncStorage.removeItem(SIM_STORAGE_KEY);
  } catch (error) {
    reportRuntimeIssue('warn', 'runtime.coreAddress.reset', error, { item: 'simSnapshot', key: SIM_STORAGE_KEY });
  }
  return ok;
}

let changes: Promise<unknown> = Promise.resolve();

async function applyCoreAddress(next: CoreAddress): Promise<CoreAddressChange> {
  const checked = validateCoreAddress(next.host, String(next.port));
  if (!checked.ok) {
    reportRuntimeIssue('warn', 'runtime.coreAddress.invalid', 'A Core server address that the rules refuse was not taken', { host: checked.host, port: checked.port });
    return 'invalid';
  }
  await hydrateCoreAddress();
  const before = getCoreAddress();
  const address = checked.address;
  if (sameCoreAddress(address, before)) return 'unchanged';
  // R225-F3: the old pairing is gone BEFORE the new address is in force, so the Live source built for the new
  // address reads no credential of the old Core.
  if (!(await forgetCoreBinding())) return 'resetFailed';
  try {
    await AsyncStorage.mergeItem(MOBILE_PREFS_KEY, JSON.stringify({ [CORE_ADDRESS_PREFS_FIELD]: { host: address.host, port: address.port } }));
    useCoreAddressStore.setState({ address, hydrated: true, error: null });
  } catch (error) {
    // The address applies in memory; a cold start comes back to the old one, unpaired (the credential is gone).
    reportRuntimeIssue('warn', 'runtime.coreAddress.writePrefs', error, { key: MOBILE_PREFS_KEY });
    useCoreAddressStore.setState({ address, hydrated: true, error: 'write' });
  }
  reportRuntimeIssue('info', 'runtime.coreAddress.changed', 'The Core server address changed; the pairing with the previous Core was removed', {
    from: formatCoreAddress(before),
    to: formatCoreAddress(address),
  });
  return 'changed';
}

/**
 * Sets the Core server address. A different, valid address first forgets the pairing with the previous Core, then
 * is stored and put in force (the runtime builds a new Live source for it). Changes run one after another. Never rejects.
 */
export function setCoreAddress(next: CoreAddress): Promise<CoreAddressChange> {
  const run = changes.then(() => applyCoreAddress(next));
  changes = run.catch(() => undefined);
  return run.catch((error: unknown) => {
    reportRuntimeIssue('error', 'runtime.coreAddress.set', error);
    return 'resetFailed' as const;
  });
}

/** The setting as a screen uses it. */
export function useCoreAddressSetting(): { readonly address: CoreAddress; readonly set: (next: CoreAddress) => Promise<CoreAddressChange> } {
  const address = useCoreAddress();
  const set = useCallback((next: CoreAddress) => setCoreAddress(next), []);
  return { address, set };
}

/** Test hook: back to the default, not hydrated. */
export function resetCoreAddressForTests(): void {
  hydration = null;
  changes = Promise.resolve();
  useCoreAddressStore.setState({ address: DEFAULT_CORE_ADDRESS, hydrated: false, error: null });
}
