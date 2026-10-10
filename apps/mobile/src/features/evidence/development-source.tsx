/**
 * The development-source marks of the Evidence screens (blueprint row 92; UX spec §6.6
 * "Development-source label", §8f.2; R-11; decisions D83, D91 ruling R-2, D131).
 *
 * | Mark | Drawn from | Never from |
 * |------|-----------|------------|
 * | On an evidence row and on the item hero | `developmentSources === true` of the item, as the Core recorded it at the seal (operations 39 / 40) | the current device list |
 * | On a camera file and in the band legend | the class a VERIFY RESULT states (`sources` of operation 41) | the current device list |
 *
 * The same chip as the app's device badge (kit `StatusChip`, tone `warning`, an icon AND the words
 * of `features.capture-selector.source.badge`): one wording everywhere. `false`, `null` and an
 * absent member draw nothing, and nothing here ever says "production". Outside Live mode no badge
 * is drawn: the mode banner already says what the data is, and the verify result still reports
 * the mark.
 */
import { FlaskConical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StatusChip } from '@/components/kit';
import { useMobileLive } from '@/runtime';
import { itemDevelopmentBadge, readItemV2 } from './item-v2';

/** The chip itself. */
export function DevelopmentChip({ testID }: { testID: string }) {
  const { t } = useTranslation();
  return <StatusChip size="sm" tone="warning" label={t('features.capture-selector.source.badge')} icon={FlaskConical} testID={testID} />;
}

/** The badge of an item the Core recorded from development sources; nothing otherwise. */
export function ItemDevelopmentBadge({ item, testID }: { item: unknown; testID: string }) {
  const live = useMobileLive() !== null;
  if (!itemDevelopmentBadge(readItemV2(item), live)) return null;
  return <DevelopmentChip testID={testID} />;
}

/** The badge of one verified source: only the two development classes of the manifest draw it. */
export function VerifiedSourceBadge({ sourceClass, testID }: { sourceClass: string; testID: string }) {
  const live = useMobileLive() !== null;
  if (!live || (sourceClass !== 'LOCAL_DEVICE' && sourceClass !== 'FAKE')) return null;
  return <DevelopmentChip testID={testID} />;
}
