/**
 * THE CAPTURE NOTICES A CORE THAT WENT DOWN LEFT ACTIVE (wave H driver F; gate 64 condition C4,
 * tidy pass F-Y decision 8; the same reasoning as decision D84 R-4 for capture faults).
 *
 * The capture side tells the operator about a RUNNING capture with `SYSTEM` alerts that are no
 * fault: the advisory notices (`CaptureAdvisoryReason`: a keyframe interval above the bound, a
 * camera clock near the bound or off the Core's, a microphone at its rate limit, a fragment closed
 * at the size bound) and the notice that the evidence volume did not take the full sync
 * (`EVIDENCE_VOLUME_SYNC_NOT_FULL`, which can be CRITICAL). Each is resolved by the unit that
 * raised it when its condition ends or the capture of its session ends - from MEMORY. A Core that
 * dies in between leaves the alert active for ever, and a later raise for the same target then
 * writes nothing: a stale CRITICAL line outlives its cause.
 *
 * AT BOOT NO WORKER RUNS, so no session is recording and none of these conditions is being
 * observed: every one of them that is still active is over. `staleCaptureNoticesOf` names them, as
 * the inputs of the engine's `clearCaptureWarning`; the capture unit resolves them once at boot,
 * before a client connects (beside the faults of D84 R-4), and writes what it did to the log and to
 * the persistent error log. A condition that is still true is said again by the first reading of
 * the next recording (the first durable fragment states the sync level; the first clock reading
 * states the offset), as a NEW alert.
 *
 * WHAT IS NOT TOUCHED, on purpose: the no-device notices (`CAPTURE_DEVICE_UNREACHABLE`,
 * `CAPTURE_DISCOVERY_EMPTY`). They are not facts of a running capture: they say what the last
 * pre-check, session start or camera search FOUND, they are resolved by the next one (decision
 * D72(h)), and resolving one marks its device as answering - which a boot does not know.
 *
 * Pure: alerts in, clear inputs out. It names no process, no file, no timer and no clock.
 */
import { CAPTURE_NOTICE_VOLUME_TARGET, CaptureAdvisoryReason, CaptureNoticeReason, type CaptureAdvisoryNotice, type CaptureVolumeSyncNotice, type SimAlert } from '@dems/shared/sim';

/** The `params.reason` values of the notices that state a condition of a RUNNING capture: what a boot resolves. */
export const BOOT_RESOLVED_NOTICE_REASONS: readonly string[] = Object.freeze([...Object.values(CaptureAdvisoryReason), CaptureNoticeReason.EVIDENCE_VOLUME_SYNC_NOT_FULL]);

const ADVISORY: ReadonlySet<string> = new Set(Object.values(CaptureAdvisoryReason));

export type StaleCaptureNotice = CaptureAdvisoryNotice | CaptureVolumeSyncNotice;

/** The active capture notices of a state that no running capture stands behind, as the inputs that resolve them. */
export function staleCaptureNoticesOf(alerts: readonly Pick<SimAlert, 'active' | 'kind' | 'target' | 'params'>[]): StaleCaptureNotice[] {
  const stale: StaleCaptureNotice[] = [];
  for (const alert of alerts) {
    if (!alert.active || alert.kind !== 'SYSTEM') continue;
    const reason = alert.params?.['reason'];
    if (typeof reason !== 'string') continue;
    const target = alert.target ?? null;
    if (reason === CaptureNoticeReason.EVIDENCE_VOLUME_SYNC_NOT_FULL && target === CAPTURE_NOTICE_VOLUME_TARGET) stale.push({ code: reason, subject: null });
    // An advisory notice is about ONE device: its alert target is the device ID.
    else if (ADVISORY.has(reason) && target !== null) stale.push({ code: reason as CaptureAdvisoryReason, subject: target });
  }
  return stale;
}
