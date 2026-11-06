/**
 * The step-1 live readiness list of Start Session (the tablet-landscape device column), audit row 182 (M3-04 R5;
 * register C10-C12; decision D113; web reference row 150, `info-step.tsx` `selectReadiness`).
 *
 * Every check of `PRECHECK_ORDER`, with its live state from the shared live reader `evaluateLiveReadiness`
 * (`useLiveReadiness`). On a Core in its own capture an assigned source that the Core has not checked since it started
 * reads "Not checked" (C11, the tablet's existing word `features.capture-selector.sourceState.notChecked`; no new key),
 * testID `precheck-not-checked-<ID>`, on a neutral chip: it neither passes nor warns, and the gate on step 2 still judges
 * it (`evaluatePrecheck`). The count line "N not checked" (C12, shared `sessionNew.preview.notCheckedCount`) is drawn only
 * when N > 0, so the simulated lane draws exactly what `LiveChecks` drew.
 *
 * The SECURITY row of a Core that reports no platform posture (value NOT_REPORTED) reads "Not reported" on an info chip,
 * as the gate's row does (`devices-check-step.tsx`, round two JT-03): `LiveChecks` drew the raw value with a warning tone
 * (missing key `common.enums.securityState.NOT_REPORTED`, found by this row's test).
 *
 * While the Core link is down every row says the Core's last state is not known (fix wave L, G70c-06), so no row and no
 * count says "Not checked" then.
 *
 * It replaced `LiveChecks` of `device-previews.tsx` and is mounted there by `LiveDeviceColumn` (row 182 as that hot file's
 * writer 2, ruling D193). Row and value testIDs are the ones `LiveChecks` drew.
 */
import { ListGroup, Separator, Typography } from 'heroui-native';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SECURITY_NOT_REPORTED_PRECHECK_VALUE } from '@dems/shared/sim';
import { spacing } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { CheckIcon } from './check-icon';
import { CHECK_ORDER, decodeEvaluation, hostClockValue, liveCheckWhileLinkDown, precheckTone, valueKey } from './session-new-model';
import { isLiveNotChecked, useLiveReadiness } from './use-session-new';

/** C11: the tablet's "Not checked" (the selector, Home and Devices say it with the same key). */
export const LIVE_NOT_CHECKED_KEY = 'features.capture-selector.sourceState.notChecked';

/** How many entries of `useLiveReadiness` read "Not checked" (C12). Zero while the Core link is down. */
export function notCheckedCountOf(readiness: readonly string[], linkDown = false): number {
  return linkDown ? 0 : readiness.filter(isLiveNotChecked).length;
}

export function LiveReadinessChecks({ linkDown }: { linkDown: boolean }) {
  const { t } = useTranslation();
  const readiness = useLiveReadiness();
  const notChecked = notCheckedCountOf(readiness, linkDown);
  return (
    <View style={styles.stack}>
      {notChecked > 0 ? (
        <Typography type="body-xs" color="muted" testID="precheck-not-checked-count">
          {t('sessionNew.preview.notCheckedCount', { count: notChecked })}
        </Typography>
      ) : null}
      <ListGroup variant="transparent">
        {CHECK_ORDER.map((id, index) => {
          const encoded = readiness[index] ?? 'PASS|';
          // Wave H closing pass Z2: the live TIME row of a Core in its own capture is the host clock - a note, not a warning.
          const stated = liveCheckWhileLinkDown(id, linkDown);
          const notCheckedRow = stated === null && isLiveNotChecked(encoded);
          const { status, value } = decodeEvaluation(encoded);
          const securityNotReported = stated === null && id === 'SECURITY' && value === SECURITY_NOT_REPORTED_PRECHECK_VALUE;
          const tone = stated !== null ? stated.tone : notCheckedRow ? 'default' : precheckTone(status, hostClockValue(id, value) || securityNotReported);
          const label =
            stated !== null
              ? t(stated.key)
              : notCheckedRow
                ? t(LIVE_NOT_CHECKED_KEY)
                : securityNotReported
                  ? t('common.platformNotReported.value')
                  : t(valueKey(id, value), { defaultValue: value });
          return (
            <Fragment key={id}>
              {index > 0 ? <Separator /> : null}
              <ListGroup.Item testID={`session-new-live-${id}`} className="py-2">
                <ListGroup.ItemPrefix>
                  <CheckIcon id={id} tone={tone} size={16} />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{t(`sessionNew.devices.checks.${id}`)}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <StatusChip size="sm" tone={tone} label={label} icon={null} testID={notCheckedRow ? `precheck-not-checked-${id}` : `session-new-live-${id}-value`} />
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
            </Fragment>
          );
        })}
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing[1] },
});
