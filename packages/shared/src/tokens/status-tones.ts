/**
 * Status-to-tone mapping (masterplan/01_specs.md §2.8, S8).
 *
 * The first five tones are exactly the kit Chip `color` values on both platforms (V29).
 * `info` and `sealed` have no kit colour: they render as `Chip color="default"` plus the
 * className recipe below, backed by the `@theme` colours in the generated theme files (§2.10).
 *
 * Icon names are lucide names stored as strings; each app resolves them to components.
 */
import type {
  BootRecoveryState,
  CoreLinkState,
  EvidenceLifecycleStage,
  HeartbeatState,
  LensState,
  MicState,
  PowerFailState,
  SecurityState,
  SessionState,
  StorageState,
  TimeSource,
  TrackRecState,
} from '../domain/enums';
import { palette, statusText } from './tokens';

export type StatusTone = 'accent' | 'default' | 'success' | 'warning' | 'danger' | 'info' | 'sealed';
export type KitChipColor = 'accent' | 'default' | 'success' | 'warning' | 'danger';

export type ToneIconName =
  | 'CircleCheck'
  | 'Circle'
  | 'BadgeCheck'
  | 'ShieldCheck'
  | 'Wifi'
  | 'TriangleAlert'
  | 'Info'
  | 'Eye'
  | 'Archive';

/** Kit Chip props for a tone. Tailwind classes use the §2.9 `@theme` colours. */
export function toneChipProps(tone: StatusTone): { color: KitChipColor; className?: string } {
  switch (tone) {
    case 'info':
      return { color: 'default', className: 'bg-info-soft text-info-text border-info/40' };
    case 'sealed':
      return { color: 'default', className: 'bg-sealed-soft text-sealed-text border-sealed/40' };
    default:
      return { color: tone };
  }
}

/** Base hex per tone (Skia, Recharts, Motion and other JS consumers). */
export const toneHex = {
  accent: palette.gold,
  default: palette.gray,
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,
  sealed: palette.sealed,
} as const satisfies Record<StatusTone, string>;

/** Text/icon hex per tone: the AA 400-step text colours (V39); `default` uses gray. */
export const toneTextHex = {
  accent: statusText.accent,
  default: palette.gray,
  success: statusText.success,
  warning: statusText.warning,
  danger: statusText.danger,
  info: statusText.info,
  sealed: statusText.sealed,
} as const satisfies Record<StatusTone, string>;

export interface BadgeSpec {
  label: string;
  tone: StatusTone;
  icon: ToneIconName;
}

/** DesignSystem §06 badges. */
export const BADGES = {
  READY: { label: 'Ready', tone: 'success', icon: 'CircleCheck' },
  RECORDING: { label: 'Recording', tone: 'danger', icon: 'Circle' },
  OFFLINE: { label: 'Offline', tone: 'default', icon: 'Circle' },
  SEALED: { label: 'Sealed', tone: 'sealed', icon: 'BadgeCheck' },
  SECURE: { label: 'Secure', tone: 'success', icon: 'ShieldCheck' },
  CONNECTED: { label: 'Connected', tone: 'success', icon: 'Wifi' },
  WARNING: { label: 'Warning', tone: 'warning', icon: 'TriangleAlert' },
  INFO: { label: 'Info', tone: 'info', icon: 'Info' },
  UNDER_REVIEW: { label: 'Under Review', tone: 'warning', icon: 'Eye' },
  ARCHIVED: { label: 'Archived', tone: 'default', icon: 'Archive' },
} as const satisfies Record<string, BadgeSpec>;

export interface TagSpec {
  label: string;
  tone: StatusTone;
  variant: 'soft' | 'outline';
}

/** AssetSample "Badges & Tags". */
export const TAGS = {
  NEW: { label: 'NEW', tone: 'info', variant: 'soft' },
  URGENT: { label: 'URGENT', tone: 'danger', variant: 'soft' },
  SEALED: { label: 'SEALED', tone: 'sealed', variant: 'soft' },
  IN_REVIEW: { label: 'IN REVIEW', tone: 'warning', variant: 'outline' },
  EXPORTED: { label: 'EXPORTED', tone: 'info', variant: 'outline' },
  ARCHIVED: { label: 'ARCHIVED', tone: 'default', variant: 'outline' },
} as const satisfies Record<string, TagSpec>;

/** AssetSample "Status Indicators". */
export const INDICATORS = {
  connectivity: { ONLINE: 'success', WARNING: 'warning', ERROR: 'danger', OFFLINE: 'default' },
  shield: { SECURE: 'success', ATTENTION: 'warning', CRITICAL: 'danger', UNKNOWN: 'default' },
  recording: { READY: 'success', RECORDING: 'danger', PAUSED: 'warning', STOP: 'default' },
} as const satisfies Record<string, Record<string, StatusTone>>;

// Enumeration tones (§2.8 table)

export const HeartbeatStateTone = {
  CONNECTING: 'default',
  LIVE: 'success',
  STALE: 'warning',
  OFFLINE: 'danger',
} as const satisfies Record<HeartbeatState, StatusTone>;

export const CoreLinkStateTone = {
  ONLINE: 'success',
  OFFLINE: 'danger',
} as const satisfies Record<CoreLinkState, StatusTone>;

export const LensStateTone = {
  READY: 'success',
  FAULT: 'danger',
} as const satisfies Record<LensState, StatusTone>;

export const SecurityStateTone = {
  READY: 'success',
  FAULT: 'danger',
} as const satisfies Record<SecurityState, StatusTone>;

export const MicStateTone = {
  READY: 'success',
  NO_SIGNAL: 'warning',
  CLIP: 'danger',
} as const satisfies Record<MicState, StatusTone>;

export const StorageStateTone = {
  READY: 'success',
  LOW: 'warning',
  FULL: 'danger',
} as const satisfies Record<StorageState, StatusTone>;

export const TimeSourceTone = {
  GNSS: 'success',
  NTP: 'info',
  RTC: 'warning',
} as const satisfies Record<TimeSource, StatusTone>;

export const SessionStateTone = {
  CREATE: 'default',
  PRECHECK: 'accent',
  ARMED: 'warning',
  RECORDING: 'danger',
  STOPPING: 'warning',
  FINALIZING: 'accent',
  SEALED: 'sealed',
  FAULT: 'danger',
  RECOVERY: 'warning',
} as const satisfies Record<SessionState, StatusTone>;

export const TrackRecStateTone = {
  REC: 'success',
  DEGRADED: 'warning',
  LOST: 'danger',
} as const satisfies Record<TrackRecState, StatusTone>;

export const EvidenceLifecycleStageTone = {
  CAPTURE: 'accent',
  RECORDING: 'accent',
  FINALIZING: 'accent',
  HASH: 'accent',
  MANIFEST: 'accent',
  ENCRYPT: 'accent',
  SIGN: 'accent',
  SEALED_LOCAL_EVIDENCE: 'sealed',
  AUTHORIZED_REVIEW: 'default',
  AUTHORIZED_EXPORT_TRANSFER: 'success',
  DESTINATION_VERIFICATION: 'success',
  RETENTION_ARCHIVE_DISPOSITION: 'default',
} as const satisfies Record<EvidenceLifecycleStage, StatusTone>;

export const PowerFailStateTone = {
  NORMAL: 'success',
  POWER_FAIL_DETECTED: 'warning',
  RECORDING_RECOVERY_MARKER_WRITTEN: 'warning',
  FLUSH_MEDIA_AND_METADATA: 'warning',
  STORAGE_SYNC: 'warning',
  SAFE_SHUTDOWN: 'danger',
  POWER_OFF: 'danger',
} as const satisfies Record<PowerFailState, StatusTone>;

export const BootRecoveryStateTone = {
  RECOVERY_SCAN: 'warning',
  INCOMPLETE_SESSION_ANALYSIS: 'warning',
} as const satisfies Record<BootRecoveryState, StatusTone>;

/** Icon shown inside the heartbeat Chip (names from the §2.8 badge set). */
export const HeartbeatStateIcon = {
  CONNECTING: 'Circle',
  LIVE: 'Wifi',
  STALE: 'TriangleAlert',
  OFFLINE: 'Circle',
} as const satisfies Record<HeartbeatState, ToneIconName>;

/**
 * Typography token names as Tailwind `text-*` font-size utilities. tailwind-merge only knows
 * T-shirt sizes, so it classifies `text-display` as a colour and drops it next to `text-accent`.
 * Apps register these names with `extendTailwindMerge` (see core-web `src/lib/utils.ts`).
 */
export const TYPOGRAPHY_FONT_SIZE_CLASSES = [
  'display',
  'h1',
  'h2',
  'h3',
  'body',
  'caption',
  'label',
  'data',
] as const;
