import { auditEn } from '@/features/audit/i18n';
import { dashboardEn } from '@/features/dashboard/i18n';
import { devicesEn } from '@/features/devices/i18n';
import { evidenceEn } from '@/features/evidence/i18n';
import { loginEn } from '@/features/login/i18n';
import { moreEn } from '@/features/more/i18n';
import { networkTimeEn } from '@/features/network-time/i18n';
import { pairingEn } from '@/features/pairing/i18n';
import { sessionFinalizingEn } from '@/features/session-finalizing/i18n';
import { sessionLiveEn } from '@/features/session-live/i18n';
import { sessionNewEn } from '@/features/session-new/i18n';
import { sessionRecoveryEn } from '@/features/session-recovery/i18n';
import { sessionSummaryEn } from '@/features/session-summary/i18n';
import { sessionsEn } from '@/features/sessions/i18n';
import { settingsEn } from '@/features/settings/i18n';
import { storageEn } from '@/features/storage/i18n';
import { navigationEn } from '@/navigation/i18n';
import type { ResourceTree } from './resources';

/**
 * Registry of per-feature i18n resources (04_mobile_specs §9). Owner: step 70 (P6).
 *
 * One entry per feature folder, keyed by the folder name and mounted under `features.<folder>`,
 * so screens call `t('features.evidence.title')` and two features can never collide. Screen steps
 * edit only their own `src/features/<folder>/i18n.ts`, never this file. `navigation` holds the
 * navigation shell's own copy (`src/navigation/i18n.ts`: not-found, stubs, the session-busy toast).
 */
export const FEATURE_RESOURCES: Readonly<Record<string, ResourceTree>> = {
  audit: auditEn,
  dashboard: dashboardEn,
  devices: devicesEn,
  evidence: evidenceEn,
  login: loginEn,
  more: moreEn,
  navigation: navigationEn,
  'network-time': networkTimeEn,
  pairing: pairingEn,
  'session-finalizing': sessionFinalizingEn,
  'session-live': sessionLiveEn,
  'session-new': sessionNewEn,
  'session-recovery': sessionRecoveryEn,
  'session-summary': sessionSummaryEn,
  sessions: sessionsEn,
  settings: settingsEn,
  storage: storageEn,
};
