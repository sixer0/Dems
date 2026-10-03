/**
 * Suffix lookups of the DEMO evidence packages (split out of `index.ts` by step 54, D108, so the
 * join module imports concrete modules only: no require cycle under Metro). `index.ts` re-exports
 * every name unchanged.
 */
import { DEMO_EVIDENCE_INDEX } from './packages.generated';
import type { DemoEvidencePackage } from './types';

const SUFFIX_PATTERN = /^(?:(EV|SES)-\d{8}-)?(\d{1,4})$/;

/**
 * The 4-digit suffix of an ID in the given namespace: `EV-20260930-0004` → `0004`, `4` → `0004`.
 * Returns null for an ID of the other namespace or an unknown format.
 */
export function demoIdSuffix(idOrSuffix: string | number, namespace: 'EV' | 'SES'): string | null {
  const match = SUFFIX_PATTERN.exec(String(idOrSuffix).trim());
  if (!match?.[2]) return null;
  if (match[1] !== undefined && match[1] !== namespace) return null;
  return match[2].padStart(4, '0');
}

/** Every package, in evidence-number order. */
export function listDemoEvidencePackages(): readonly DemoEvidencePackage[] {
  return DEMO_EVIDENCE_INDEX.packages;
}

/** The package of an evidence item, by evidence ID (`EV-…-0004`) or evidence suffix (`0004`). */
export function getDemoEvidencePackage(evidenceIdOrSuffix: string | number): DemoEvidencePackage | null {
  const suffix = demoIdSuffix(evidenceIdOrSuffix, 'EV');
  return suffix === null ? null : (DEMO_EVIDENCE_INDEX.packages.find((pkg) => pkg.evidenceSuffix === suffix) ?? null);
}

/** The package of a session, by session ID (`SES-…-0014`) or session suffix (`0014`). */
export function getDemoEvidencePackageBySession(sessionIdOrSuffix: string | number): DemoEvidencePackage | null {
  const suffix = demoIdSuffix(sessionIdOrSuffix, 'SES');
  return suffix === null ? null : (DEMO_EVIDENCE_INDEX.packages.find((pkg) => pkg.sessionSuffix === suffix) ?? null);
}
