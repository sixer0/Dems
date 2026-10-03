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
}

export function SessionStatusChip({ status, size = 'sm', ...chipProps }: SessionStatusChipProps) {
  const { t } = useTranslation();
  const spec = HUB_STATUS_SPEC[status];
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
