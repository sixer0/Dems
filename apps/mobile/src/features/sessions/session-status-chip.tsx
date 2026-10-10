/**
 * Sessions hub status chip (04_mobile_specs §4.9): RECORDING danger with a filled dot, SEALED
 * violet with a lock (D28/Q4, the Evidence list's recipe), INCOMPLETE amber, FAULT danger,
 * FINALIZING info. The word is the shared `common.enums.sessionState.<status>` label. Kit recipe
 * (`StatusChip`), no new primitive (D6).
 */
import type { ChipProps } from 'heroui-native';
import { Circle, LoaderCircle, Lock, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StatusChip } from '@/components/kit';
import { useConnectingCameras } from '@/features/session-live/rec-indicator';
import { useInterruptedSeal } from '@/features/session-finalizing/interrupted-seal';
import { HUB_STATUS_SPEC, type HubStatus, type HubStatusIcon } from './sessions-model';

const ICONS: Record<HubStatusIcon, LucideIcon> = {
  dot: Circle,
  loader: LoaderCircle,
  octagon: OctagonAlert,
  lock: Lock,
  triangle: TriangleAlert,
};

export interface SessionStatusChipProps extends Omit<ChipProps, 'color' | 'children'> {
  status: HubStatus;
  /** The session of the row (wave H driver B): a SEALED row of an interrupted recording says so. */
  sessionId?: string;
}

export function SessionStatusChip({ status, sessionId, size = 'sm', ...chipProps }: SessionStatusChipProps) {
  const { t } = useTranslation();
  const spec = HUB_STATUS_SPEC[status];
  // Integration pass D7 item 3 (ux §8e.2; D84, D91): the one RECORDING row of the hub is the open session; before
  // its first durable fragment (`captureDurable: false`) it reads "Connecting cameras…", with no filled REC dot.
  const connecting = useConnectingCameras() && status === 'RECORDING';
  const interrupted = useInterruptedSeal(status === 'SEALED' || status === 'FINALIZING' ? (sessionId ?? null) : null);
  if (connecting) {
    return <StatusChip {...chipProps} size={size} tone="info" icon={ICONS.loader} label={t('common.session.connectingCameras')} />;
  }
  // Wave H driver B (G75-03, ruling D197): never the plain sealed state for a recording that was interrupted.
  if (interrupted !== null) {
    return <StatusChip accessibilityLabel={interrupted.title} {...chipProps} size={size} tone="warning" icon={ICONS.triangle} label={interrupted.chip} />;
  }
  return (
    <StatusChip
      {...chipProps}
      size={size}
      tone={spec.tone}
      icon={ICONS[spec.icon]}
      iconFilled={spec.filled}
      label={t(`common.enums.sessionState.${status}`)}
    />
  );
}
