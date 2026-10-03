/**
 * `@dems/shared/i18n`: the English UI resources shared by core-web and mobile (01_specs
 * §14.11; 04_mobile_specs §9; SCR-05). Framework-free: plain objects and one merge helper,
 * no i18next import, so Node, the browser and Hermes load it the same way.
 *
 * `en` is ONE nested object; its top-level keys are the namespaces, one file each in `en/`:
 *
 * | Key             | File                     | Used by                         |
 * |-----------------|--------------------------|---------------------------------|
 * | `common`        | `en/common.ts`           | every page, both apps           |
 * | `shell`         | `en/shell.ts`            | AppShell (top bar, sidebar)     |
 * | `login`         | `en/login.ts`            | /login                          |
 * | `dashboard`     | `en/dashboard.ts`        | /dashboard                      |
 * | `session`       | `en/session.ts`          | /session (Session Monitor)      |
 * | `sessionNew`    | `en/session-new.ts`      | /session/new                    |
 * | `evidence`      | `en/evidence.ts`         | /evidence, /evidence/$id        |
 * | `devices`       | `en/devices.ts`          | /devices                        |
 * | `storage`       | `en/storage.ts`          | /storage                        |
 * | `networkTime`   | `en/network-time.ts`     | /network-time                   |
 * | `securityAudit` | `en/security-audit.ts`   | /security-audit                 |
 * | `system`        | `en/system.ts`           | /system                         |
 * | `apiReference`  | `en/api-reference.ts`    | /developer/api                  |
 *
 * Keys are camelCase paths such as `dashboard.systemRing.caption.READY`; enum-keyed maps
 * use the wire values from `src/domain/enums.ts`. Interpolation is i18next `{{name}}`;
 * plurals use the `_one` / `_other` suffixes.
 *
 * Wiring (one default `translation` namespace, so keys read `t('dashboard.hero.paragraph')`):
 *
 * ```ts
 * import { en, mergeResources } from '@dems/shared/i18n';
 * // web:    resources: { en: { translation: mergeResources(en, {}) } }
 * // mobile: resources: { en: { translation: mergeResources(en, enMobile) } } // enMobile = { mobile: {…} }
 * ```
 *
 * Pass a `mergeResources` result rather than `en` itself: i18next may extend the stored
 * object in place, and the merge returns a fresh copy.
 */
import { apiReference } from './en/api-reference';
import { common } from './en/common';
import { dashboard } from './en/dashboard';
import { devices } from './en/devices';
import { evidence } from './en/evidence';
import { login } from './en/login';
import { networkTime } from './en/network-time';
import { securityAudit } from './en/security-audit';
import { session } from './en/session';
import { sessionNew } from './en/session-new';
import { shell } from './en/shell';
import { storage } from './en/storage';
import { system } from './en/system';
import type { ResourceTree } from './resource-tree';

export const en = {
  common,
  shell,
  login,
  dashboard,
  session,
  sessionNew,
  evidence,
  devices,
  storage,
  networkTime,
  securityAudit,
  system,
  apiReference,
} satisfies ResourceTree;

export type EnResources = typeof en;
export type SharedNamespace = keyof EnResources;

/** The namespace keys of `en`, in file order. */
export const SHARED_NAMESPACES = Object.keys(en) as SharedNamespace[];

/** The only UI language in this task (an `id` locale is out of scope, A10). */
export const DEFAULT_LANGUAGE = 'en';

export { mergeResources, type MergedResources, type ResourceTree } from './resource-tree';
export {
  apiReference,
  common,
  dashboard,
  devices,
  evidence,
  login,
  networkTime,
  securityAudit,
  session,
  sessionNew,
  shell,
  storage,
  system,
};
