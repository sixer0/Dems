/**
 * Evidence chips (04_mobile_specs §4.10 E4, §4.11 D2/D4): the status chip per D28/Q4 (Sealed is
 * violet with a lock, Recorded success with a filled dot, Exported info with an upload arrow, Under
 * Review warning with an eye, Archived default) and the subject-type chip (Indonesian terms from the
 * shared keys; the kit chip takes the simulator code directly since step 78's change, relay F74-03).
 * Both are the kit recipes (`StatusChip`, `SubjectTypeChip`).
 */
import type { ChipProps } from 'heroui-native';
import { Archive, Circle, Eye, Lock, Upload, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { EvidenceStatus, SubjectType } from '@dems/shared/sim';
import { StatusChip, SubjectTypeChip } from '@/components/kit';
import { EVIDENCE_STATUS_SPEC, type EvidenceStatusIcon } from './evidence-model';

const STATUS_ICONS: Record<EvidenceStatusIcon, LucideIcon> = {
  lock: Lock,
  dot: Circle,
  upload: Upload,
  eye: Eye,
  archive: Archive,
};

export interface EvidenceStatusChipProps extends Omit<ChipProps, 'color' | 'children'> {
  status: EvidenceStatus;
}

export function EvidenceStatusChip({ status, size = 'sm', ...chipProps }: EvidenceStatusChipProps) {
  const { t } = useTranslation();
  const spec = EVIDENCE_STATUS_SPEC[status];
  return (
    <StatusChip
      {...chipProps}
      size={size}
      tone={spec.tone}
      icon={STATUS_ICONS[spec.icon]}
      iconFilled={spec.filled}
      label={t(`common.evidenceStatus.${status}`)}
    />
  );
}

export interface EvidenceSubjectChipProps extends Omit<ChipProps, 'color' | 'children'> {
  subjectType: SubjectType;
}

export function EvidenceSubjectChip({ subjectType, size = 'sm', ...chipProps }: EvidenceSubjectChipProps) {
  return <SubjectTypeChip {...chipProps} size={size} type={subjectType} />;
}
