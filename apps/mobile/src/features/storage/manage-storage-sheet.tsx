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
 */
import { Alert, BottomSheet, Button, Description, Label, RadioGroup, Switch } from 'heroui-native';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { RetentionPolicyId, SimContext, useSimInstance, type OperatorRole } from '@dems/shared/sim';
import { derived, fontFamily, palette, typography } from '@dems/shared/tokens';
import { triggerHaptic } from '@/motion';
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

export interface ManageStorageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The signed-in operator's role, or null when signed out (portal: passed as a prop). */
  role: OperatorRole | null;
  policy: StoragePolicyView;
  /** Writes the policy; resolves true on success (the caller shows the toast and logs failures). */
  onApply: (draft: PolicyDraft) => boolean;
}

export function ManageStorageSheet({ isOpen, onClose, role, policy, onApply }: ManageStorageSheetProps) {
  const { t } = useTranslation();
  const sim = useSimInstance();
  const presence = useSheetPresence(isOpen);
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
              <ManageStorageBody role={role} policy={policy} onApply={onApply} onDone={onClose} />
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
  onApply: (draft: PolicyDraft) => boolean;
  onDone: () => void;
}

/** The sheet body; its draft starts from the current policy each time the sheet mounts. */
export function ManageStorageBody({ role, policy, onApply, onDone }: ManageStorageBodyProps) {
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
        onPress={() => {
          triggerHaptic('primaryPress');
          if (onApply(draft)) onDone();
        }}
      >
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
