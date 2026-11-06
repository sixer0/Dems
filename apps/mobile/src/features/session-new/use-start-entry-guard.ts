/**
 * R2 for every start entry (E-fix row FX-M2, E2E-P-5; decision D201, amending
 * 04_client_integration_spec §6.3): the Home and Sessions buttons are locked without
 * `SESSION_START`, and this guard covers the entries that are not buttons (a deep link, a pending
 * href, a resync to a setup session left behind): an operator whose role is known and lacks
 * `SESSION_START` does not get the wizard; the route goes to `/home` with one toast, "Not permitted"
 * and "Requires the Investigator role", as the web's route guard sends such a role to the Dashboard.
 *
 * Only the ENTRY is decided here. Once the wizard was shown to an operator who held the permission,
 * losing it is the screen's own rule (§6.3, AC-C-50: it leaves for `/home` and the runtime's
 * role-change toast says why), so the two never navigate or toast twice.
 *
 * Ruling W93-11 (decision D243, post-review fix FXR-M): while no role is known yet (Live mode before the
 * first snapshot) the entry WAITS (`'checking'`: the route shows "Checking your permissions…") and then
 * applies the same `SESSION_START` gate as the buttons. It used to let the wizard open ("the Core decides")
 * while the buttons were locked: two rules for one permission.
 */
import { useToast } from 'heroui-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Permission } from '@dems/shared/sim';
import { useRoleGate } from '@/features/rbac/use-role-gate';
import { reportRuntimeIssue } from '@/runtime';

export interface StartEntryGuardOptions {
  /** False while the route leaves for another reason (a busy session has its own toast): nothing is shown twice. */
  readonly enabled?: boolean;
}

/** What the entry does now: leave for Home (refused), wait for the role (`'checking'`), or show the wizard (`null`). */
export type StartEntryDecision = '/home' | 'checking' | null;

export function useStartEntryGuard({ enabled = true }: StartEntryGuardOptions = {}): StartEntryDecision {
  const { t } = useTranslation();
  const { toast } = useToast();
  const gate = useRoleGate(Permission.SESSION_START);
  // The entry is complete once the wizard was allowed for a known role (adjusted during render).
  const [entered, setEntered] = useState(false);
  if (enabled && !entered && gate.known && gate.allowed) setEntered(true);
  const refused = enabled && !entered && gate.locked;

  // One toast and one log record per refused visit, however often the redirecting render repeats.
  const shown = useRef(false);
  useEffect(() => {
    if (!refused || shown.current) return;
    shown.current = true;
    toast.show({ variant: 'danger', label: t('common.rbac.deniedTitle'), ...(gate.hint ? { description: gate.hint } : {}) });
    reportRuntimeIssue('info', 'features.sessionNew.entryRefused', 'Start Session refused: the role lacks SESSION_START', {
      requiredRole: gate.requiredRole,
    });
  }, [refused, gate.hint, gate.requiredRole, toast, t]);

  if (refused) return '/home';
  return enabled && !entered && !gate.known ? 'checking' : null;
}
