/**
 * Deep-link and route parameter parsing (04_mobile_specs §3.1 "useLocalSearchParams parsing
 * (zod)", §3.5 deep links; step 70).
 *
 * Every value from a URL is untrusted input: a deep link can carry anything (`demsdemo:///…`).
 * Route files parse their params here and hand typed values to the screens; an invalid value
 * becomes the documented fallback (never a crash, never an unchecked string in a query key).
 * Global switches (`?motion=`, `?debug=`) are read by the motion kit (step 69), not here.
 */
import { z } from 'zod';

/** What Expo Router hands a route: every search or path param is a string or a string array. */
export type RawParams = Readonly<Record<string, string | string[] | undefined>>;

/** First value of a param that may repeat (`?a=1&a=2` → `'1'`). */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Record ids in URLs: session ids, evidence ids, device ids (e.g. `EV-20261001-0007`, `CAM-01`).
 * Letters, digits, `.`, `_` and `-`, at most 64 characters; nothing that could form a path
 * segment, a query or a scheme.
 */
export const recordIdSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);

/** `/session/new?step=1|2|3` (04 §1.3, §4.4). Default 1. */
export const sessionStepSchema = z.coerce.number().int().min(1).max(3);
export type SessionStep = 1 | 2 | 3;

/** `/settings/[section]` (04 §4.15 "Sections"). */
export const SETTINGS_SECTIONS = ['preferences', 'notifications', 'security', 'maintenance', 'about'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export const settingsSectionSchema = z.enum(SETTINGS_SECTIONS);

/** `&scenario=` (04 §3.5; debug builds only, loaded by the runtime, step 73). */
export const scenarioSchema = z.string().trim().regex(/^[a-z][a-z0-9-]{0,31}$/);

function safe<T>(schema: z.ZodType<T>, value: string | string[] | undefined): T | null {
  const first = firstParam(value);
  if (first === undefined || first === '') return null;
  const result = schema.safeParse(first);
  return result.success ? result.data : null;
}

/** A record id, or `null` when absent or malformed. */
export function parseRecordId(value: string | string[] | undefined): string | null {
  return safe(recordIdSchema, value);
}

/** The Start Session step; absent or invalid → 1 (the flow's first step). */
export function parseSessionStep(value: string | string[] | undefined): SessionStep {
  return (safe(sessionStepSchema, value) ?? 1) as SessionStep;
}

/** A Settings section, or `null` when absent or unknown. */
export function parseSettingsSection(value: string | string[] | undefined): SettingsSection | null {
  return safe(settingsSectionSchema, value);
}

/** The debug scenario name, or `null`. */
export function parseScenario(value: string | string[] | undefined): string | null {
  return safe(scenarioSchema, value);
}

/** `?motion=` present on a URL: the boot router then shows the row-18 proof screen (AC-31). */
export function hasMotionParam(params: RawParams): boolean {
  const value = firstParam(params.motion);
  return value !== undefined && value !== '';
}

// ---------------------------------------------------------------------------------------------
// Incoming URLs (the pending href of 04 §3.3)
// ---------------------------------------------------------------------------------------------

/** Query keys the motion kit consumes globally; they are not carried into a pending href. */
const GLOBAL_SWITCHES: ReadonlySet<string> = new Set(['motion', 'debug']);

/** Longest href the shell keeps in memory (a deep link is untrusted input). */
export const MAX_HREF_LENGTH = 512;

export interface InternalHref {
  /** `/evidence/EV-1`: always starts with one `/`, no scheme, no host, no `..` segment. */
  readonly pathname: string;
  /** Search params without the global switches, in their original order. */
  readonly search: string;
}

/**
 * Parses an incoming URL or path (`demsdemo:///evidence?selected=EV-1`, `demsdemo://evidence`,
 * `/evidence?selected=EV-1`) into an internal href, or `null` when it is not a safe in-app path.
 * `demsdemo://?motion=slow` gives pathname `/`.
 */
export function toInternalHref(input: string): InternalHref | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_HREF_LENGTH) return null;
  let rest = input.trim();
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(rest);
  if (scheme) {
    if (scheme[1]!.toLowerCase() !== 'demsdemo') return null; // only the app's own scheme
    rest = rest.slice(scheme[0].length).replace(/^\/\//, '');
    // `demsdemo://evidence` names the first segment as a host; `demsdemo:///evidence` has none.
    if (!rest.startsWith('/') && !rest.startsWith('?')) rest = `/${rest}`;
  }
  const hashAt = rest.indexOf('#');
  if (hashAt >= 0) rest = rest.slice(0, hashAt);
  const queryAt = rest.indexOf('?');
  let pathname = queryAt >= 0 ? rest.slice(0, queryAt) : rest;
  const query = queryAt >= 0 ? rest.slice(queryAt + 1) : '';
  if (pathname === '') pathname = '/';
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return null;
  const segments = pathname.split('/').slice(1);
  if (segments.some((s) => s === '..' || s === '.' || /[^A-Za-z0-9._~()+-]/.test(s))) return null;

  const kept = query
    .split('&')
    .filter((pair) => pair.length > 0)
    .filter((pair) => !GLOBAL_SWITCHES.has(safeDecode(pair.split('=', 1)[0] ?? '')));
  return { pathname: pathname.replace(/\/+$/, '') || '/', search: kept.length > 0 ? `?${kept.join('&')}` : '' };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
