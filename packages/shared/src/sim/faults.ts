/**
 * Fault injection (masterplan/01_specs.md §14.7 `faults.ts`; EVT and FMEA keyed; §6.4).
 *
 * `inject(kind, target?)`:
 * - records the fault in `faults.active` (idempotent per kind and target);
 * - applies the device effect (derive.ts recomputes the device, time, security and service
 *   fields from the active faults; MIC_CLIP latches at once, AUDIT_TAMPER rewrites one row);
 * - raises an alert **and** writes an audit row (§6.4, SYS-014), plus an operational event;
 * - adds a FAULT node to the session timeline while recording;
 * - critical kinds (STORAGE_FULL, TPM_FAILURE, POWER_FAIL, SECURITY_FAULT) move PRECHECK,
 *   ARMED, RECORDING, STOPPING or FINALIZING to FAULT. Recording is never silently masked.
 *
 * `clearFault(kind, target?)` undoes the effect (the CLIP latch stays until `resetClip`),
 * resolves the matching alerts and writes FAULT_CLEARED. A session in FAULT stays there
 * until `recover()`.
 */
import { AuditEventKind, SessionState, type AudioTrackId, type TrackId } from '../domain';
import { activeMeterChannel, captureMicLines, micInputOfChannel } from './audio';
import { ALERT_RING_SIZE, AUDIO_CLIP_BURST_DBFS, MIC_SILENCE_DBFS, MIC_SILENCE_DURATION_MS } from './constants';
import { DEVICE_ID } from './dataset';
import { deriveDeviceState, EVIDENCE_TAMPER_PREFIX, isFaultActive } from './derive';
import { SimNotFoundError } from './errors';
import { nextItemId, pushRing, recordActivity, tamperAuditRow } from './events';
import { DEFAULT_TAMPER_TRACK, restoreEvidenceItem, tamperEvidenceItem } from './evidence';
import { noSignalFrame } from './initial-state';
import { addTimelineItem, enterFault, isCriticalFault } from './session-machine';
import type { AuditLogSlice, AudioFrame, CaptureFaultFacts, EpochMs, FaultTarget, SimAlert, SimState } from './types';
import { FaultEvt, FaultKind, type Severity } from './vocabulary';

/** Book audit-event kind (§21.3, 01 L665) each fault is reported as (AC-65 "audit AUDIO_CLIP"). */
export const FAULT_EVENT_KIND = {
  CAMERA_LOSS: AuditEventKind.SOURCE_FAULT,
  MIC_NO_SIGNAL: AuditEventKind.SOURCE_FAULT,
  MIC_CLIP: AuditEventKind.AUDIO_CLIP,
  STORAGE_LOW: AuditEventKind.TRACK_HEALTH,
  STORAGE_FULL: AuditEventKind.TRACK_HEALTH,
  GNSS_LOSS: AuditEventKind.SOURCE_FAULT,
  TAMPER: AuditEventKind.TAMPER,
  FAN_STALL: AuditEventKind.TRACK_HEALTH,
  POWER_FAIL: AuditEventKind.POWER_FAIL,
  TPM_FAILURE: AuditEventKind.SOURCE_FAULT,
  SECURITY_FAULT: AuditEventKind.SOURCE_FAULT,
  AUDIT_TAMPER: AuditEventKind.AUDIT_CHAIN_DISCONTINUITY,
  // Schema v2 (register SH-03): both are source faults of the capture path (§21.3 SOURCE_FAULT).
  MIC_SILENT: AuditEventKind.SOURCE_FAULT,
  CAPTURE_FAULT: AuditEventKind.SOURCE_FAULT,
} as const satisfies Record<FaultKind, AuditEventKind>;

/** Alert severity per fault (camera loss is critical, matching the GlowRing flags). */
export const FAULT_SEVERITY = {
  CAMERA_LOSS: 'CRITICAL',
  MIC_NO_SIGNAL: 'WARNING',
  MIC_CLIP: 'WARNING',
  STORAGE_LOW: 'WARNING',
  STORAGE_FULL: 'CRITICAL',
  GNSS_LOSS: 'WARNING',
  TAMPER: 'WARNING',
  FAN_STALL: 'WARNING',
  POWER_FAIL: 'CRITICAL',
  TPM_FAILURE: 'CRITICAL',
  SECURITY_FAULT: 'CRITICAL',
  AUDIT_TAMPER: 'CRITICAL',
  // `dbc-3 §C.2` fixes both: the silence warning never blocks (OD-11), a stalled file is critical.
  // Neither joins `CRITICAL_FAULTS` here: whether CAPTURE_FAULT moves the session machine to FAULT
  // is SH-06 behaviour (blueprint row 51), not a vocabulary decision.
  MIC_SILENT: 'WARNING',
  CAPTURE_FAULT: 'CRITICAL',
} as const satisfies Record<FaultKind, Severity>;

const ALTERED_SUFFIX = ' [altered]';

/** How many rows from the end AUDIT_TAMPER alters by default (inside the "last N blocks" strip). */
const AUDIT_TAMPER_DEFAULT_FROM_END = 5;

function auditTamperIndex(log: AuditLogSlice, target?: FaultTarget): number | null {
  if (log.rows.length === 0) return null;
  const wanted = target?.auditIndex ?? log.rows.length - AUDIT_TAMPER_DEFAULT_FROM_END;
  return Math.min(log.rows.length - 1, Math.max(0, Math.floor(wanted)));
}

/**
 * The `faults.active[].target` key for a fault: camera or channel ID, time fallback tier,
 * `seq:<n>` for AUDIT_TAMPER, `evidence:<id>:<track>` for the evidence tamper hook, or null.
 */
export function faultTargetKey(state: SimState, kind: FaultKind, target?: FaultTarget): string | null {
  switch (kind) {
    case FaultKind.CAMERA_LOSS:
      return target?.cameraId ?? state.activeCameraId;
    case FaultKind.MIC_NO_SIGNAL:
      return target?.channel ?? 'AUDIO-01';
    case FaultKind.MIC_CLIP:
      return target?.channel ?? 'AUDIO-02';
    // Schema v2 (SH-08): the silence warning is keyed to the channel that feeds AUDIO-01 right now,
    // so `describeFault` finds the active microphone and clearing it resolves exactly that alert.
    case FaultKind.MIC_SILENT:
      return target?.channel ?? activeMeterChannel(state);
    case FaultKind.GNSS_LOSS:
      return target?.fallback ?? 'NTP';
    case FaultKind.TAMPER:
      return target?.evidenceId
        ? `${EVIDENCE_TAMPER_PREFIX}${target.evidenceId}:${target.trackId ?? DEFAULT_TAMPER_TRACK}`
        : null;
    case FaultKind.AUDIT_TAMPER: {
      const index = auditTamperIndex(state.audit, target);
      const row = index === null ? undefined : state.audit.rows[index];
      return row ? `seq:${row.seq}` : null;
    }
    default:
      return null;
  }
}

function parseEvidenceTamper(key: string | null): { evidenceId: string; trackId: TrackId } | null {
  if (!key?.startsWith(EVIDENCE_TAMPER_PREFIX)) return null;
  const rest = key.slice(EVIDENCE_TAMPER_PREFIX.length);
  const split = rest.lastIndexOf(':');
  if (split < 0) return null;
  return { evidenceId: rest.slice(0, split), trackId: rest.slice(split + 1) as TrackId };
}

function describeFault(state: SimState, kind: FaultKind, key: string | null): { message: string; deviceId: string } {
  const camera = state.cameras.find((c) => c.id === key);
  const mic = state.mics.find((m) => m.id === key);
  switch (kind) {
    case FaultKind.CAMERA_LOSS:
      return { message: `${camera?.name ?? 'Camera'} signal lost (${key ?? '?'})`, deviceId: camera?.deviceId ?? DEVICE_ID };
    case FaultKind.MIC_NO_SIGNAL:
      return { message: `${mic?.name ?? 'Microphone'}: no signal`, deviceId: mic?.deviceId ?? DEVICE_ID };
    case FaultKind.MIC_CLIP:
      return { message: `${mic?.name ?? 'Microphone'}: audio clipping`, deviceId: mic?.deviceId ?? DEVICE_ID };
    case FaultKind.STORAGE_LOW:
      return { message: 'Evidence storage low', deviceId: 'HDD-EVIDENCE' };
    case FaultKind.STORAGE_FULL:
      return { message: 'Evidence storage full — recording cannot continue', deviceId: 'HDD-EVIDENCE' };
    case FaultKind.GNSS_LOSS:
      return {
        message: key === 'RTC' ? 'GNSS and NTP lost — time from the RTC' : 'GNSS signal lost — time from NTP',
        deviceId: DEVICE_ID,
      };
    case FaultKind.TAMPER: {
      const evidence = parseEvidenceTamper(key);
      return evidence
        ? { message: `Evidence ${evidence.evidenceId} media altered (${evidence.trackId}; demo tamper)`, deviceId: DEVICE_ID }
        : { message: 'Enclosure tamper detected', deviceId: DEVICE_ID };
    }
    case FaultKind.FAN_STALL:
      return { message: 'Cooling fan stalled', deviceId: DEVICE_ID };
    case FaultKind.POWER_FAIL:
      return { message: 'Power fail detected — recovery marker written', deviceId: DEVICE_ID };
    case FaultKind.TPM_FAILURE:
      return { message: 'TPM failure — sealing and export blocked', deviceId: DEVICE_ID };
    case FaultKind.SECURITY_FAULT:
      return { message: 'Critical security fault', deviceId: DEVICE_ID };
    case FaultKind.AUDIT_TAMPER: {
      const seq = key?.startsWith('seq:') ? Number(key.slice(4)) : Number.NaN;
      const row = state.audit.rows.find((r) => r.seq === seq);
      return { message: `Audit chain discontinuity at ${row?.id ?? 'unknown row'}`, deviceId: DEVICE_ID };
    }
    // Schema v2 (register SH-03/SH-08; OD-11): the active microphone fell silent. A warning, never a
    // switch — the operator decides (D220). Keyed by the mic channel that feeds AUDIO-01.
    case FaultKind.MIC_SILENT:
      return {
        message: `${mic?.name ?? 'Microphone'}: silent below ${MIC_SILENCE_DBFS} dBFS for ${MIC_SILENCE_DURATION_MS / 1000} s`,
        deviceId: mic?.deviceId ?? DEVICE_ID,
      };
    // Schema v2 (register NM-07): a recording file stopped growing. Critical (`dbc-3 §C.2`).
    case FaultKind.CAPTURE_FAULT:
      return { message: `Capture fault: a recording file stopped growing (${key ?? 'unknown'})`, deviceId: key ?? DEVICE_ID };
    default:
      return { message: 'Fault', deviceId: DEVICE_ID };
  }
}

function raiseAlert(
  state: SimState,
  at: EpochMs,
  kind: FaultKind,
  target: string | null,
  message: string,
  facts?: CaptureFaultFacts,
): SimState {
  const { id, meta } = nextItemId(state.meta, 'ALR');
  const alert: SimAlert = {
    id,
    at,
    severity: FAULT_SEVERITY[kind],
    kind,
    message,
    active: true,
    acknowledged: false,
    resolvedAt: null,
    target,
    // Step 54 (review 40 m4): values for the alert copy, so no UI parses `message`.
    // `facts` (pass D6 item 14): the checked reason code and file count of a capture fault, written at the raise only.
    params: { kind, target, evt: FaultEvt[kind], eventKind: FAULT_EVENT_KIND[kind], ...facts },
  };
  return { ...state, meta, alerts: pushRing(state.alerts, [alert], ALERT_RING_SIZE) };
}

/** The cause an alert of a fault was raised with (`params.reason`, written at the raise only), or null. */
function alertReason(alert: SimAlert): string | null {
  const reason = alert.params?.['reason'];
  return typeof reason === 'string' ? reason : null;
}

/** `reason` undefined: the alerts of every cause; null: the alert without a cause; a code: that one (ruling D146). */
function resolveAlerts(state: SimState, at: EpochMs, kind: FaultKind, target: string | null | undefined, reason?: string | null): SimState {
  let changed = false;
  const alerts = state.alerts.map((alert) => {
    if (!alert.active || alert.kind !== kind) return alert;
    if (target !== undefined && (alert.target ?? null) !== target) return alert;
    if (reason !== undefined && alertReason(alert) !== reason) return alert;
    changed = true;
    return { ...alert, active: false, resolvedAt: at };
  });
  return changed ? { ...state, alerts } : state;
}

/**
 * Writes one frame of the meters slice. The fault target is still a **channel** (the demo control
 * panel and `FaultTarget.channel` name one); the slice itself is keyed by mic input (SH-17), so the
 * write goes through `micInputOfChannel` (the input that channel is in the capture configuration).
 */
function setAudioFrame(state: SimState, channel: AudioTrackId, patch: Partial<AudioFrame>): SimState {
  const input = micInputOfChannel(captureMicLines(state), channel);
  const frame = state.audio.inputs[input] ?? noSignalFrame(patch.at ?? 0);
  return {
    ...state,
    audio: {
      inputs: { ...state.audio.inputs, [input]: { ...frame, ...patch } },
      activeInputId: state.audio.activeInputId,
    },
  };
}

/** Restores the message the AUDIT_TAMPER hook altered (the chain verifies again). */
export function untamperAuditRow(log: AuditLogSlice, seq: number): AuditLogSlice {
  const index = log.rows.findIndex((row) => row.seq === seq);
  const row = log.rows[index];
  if (!row || !row.message.endsWith(ALTERED_SUFFIX)) return log;
  const rows = log.rows.slice();
  rows[index] = { ...row, message: row.message.slice(0, -ALTERED_SUFFIX.length) };
  return { ...log, rows };
}

/** `inject(kind, target?)`. Idempotent for the same kind and target. */
export function injectFaultTransition(state: SimState, now: EpochMs, kind: FaultKind, target?: FaultTarget): SimState {
  // An untargeted AUDIT_TAMPER while one is active is a repeat, not a second tamper (the default
  // row "5 from the end" moves as rows are appended).
  if (kind === FaultKind.AUDIT_TAMPER && target?.auditIndex === undefined && isFaultActive(state.faults, kind)) {
    return state;
  }
  const key = faultTargetKey(state, kind, target);
  if (kind === FaultKind.AUDIT_TAMPER && key === null) return state; // nothing to tamper with
  return raiseFaultAtKey(state, now, kind, key, target);
}

/**
 * Raises `kind` under the target key `key`: the body of `inject`, for a caller that already knows
 * the key. `raiseCaptureWarning` uses it for `CAPTURE_FAULT`, whose key is a capture-device ID that
 * `FaultTarget` has no member for. Returns the same state while that fault is active for that key.
 *
 * THE KEY IS (kind, reason, device) (ruling D146): `facts.reason` is the cause. The same kind on
 * the same DEVICE with another cause is another fault - its own entry, alert and audit row; a
 * raise without a cause is keyed by kind and target, as it always was.
 *
 * WITHOUT A DEVICE (key null: the capture as a whole) THERE IS ONE FAULT OF A KIND AT A TIME. Its
 * cause is a fact of the alert and of the audit row (`params.reason`, the column `alerts.reason`),
 * not a second key: the end of a capture is told by two raisers that cannot agree on a code (the
 * forwarder, from the supervisor's own warning, and the failed start of the session), and it must
 * stay one alert and one FAULT_RAISED row whichever of them comes first.
 */
export function raiseFaultAtKey(state: SimState, now: EpochMs, kind: FaultKind, key: string | null, target?: FaultTarget, facts?: CaptureFaultFacts): SimState {
  const reason = key === null ? null : (facts?.reason ?? null);
  if (isFaultActive(state.faults, kind, key, key === null ? undefined : reason)) return state;

  let next: SimState = state;
  if (kind === FaultKind.GNSS_LOSS && isFaultActive(state.faults, kind)) {
    // One time-source fallback at a time: escalating NTP → RTC (or back) replaces the entry.
    next = resolveAlerts(
      { ...next, faults: { active: next.faults.active.filter((f) => f.kind !== FaultKind.GNSS_LOSS) } },
      now,
      FaultKind.GNSS_LOSS,
      undefined,
    );
  }

  const evidenceTamper = kind === FaultKind.TAMPER ? parseEvidenceTamper(key) : null;
  if (evidenceTamper && !next.evidence.some((item) => item.id === evidenceTamper.evidenceId)) {
    throw new SimNotFoundError('evidence', evidenceTamper.evidenceId);
  }
  const { message, deviceId } = describeFault(next, kind, key);
  next = { ...next, faults: { active: [...next.faults.active, { kind, since: now, target: key, ...(reason === null ? {} : { reason }) }] } };

  // Immediate effects that are not pure derivations.
  let auditIndex: number | null = null;
  let auditSeq: number | null = null;
  if (kind === FaultKind.MIC_CLIP && key) {
    const channel = key as AudioTrackId;
    next = {
      ...next,
      mics: next.mics.map((mic) => (mic.id === channel ? { ...mic, clipLatched: true } : mic)),
    };
    next = setAudioFrame(next, channel, {
      at: now,
      dbfs: AUDIO_CLIP_BURST_DBFS,
      peak: AUDIO_CLIP_BURST_DBFS,
      clip: true,
      noSignal: false,
    });
  } else if (kind === FaultKind.MIC_NO_SIGNAL && key) {
    const channel = key as AudioTrackId;
    next = setAudioFrame(
      next,
      channel,
      noSignalFrame(now, next.audio.inputs[micInputOfChannel(captureMicLines(next), channel)]?.seq ?? 0),
    );
  } else if (kind === FaultKind.AUDIT_TAMPER) {
    auditIndex = auditTamperIndex(next.audit, target);
    auditSeq = auditIndex === null ? null : (next.audit.rows[auditIndex]?.seq ?? null);
    if (auditIndex !== null) next = { ...next, audit: tamperAuditRow(next.audit, auditIndex) };
  } else if (evidenceTamper) {
    next = {
      ...next,
      evidence: next.evidence.map((item) =>
        item.id === evidenceTamper.evidenceId ? tamperEvidenceItem(item, evidenceTamper.trackId) : item,
      ),
    };
  }

  next = deriveDeviceState(next);
  next = raiseAlert(next, now, kind, key, message, facts);
  const sessionId = next.session?.id ?? null;
  const fromState = next.session?.state ?? null;
  next = {
    ...next,
    ...recordActivity(
      next,
      now,
      kind === FaultKind.AUDIT_TAMPER
        ? {
            audit: {
              type: 'AUDIT_CHAIN_DISCONTINUITY',
              message,
              severity: 'CRITICAL',
              deviceId,
              details: {
                kind,
                evt: FaultEvt[kind],
                eventKind: FAULT_EVENT_KIND[kind],
                index: auditIndex,
                seq: auditSeq,
              },
            },
            event: {
              type: 'AUDIT_CHAIN_BROKEN',
              message,
              severity: 'CRITICAL',
              params: { index: auditIndex, seq: auditSeq },
            },
          }
        : {
            audit: {
              type: 'FAULT_RAISED',
              message,
              severity: FAULT_SEVERITY[kind],
              sessionId,
              deviceId,
              ...(evidenceTamper ? { evidenceId: evidenceTamper.evidenceId } : {}),
              details: {
                kind,
                evt: FaultEvt[kind],
                eventKind: FAULT_EVENT_KIND[kind],
                target: key,
                fromState,
                ...facts,
              },
            },
            event: {
              type: 'FAULT_RAISED',
              message,
              severity: FAULT_SEVERITY[kind],
              sessionId,
              deviceId,
              params: { kind, target: key },
            },
          },
    ),
  };

  if (isCriticalFault(kind)) return enterFault(next, now, kind);
  if (next.session?.state === 'RECORDING') {
    next = addTimelineItem(next, {
      at: now,
      kind: 'FAULT',
      label: message,
      detail: FaultEvt[kind],
      channel: kind === FaultKind.MIC_CLIP || kind === FaultKind.MIC_NO_SIGNAL ? (key as AudioTrackId) : null,
      params: { kind, evt: FaultEvt[kind], target: key, critical: false },
    });
  }
  return next;
}

/** `clearFault(kind, target?)`: without a target, every active fault of that kind clears. */
export function clearFaultTransition(state: SimState, now: EpochMs, kind: FaultKind, target?: FaultTarget): SimState {
  let key: string | null | undefined;
  if (target === undefined) key = undefined;
  else if (kind === FaultKind.AUDIT_TAMPER && target.auditIndex === undefined) key = undefined;
  else key = faultTargetKey(state, kind, target);
  return clearFaultAtKey(state, now, kind, key);
}

/**
 * Clears `kind` under the target key `key` (`undefined`: every active fault of that kind): the body
 * of `clearFault`, for a caller that already knows the key. `clearCaptureWarning` uses it, as
 * `raiseCaptureWarning` uses `raiseFaultAtKey`. Returns the same state when no such fault is active.
 *
 * `reason` (ruling D146): undefined - the faults of every cause under that key, as before; null -
 * only the fault without a cause; a code - only the fault of that cause, so the other causes of
 * the same kind on the same device stay raised with their alerts. A fault WITHOUT a device (key
 * null) has no cause in its key (see `raiseFaultAtKey`): a clear of it is never narrowed by one.
 */
export function clearFaultAtKey(state: SimState, now: EpochMs, kind: FaultKind, key: string | null | undefined, reason?: string | null): SimState {
  const wanted = key === null ? undefined : reason;
  const matches = state.faults.active.filter(
    (fault) => fault.kind === kind && (key === undefined || fault.target === key) && (wanted === undefined || fault.target === null || (fault.reason ?? null) === wanted),
  );
  if (matches.length === 0) return state;

  let next: SimState = {
    ...state,
    faults: { active: state.faults.active.filter((fault) => !matches.includes(fault)) },
  };
  for (const fault of matches) {
    if (kind === FaultKind.AUDIT_TAMPER && fault.target?.startsWith('seq:')) {
      next = { ...next, audit: untamperAuditRow(next.audit, Number(fault.target.slice(4))) };
    }
    const evidenceTamper = kind === FaultKind.TAMPER ? parseEvidenceTamper(fault.target) : null;
    if (evidenceTamper) {
      next = {
        ...next,
        evidence: next.evidence.map((item) => (item.id === evidenceTamper.evidenceId ? restoreEvidenceItem(item) : item)),
      };
    }
    // The alert of a fault about a device is the one of its cause; a fault without a device has one alert, whatever cause it names.
    next = resolveAlerts(next, now, kind, fault.target, fault.target === null ? undefined : (fault.reason ?? null));
  }
  next = deriveDeviceState(next);
  const sessionId = next.session?.id ?? null;
  return {
    ...next,
    ...recordActivity(
      next,
      now,
      matches.map((fault) => ({
        audit: {
          type: 'FAULT_CLEARED' as const,
          message: `${describeFault(state, kind, fault.target).message} — cleared`,
          sessionId,
          details: { kind, evt: FaultEvt[kind], target: fault.target, ...(fault.reason === undefined ? {} : { reason: fault.reason }) },
        },
        event: {
          type: 'FAULT_CLEARED' as const,
          message: `Fault cleared · ${kind}`,
          severity: 'SUCCESS' as const,
          sessionId,
          params: { kind, target: fault.target },
        },
      })),
    ),
  };
}

/** Clears the CLIP latch of one channel. The latch returns on the next burst while MIC_CLIP is active. */
export function resetClipTransition(state: SimState, channel: AudioTrackId): SimState {
  const mic = state.mics.find((m) => m.id === channel);
  if (!mic || !mic.clipLatched) return state;
  const next: SimState = {
    ...state,
    mics: state.mics.map((m) => (m.id === channel ? { ...m, clipLatched: false } : m)),
  };
  return setAudioFrame(next, channel, { clip: false });
}

export function acknowledgeAlertTransition(state: SimState, alertId: string): SimState {
  const alert = state.alerts.find((a) => a.id === alertId);
  if (!alert || alert.acknowledged) return state;
  return { ...state, alerts: state.alerts.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)) };
}

/**
 * The OD-11 microphone-silence warning (schema v2, register SH-08). When the ACTIVE mic input inside
 * `AUDIO-01` has been silent (its frame reads `noSignal`, i.e. a dead or disconnected input) since
 * `activeSilentSince` for at least `MIC_SILENCE_DURATION_MS` while a session is RECORDING, raise one
 * `MIC_SILENT` warning. It NEVER switches the active input and never moves the session to FAULT
 * (`MIC_SILENT` is a WARNING, not in `CRITICAL_FAULTS`; D220/OD-11 — the Core never auto-switches, the
 * operator decides). Idempotent: once raised it stays until cleared, so repeated calls are no-ops.
 *
 * The raiser keys on `noSignal` rather than a raw dBFS dip because the demo's conversational noise
 * floor (-52 dBFS) sits just under the -50 dBFS threshold; a genuine silence warning means a DEAD
 * input (e.g. after a `MIC_NO_SIGNAL` fault on the active channel), not a pause between sentences.
 */
export function maybeRaiseMicSilentWarning(state: SimState, now: EpochMs, activeSilentSince: EpochMs): SimState {
  if (state.session?.state !== SessionState.RECORDING) return state;
  const activeChannel: AudioTrackId = activeMeterChannel(state);
  const activeFrame = state.audio.inputs[micInputOfChannel(captureMicLines(state), activeChannel)];
  if (!activeFrame?.noSignal) return state;
  if (now - activeSilentSince < MIC_SILENCE_DURATION_MS) return state;
  // Never switch: assert the active input is unchanged before and after the inject below.
  return injectFaultTransition(state, now, FaultKind.MIC_SILENT, { channel: activeChannel });
}
