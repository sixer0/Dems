/**
 * i18next runtime for core-web (masterplan/01_specs.md §14.11; implementation/15_i18n_resources.md H-1).
 *
 * - One `translation` namespace holding `mergeResources(en, {})`, so keys read
 *   `t('shell.nav.dashboard')` or `t('dashboard.hero.paragraph')`.
 * - English only (A10); Indonesian domain terms are verbatim inside the resources.
 * - Missing keys are recorded (AC-66): route tests read `getMissingI18nKeys()` and expect none.
 *   In development each missing key also prints one console warning (no client log endpoint
 *   exists on mock-core, D41(g)).
 * - `t()` keys are typed from `EnResources` through `CustomTypeOptions`, so a misspelt key is a
 *   compile error before it can become a runtime miss.
 */
import i18next, { type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, en, mergeResources, type EnResources } from '@dems/shared/i18n'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: EnResources }
  }
}

const missingKeys = new Set<string>()

/** Keys that `t()` could not resolve since start (or since the last reset). */
export function getMissingI18nKeys(): string[] {
  return [...missingKeys].sort()
}

export function resetMissingI18nKeys(): void {
  missingKeys.clear()
}

function recordMissing(_lngs: readonly string[], ns: string, key: string): void {
  const id = `${ns}:${key}`
  if (missingKeys.has(id)) return
  missingKeys.add(id)
  if (import.meta.env.DEV) {
    console.warn('[core-web] missing i18n key', { level: 'warn', source: 'i18n', key: id })
  }
}

/** A fresh, synchronously initialised instance (the app uses the singleton below). */
export function createI18n(): I18nInstance {
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'translation',
    ns: ['translation'],
    resources: { [DEFAULT_LANGUAGE]: { translation: mergeResources(en, {}) } },
    initAsync: false,
    interpolation: { escapeValue: false },
    returnNull: false,
    saveMissing: true,
    missingKeyHandler: recordMissing,
  })
  return instance
}

export const i18n = createI18n()
