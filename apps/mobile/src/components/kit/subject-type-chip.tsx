import type { ChipProps } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import type { SubjectType as SimSubjectType } from '@dems/shared/sim';
import type { StatusTone } from '@dems/shared/tokens';
import { StatusChip } from './status-chip';

/**
 * Subject types, verbatim Indonesian domain terms (D28/Q3; 01S §14.7 dataset values).
 *
 * Two spellings are accepted (D73, F74-03; step 78 owns this one change):
 * - the simulator codes `TERSANGKA` / `SAKSI` / `LAINNYA` (`SubjectType` of `@dems/shared/sim`),
 *   which screens pass straight from simulator objects;
 * - the display terms `Tersangka` / `Saksi` / `Lainnya` of the first version (kept, so existing
 *   callers such as the dashboard keep working unchanged).
 * Either way the label and the English gloss come from the shared i18n `common.subjectType.<CODE>`
 * and `common.subjectTypeGloss.<CODE>` (MA-21: no literal terms in screens).
 */
export const SUBJECT_TYPES = ['Tersangka', 'Saksi', 'Lainnya'] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

/**
 * The simulator codes, in the same order as `SUBJECT_TYPES`. Type-checked against the simulator's
 * `SubjectType` (a type-only import, so the kit does not load the simulator at run time).
 */
export const SUBJECT_TYPE_CODES = ['TERSANGKA', 'SAKSI', 'LAINNYA'] as const satisfies readonly SimSubjectType[];
export type SubjectTypeCode = (typeof SUBJECT_TYPE_CODES)[number];

/** What the chip accepts: a simulator code or a display term. */
export type SubjectTypeInput = SubjectTypeCode | SubjectType;

/** 04_mobile_specs §4.0: Tersangka → danger soft; Saksi → info recipe; Lainnya → default. */
export const SubjectTypeTone = {
  Tersangka: 'danger',
  Saksi: 'info',
  Lainnya: 'default',
} as const satisfies Record<SubjectType, StatusTone>;

/** The same tones keyed by simulator code. */
export const SubjectTypeCodeTone = {
  TERSANGKA: 'danger',
  SAKSI: 'info',
  LAINNYA: 'default',
} as const satisfies Record<SubjectTypeCode, StatusTone>;

/**
 * Normalises either spelling to the simulator code (case-insensitive). Anything unknown maps to
 * `LAINNYA` ("other"), so a malformed value never crashes a list row.
 */
export function toSubjectTypeCode(type: string): SubjectTypeCode {
  const upper = type.toUpperCase();
  return SUBJECT_TYPE_CODES.find((code) => code === upper) ?? 'LAINNYA';
}

export interface SubjectTypeChipProps extends Omit<ChipProps, 'color' | 'children'> {
  /** A simulator code (`TERSANGKA`) or a display term (`Tersangka`). */
  type: SubjectTypeInput;
}

/**
 * Subject-type chip recipe: the verbatim term as the label and its English gloss (Suspect,
 * Witness, Other) as the accessibility hint (D28/Q3). Copy comes from the shared i18n keys.
 */
export function SubjectTypeChip({ type, ...chipProps }: SubjectTypeChipProps) {
  const { t } = useTranslation();
  const code = toSubjectTypeCode(type);
  return (
    <StatusChip
      accessibilityHint={t(`common.subjectTypeGloss.${code}`)}
      {...chipProps}
      tone={SubjectTypeCodeTone[code]}
      label={t(`common.subjectType.${code}`)}
      icon={null}
    />
  );
}
