/**
 * Operation 68 `updateSettings`: what of a request body reaches the hosted action, which
 * settings a call changed, and the one log line of a change (plan row W40; spec §7.14, §13.2;
 * SR-82, AC-B-89).
 *
 * THE PATCH. The body names the members to change (`SettingsUpdateRequest`: the four members of
 * the `settings` slice, each optional; an unknown key was dropped by the schema, API-4). The
 * patch holds a member exactly when the body held it, and never anything else of the body.
 * Which value a member may take is the contract's schema at stage 7 and the simulator's own
 * `updateSettingsPatch`; no rule of a setting lives here.
 *
 * WHAT CHANGED is read from the `settings` slice before and after the hosted action, inside the
 * action's unit of work: the names of the members whose value differs, sorted. The names come
 * from the slice, never from the request body.
 *
 * THE LOG LINE (SR-82). `updateSettings` writes no audit row (parity with the simulator, spec
 * §13.2), and a setting is a value every console sees. So a call that changed at least one
 * setting writes ONE line at level info:
 *
 *     { operatorId: 'OPR-001', changedKeys: ['notifySound', 'timeFormat'] }  "settings changed"
 *
 * It holds the operator's ID and the NAMES of the changed settings. It never holds a value of a
 * setting, the request body or the slice. A call that changed nothing, and a call that was
 * refused, write no line.
 */
import type { SettingsUpdateRequest } from '@dems/shared/api';
import type { SettingsSlice } from '@dems/shared/sim';
import type { Principal } from '../../plugins/authenticate';

/** Label of the unit of work of operation 68. It appears in the pipeline's log lines. */
export const SETTINGS_UNIT_LABEL = 'system.updateSettings';

/** The fixed text of the log line of a settings change. */
export const SETTINGS_CHANGED_MESSAGE = 'settings changed';

/** The members of a body that reach the hosted action: each one the body held, and nothing else. */
export function settingsPatchOf(body: SettingsUpdateRequest): Partial<SettingsSlice> {
  const patch: Partial<SettingsSlice> = {};
  if (body.presentationMode !== undefined) patch.presentationMode = body.presentationMode;
  if (body.timeFormat !== undefined) patch.timeFormat = body.timeFormat;
  if (body.notifyWarnings !== undefined) patch.notifyWarnings = body.notifyWarnings;
  if (body.notifySound !== undefined) patch.notifySound = body.notifySound;
  return patch;
}

/** The names of the settings whose value differs between two slices, sorted. Empty when none does. */
export function changedSettingsKeys(before: SettingsSlice, after: SettingsSlice): string[] {
  return (Object.keys(after) as Array<keyof SettingsSlice>).filter((key) => before[key] !== after[key]).sort();
}

/** The fields of the log line of a settings change: who, and which settings by name. */
export interface SettingsChangeLine {
  readonly operatorId: string | null;
  readonly changedKeys: readonly string[];
}

/**
 * The fields of the one log line of a change (SR-82). The operator ID is the caller's, as stage
 * 4 resolved it: the hosted action has just run as this operator. It is read for the line only;
 * who may call is decided by stage 6, never here.
 */
export function settingsChangeLine(caller: Principal, changedKeys: readonly string[]): SettingsChangeLine {
  return { operatorId: caller.kind === 'OPERATOR' ? caller.operatorId : null, changedKeys };
}
