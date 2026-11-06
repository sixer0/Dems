import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en as sharedEn } from '@dems/shared/i18n';
import { enMobile } from './en.mobile';
import { FEATURE_RESOURCES } from './features';
import { mergeResources, type ResourceTree } from './resources';

export { mergeResources, type ResourceTree } from './resources';

/**
 * Mobile i18n runtime (04_mobile_specs §9): i18next 26.4.2 + react-i18next 17.0.15, English only
 * (the `id` locale is out of scope, A10; keys-from-day-one keeps it additive).
 *
 * Resource layering, first to last (a later layer wins on a clash):
 *   1. shared `@dems/shared/i18n` `en` (SCR-05; step 34): `common.*`, `login.*`, `session.*` … — the
 *      terms web and mobile share (statuses, enums, subject types, page copy), so both apps say the
 *      same thing (04 §9). Added by step 73;
 *   2. the mobile namespace `mobile.*` (`en.mobile.ts`);
 *   3. feature resources, each under `features.<folder>` (`features.ts`, filled by step 70).
 * The layers use disjoint top-level keys, so no layer overrides another (the i18n test pins that).
 * `mergeResources` returns a fresh deep copy, so i18next can extend its bundle without touching
 * the shared object (15_i18n_resources §2).
 */
export const EN_RESOURCE_LAYERS: readonly ResourceTree[] = [sharedEn, enMobile, { features: FEATURE_RESOURCES }];

export function buildEnResources(onOverride?: (path: string) => void): ResourceTree {
  return mergeResources(EN_RESOURCE_LAYERS, onOverride);
}

const missingKeys = new Set<string>();

/**
 * Keys `t()` could not resolve since start or the last reset, as `<namespace>:<key>`, sorted.
 * Development builds only (MA-21; T-M11 renders every screen and expects an empty list).
 */
export function getMissingKeys(): string[] {
  return [...missingKeys].sort();
}

export function resetMissingKeys(): void {
  missingKeys.clear();
}

/** The app's own i18next instance (not the global singleton, so tests and other code cannot clash). */
export const i18n = createInstance();

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en'],
  defaultNS: 'translation',
  ns: ['translation'],
  resources: { en: { translation: buildEnResources() } },
  interpolation: { escapeValue: false }, // React Native renders text, not HTML
  initAsync: false, // resources are in-memory, so `t` works synchronously right after import
  returnNull: false,
  saveMissing: __DEV__,
  missingKeyHandler: (_languages, namespace, key) => {
    missingKeys.add(`${namespace}:${key}`);
  },
});
