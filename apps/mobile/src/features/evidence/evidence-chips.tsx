/**
 * Evidence chips (04_mobile_specs §4.10 E4, §4.11 D2/D4): the status chip per D28/Q4 (Sealed is
 * violet with a lock, Recorded success with a filled dot, Exported info with an upload arrow, Under
 * Review warning with an eye, Archived default) and the subject-type chip (Indonesian terms from the
 * shared keys; the kit chip takes the simulator code directly since step 78's change, relay F74-03).
 * Both are the kit recipes (`StatusChip`, `SubjectTypeChip`).
 */
import type { ChipProps } from 'heroui-native';
import { Archive, Circle, Eye, Lock, ShieldAlert, Upload, type LucideIcon } from 'lucide-react-native';
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
  /**
   * Fix wave J (JT-04, truth rule 3b; contract J-S 8): `verificationOfRecordFailed(item)`. An item whose
   * verification of record FAILED never reads plain "Sealed": the chip says "Sealed · verification FAILED" in
   * the danger tone, wherever the status is drawn (list row, item header, Status fact).
   */
  verificationFailed?: boolean;
}

/** The words of an item's status: the status, or the failed verification of record (JT-04). */
export function useEvidenceStatusLabel(): (status: EvidenceStatus, verificationFailed: boolean) => string {
  const { t } = useTranslation();
  return (status, verificationFailed) => (verificationFailed ? t('common.truth.sealedVerificationFailed') : t(`common.evidenceStatus.${status}`));
}

export function EvidenceStatusChip({ status, verificationFailed = false, size = 'sm', ...chipProps }: EvidenceStatusChipProps) {
  const { t } = useTranslation();
  const spec = EVIDENCE_STATUS_SPEC[status];
  if (verificationFailed) {
    return <StatusChip {...chipProps} size={size} tone="danger" icon={ShieldAlert} label={t('common.truth.sealedVerificationFailed')} />;
  }
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
