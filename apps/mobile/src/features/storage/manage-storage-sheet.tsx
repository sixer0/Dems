/**
 * T4 Manage Storage sheet (04_mobile_specs §4.13: `BottomSheet` with the retention policy, the
 * auto-archive `Switch` and Save: simulated, audited; `storagePolicy`).
 *
 * - Retention: kit `RadioGroup` over the four simulator policies (the spec's `Select`, as a radio
 *   list: a Select opens its own overlay, and a popover inside a sheet is the F-79-2 parking case).
 * - Auto-archive: kit `Switch`. Sealed evidence is protected (shared copy).
 * - Thresholds LOW 85% / FULL 98%: read-only (the simulator has constants, no setter).
 * - Apply → `setStoragePolicy` (the simulator writes STORAGE_POLICY_CHANGED to the audit chain and
 *   the event stream). Role-gated in the UI (SIM-GAP-M85-2): an Investigator sees the policy with
 *   the controls disabled and the reason (S20 "isDisabled + a reason").
 *
 * The kit portals the sheet above the runtime providers, so the frame re-provides the simulator and
 * the sheet takes the operator role and the apply callback as props (step 83's sheet-frame note).
 * Mount on demand: `use-sheet-presence.tsx` (F-79-2).
 *
 * Live mode (backend task, plan row W79; 04_client_integration_spec §8.1 LB-1, §8.6 S2-6, §8.7 S5-3):
 * - S2-6: Apply runs the screen's `onApply` inside `usePendingPress` (`@/runtime`): from the press
 *   until the policy change settled a second press sends nothing and Apply is marked busy with its
 *   look unchanged; after `LIVE_PENDING_REVEAL_MS` on the store's clock the kit's `Spinner` shows in
 *   it. The sheet closes in `ok` (`applied`) and stays open with the draft on a refusal. The press
 *   state lives here, outside the portal, so it outlasts a sheet closed while the command is out.
 * - S5-3: the role gate above stays a hint read from the replicated operator; the Core enforces the
 *   any-of rule on operation 55, and its 403 reaches the presenter.
 * In Simulated mode the command settles before the press returns: nothing is ever marked busy.
 */
import { Alert, BottomSheet, Button, Description, Label, RadioGroup, Switch } from 'heroui-native';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { RetentionPolicyId, SimContext, useSimInstance, type OperatorRole } from '@dems/shared/sim';
import { derived, fontFamily, palette, typography } from '@dems/shared/tokens';
import { triggerHaptic } from '@/motion';
import { PendingSpinner, busyState, usePendingPress } from '@/runtime';
import { THRESHOLDS } from './storage-model';
import { canManageStoragePolicy } from './sim-adapter';
import type { StoragePolicyView } from './use-storage-data';
import { SheetContentSignal, useSheetPresence } from './use-sheet-presence';

export const RETENTION_POLICIES: readonly RetentionPolicyId[] = [
  RetentionPolicyId.DAYS_30,
  RetentionPolicyId.DAYS_90,
  RetentionPolicyId.YEAR_1,
  RetentionPolicyId.CASE_CLOSURE,
];

export interface PolicyDraft {
  retentionPolicy: RetentionPolicyId;
  autoArchive: boolean;
}

/** What follows a policy change once it settled (site S2-6). */
export interface ApplyHandlers {
  /** The change was applied (`ok`): the sheet closes. */
  applied: () => void;
  /** The change settled, applied or refused (`done`): Apply returns to idle. */
  settled: () => void;
}

export interface ManageStorageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The signed-in operator's role, or null when signed out (portal: passed as a prop). */
  role: OperatorRole | null;
  policy: StoragePolicyView;
  /**
   * Writes the policy (the caller shows the toast and logs failures) and runs `applied` on success
   * and `settled` in every path, at once in Simulated mode and on the Core's answer in Live mode.
   */
  onApply: (draft: PolicyDraft, handlers: ApplyHandlers) => void;
}

export function ManageStorageSheet({ isOpen, onClose, role, policy, onApply }: ManageStorageSheetProps) {
  const { t } = useTranslation();
  const sim = useSimInstance();
  const press = usePendingPress();
  const presence = useSheetPresence(isOpen);
  // S2-6: one command per press; the sheet closes in `ok` and stays open on a refusal.
  const apply = (draft: PolicyDraft) => {
    press.run((release) => onApply(draft, { applied: onClose, settled: release }));
  };
  if (!presence.mounted) return null;
  return (
    <BottomSheet isOpen={presence.open} onOpenChange={(open) => (open ? undefined : onClose())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <SheetContentSignal onChange={presence.setContentMounted}>
            <View style={styles.header} testID="storage-manage-sheet">
              <View style={styles.headerText}>
                <BottomSheet.Title>{t('storage.manage.title')}</BottomSheet.Title>
                <BottomSheet.Description>{t('storage.manage.description')}</BottomSheet.Description>
              </View>
              {/* Also closes directly, so a close within the opening frame is never lost. */}
              <BottomSheet.Close accessibilityLabel={t('features.storage.manage.close')} testID="storage-manage-close" onPress={onClose} />
            </View>
            <SimContext.Provider value={sim}>
              <ManageStorageBody role={role} policy={policy} onApply={apply} busy={press.busy} pending={press.pending} />
            </SimContext.Provider>
          </SheetContentSignal>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

interface ManageStorageBodyProps {
  role: OperatorRole | null;
  policy: StoragePolicyView;
  /** Sends the draft; the frame closes the sheet once it was applied. */
  onApply: (draft: PolicyDraft) => void;
  /** A policy change is out (LB-1): Apply is marked busy, its look unchanged. */
  busy: boolean;
  /** It has been out for `LIVE_PENDING_REVEAL_MS` or longer: the kit's `Spinner` shows in Apply. */
  pending: boolean;
}

/** The sheet body; its draft starts from the current policy each time the sheet mounts. */
export function ManageStorageBody({ role, policy, onApply, busy, pending }: ManageStorageBodyProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PolicyDraft>({ retentionPolicy: policy.retentionPolicy, autoArchive: policy.autoArchive });
  const allowed = canManageStoragePolicy(role);
  const changed = draft.retentionPolicy !== policy.retentionPolicy || draft.autoArchive !== policy.autoArchive;
  const onOff = (on: boolean) => (on ? t('storage.kpi.on') : t('storage.kpi.off'));

  return (
    <View style={styles.body}>
      {!allowed ? (
        <Alert status="default" testID="storage-manage-readonly">
          <Alert.Indicator>
            <Lock size={18} color={palette.gray} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{t('features.storage.manage.readOnlyTitle')}</Alert.Title>
            <Alert.Description>
              {role
                ? t('features.storage.manage.readOnlyReason', { role: t(`common.roles.${role}`) })
                : t('features.storage.manage.signedOutReason')}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <Text testID="storage-manage-current" maxFontSizeMultiplier={1.2} style={styles.current}>
        {t('features.storage.manage.current', {
          policy: t(`storage.manage.policies.${policy.retentionPolicy}`),
          autoArchive: onOff(policy.autoArchive),
        })}
      </Text>

      <View style={styles.block}>
        <Label>{t('storage.manage.retentionPolicy')}</Label>
        <RadioGroup
          value={draft.retentionPolicy}
          onValueChange={(value) => {
            triggerHaptic('segmentSelect');
            setDraft((d) => ({ ...d, retentionPolicy: value as RetentionPolicyId }));
          }}
          isDisabled={!allowed}
          testID="storage-manage-retention"
        >
          {RETENTION_POLICIES.map((id) => (
            <RadioGroup.Item key={id} value={id} testID={`storage-manage-retention-${id}`}>
              {t(`storage.manage.policies.${id}`)}
            </RadioGroup.Item>
          ))}
        </RadioGroup>
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Label>{t('storage.manage.autoArchive')}</Label>
          <Description>{t('storage.manage.autoArchiveHint')}</Description>
        </View>
        <Switch
          testID="storage-manage-auto-archive"
          isSelected={draft.autoArchive}
          isDisabled={!allowed}
          onSelectedChange={(on) => {
            triggerHaptic('switchToggle');
            setDraft((d) => ({ ...d, autoArchive: on }));
          }}
          accessibilityLabel={t('storage.manage.autoArchive')}
        />
      </View>
      <Description>{t('storage.manage.sealedProtected')}</Description>

      <View style={styles.thresholds} testID="storage-manage-thresholds">
        <Label>{t('storage.manage.thresholdsTitle')}</Label>
        <Text maxFontSizeMultiplier={1.2} style={styles.threshold}>
          {t('storage.manage.thresholdLow', { percent: THRESHOLDS.low })}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.threshold}>
          {t('storage.manage.thresholdFull', { percent: THRESHOLDS.full })}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.note}>
          {t('features.storage.manage.thresholdsNote')}
        </Text>
      </View>

      <Button
        testID="storage-manage-apply"
        variant="primary"
        size="lg"
        isDisabled={!allowed || !changed}
        accessibilityLabel={changed ? t('storage.manage.apply') : t('storage.manage.unchanged')}
        {...busyState(busy, !allowed || !changed)}
        onPress={() => {
          triggerHaptic('primaryPress');
          onApply(draft);
        }}
      >
        {pending ? <PendingSpinner color={palette.black} testID="storage-manage-apply-spinner" /> : null}
        <Button.Label>{t('storage.manage.apply')}</Button.Label>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  headerText: { flex: 1, gap: 4 },
  body: { gap: 16, paddingBottom: 24 },
  current: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: derived.foreground2,
  },
  block: { gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  switchText: { flex: 1, gap: 2 },
  thresholds: {
    gap: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: derived.border,
  },
  threshold: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  note: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
});
