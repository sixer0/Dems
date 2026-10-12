/**
 * Evidence chips (04_mobile_specs §4.10 E4, §4.11 D2/D4): the status chip per D28/Q4 (Sealed is
 * violet with a lock, Recorded success with a filled dot, Exported info with an upload arrow, Under
 * Review warning with an eye, Archived default) and the subject-type chip (Indonesian terms from the
 * shared keys; the kit chip takes the simulator code directly since step 78's change, relay F74-03).
 * Both are the kit recipes (`StatusChip`, `SubjectTypeChip`).
 */
import type { ChipProps } from 'heroui-native';
import { Archive, Circle, Eye, Lock, ShieldAlert, TriangleAlert, Upload, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { isOwnCaptureCoreState, useSim, type EvidenceStatus, type SubjectType } from '@dems/shared/sim';
import { StatusChip, SubjectTypeChip } from '@/components/kit';
import { useCoreLink } from '@/runtime';
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
  /**
   * Fix wave Q (CP-08, truth rule 3a): `!hasSealedValues(item)`. A record that was never sealed does not wear the
   * green "Recorded" chip with its dot (the colour and mark of "Online"): the chip reads "Not sealed" in the
   * warning tone, wherever the status is drawn (list row, item header, Status fact).
   */
  neverSealed?: boolean;
}

/** The words of an item's status: the status, or the failed verification of record (JT-04). */
export function useEvidenceStatusLabel(): (status: EvidenceStatus, verificationFailed: boolean) => string {
  const { t } = useTranslation();
  return (status, verificationFailed) => (verificationFailed ? t('common.truth.sealedVerificationFailed') : t(`common.evidenceStatus.${status}`));
}

/**
 * Fix wave Q (CP-05, truth rule 3f): the mark of a demonstration record in a LIST row (`DemonstrationChip`). The
 * Summary, the item and the verdict of such a record say "DEMONSTRATION"; its rows said plain "Sealed". Which rows:
 * the Evidence row asks the item (`isDemoItem` of `item-facts`: never an item a real-capture Core sealed itself),
 * the Sessions row asks the Core link (`useSimulatedCoreLink`).
 */

/**
 * A Core link to a SIMULATED Core (contract J-S 7: in Live mode a Core that states neither of its own-capture
 * facts): the rule of the Session Summary's demonstration statement, for the rows of the Sessions hub, which have
 * no `integritySource` of their own.
 */
export function useSimulatedCoreLink(): boolean {
  const live = useCoreLink().source === 'LIVE';
  return useSim((s) => !isOwnCaptureCoreState(s)) && live;
}

export function DemonstrationChip({ testID }: { testID?: string }) {
  const { t } = useTranslation();
  // The short word ("DEMO", the shared chip of a demo item) with the whole word spoken: in the tablet's narrow list
  // pane "DEMONSTRATION" broke inside the chip beside "Tersangka" and a wide status chip.
  return <StatusChip size="sm" tone="warning" icon={null} label={t('evidence.demo.chip')} accessibilityLabel={t('common.truth.demonstrationChip')} {...(testID ? { testID } : {})} />;
}

export function EvidenceStatusChip({ status, verificationFailed = false, neverSealed = false, size = 'sm', ...chipProps }: EvidenceStatusChipProps) {
  const { t } = useTranslation();
  const spec = EVIDENCE_STATUS_SPEC[status];
  if (verificationFailed) {
    return <StatusChip {...chipProps} size={size} tone="danger" icon={ShieldAlert} label={t('common.truth.sealedVerificationFailed')} />;
  }
  if (neverSealed) {
    return <StatusChip {...chipProps} size={size} tone="warning" icon={TriangleAlert} label={t('common.truth.notSealed')} />;
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
