/**
 * Mounts the auth layer's copy (`./i18n.ts`) at `features.auth.*` of the app's i18n instance
 * (backend task W56).
 *
 * The registry of feature resources is `src/i18n/features.ts`, which this row may not write. So
 * the tree is added to the instance here, once, when the auth layer is loaded: a deep merge that
 * overwrites nothing. When the registry gets its entry (`auth: authEn`), this call adds nothing
 * and can be removed with this file; `./i18n.ts` imports nothing of the instance, so the registry
 * can import it without a cycle.
 */
import { i18n } from '@/i18n';
import { authEn } from './i18n';

/** The key prefix of the tree: `t('features.auth.notice.tokenReuse')`. */
export const AUTH_I18N_PREFIX = 'features.auth';

let registered = false;

/** Idempotent. `deep`: merged into the bundle; no `overwrite`: an entry of the registry wins. */
export function registerAuthResources(): void {
  if (registered) return;
  registered = true;
  i18n.addResourceBundle('en', 'translation', { features: { auth: authEn } }, true, false);
}

registerAuthResources();
