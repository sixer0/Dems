/**
 * Step 1: Session Information (04_mobile_specs §4.4 step 1; MB 3 (650–885, 140–470)).
 *
 * MB 3 order: Case Number (with the scan icon) · Subject Type (TERSANGKA / SAKSI / LAINNYA) ·
 * Subject Name · Investigator (search icon; defaults to the signed-in operator) · Room / Location ·
 * Recording Profile (web parity, not drawn in MB 3) · Notes (Optional). "Next" is the screen's
 * footer. Validation: react-hook-form with the shared `sessionCreateSchema` (D62); the schema's
 * messages are i18n keys (`sessionNew.info.*`). A field shows its error once it was left (blur),
 * so the operator is not told off while typing; "Next" stays disabled until the whole form is valid.
 *
 * Kit only (D6): `TextField` + `InputGroup` + `FieldError`, `TagGroup`, `Select` (+ `SearchField`),
 * `TextArea`. Subject-type colours come from tokens (MA-22), the terms from shared i18n (MA-21).
 */
import { Alert, Button, FieldError, InputGroup, Label, SearchField, Select, TagGroup, TextArea, TextField, Typography } from 'heroui-native';
import { ScanLine, Search } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Controller, type ControllerFieldState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { SESSION_INPUT_LIMITS } from '@dems/shared/api';
import { RECORDING_PROFILES, ROOMS, type SimOperator, type SubjectType } from '@dems/shared/sim';
import { derived, palette, spacing, statusSoft, toneHex, toneTextHex } from '@dems/shared/tokens';
import { SectionCard } from '@/components/kit';
import { SubjectTypeCodeTone } from '@/components/kit/subject-type-chip';
import { enterRise, triggerHaptic, useMotionSettings } from '@/motion';
import { useCoreLink } from '@/runtime';
import { filterInvestigators, SUBJECT_TYPE_ORDER, type SessionNewArrangement } from './session-new-model';
import type { CreateFailure, SessionForm } from './use-session-new';
import { SheetContentSignal, useSheetPresence } from './use-sheet-presence';

/** How long the long-press gloss line stays (D28/Q3). */
const GLOSS_MS = 3_000;
const ICON = 20;

export interface SessionInfoStepProps {
  form: SessionForm;
  /** Operators who may be the investigator (SESSION_START). */
  investigators: readonly SimOperator[];
  arrangement: SessionNewArrangement;
  onScan(): void;
  /** Why the last "Next" could not create the session, or null. */
  createError: CreateFailure | null;
}

export function SessionInfoStep({ form, investigators, arrangement, onScan, createError }: SessionInfoStepProps) {
  // react-hook-form hands out mutable objects: keep this component out of React Compiler
  // memoisation (F-70-1, the login card's precedent).
  'use no memo';
  const { t } = useTranslation();
  const settings = useMotionSettings();
  // Live mode names what the button does instead of "(simulated)" (row M1, W67 F-2; §3.2).
  const live = useCoreLink().source === 'LIVE';
  const twoColumns = arrangement === 'phone-landscape';
  const sheet = arrangement === 'phone' || arrangement === 'phone-landscape';

  const caseField = (
    <Controller
      control={form.control}
      name="caseNumber"
      render={({ field, fieldState }) => (
        <TextField isRequired isInvalid={shows(fieldState)}>
          <Label>{t('sessionNew.info.caseNumber.label')}</Label>
          <InputGroup>
            <InputGroup.Input
              testID="session-new-case-number"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('sessionNew.info.caseNumber.placeholder')}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={SESSION_INPUT_LIMITS.caseNumberLength}
              className="font-mono"
            />
            <InputGroup.Suffix>
              <Button
                testID="session-new-scan"
                isIconOnly
                variant="ghost"
                size="sm"
                hitSlop={8}
                accessibilityLabel={t(live ? 'sessionNew.live.scanCaseNumber' : 'sessionNew.info.caseNumber.scan')}
                onPress={onScan}
              >
                <ScanLine size={ICON} color={palette.gold} />
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
          <FieldError testID="session-new-case-number-error">{messageOf(fieldState, t)}</FieldError>
        </TextField>
      )}
    />
  );

  const subjectTypeField = (
    <Controller
      control={form.control}
      name="subjectType"
      render={({ field, fieldState }) => (
        <SubjectTypeTags
          value={field.value}
          invalid={shows(fieldState)}
          error={messageOf(fieldState, t)}
          onChange={(code) => {
            triggerHaptic('segmentSelect');
            field.onChange(code);
            field.onBlur();
          }}
        />
      )}
    />
  );

  const subjectNameField = (
    <Controller
      control={form.control}
      name="subjectName"
      render={({ field, fieldState }) => (
        <TextField isRequired isInvalid={shows(fieldState)}>
          <Label>{t('sessionNew.info.subjectName.label')}</Label>
          <InputGroup>
            <InputGroup.Input
              testID="session-new-subject-name"
              // Round two (JA2-36): a person's name is taken as typed - no autocorrect, no spelling underline.
              autoCorrect={false}
              spellCheck={false}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('sessionNew.info.subjectName.placeholder')}
              autoCapitalize="words"
              maxLength={SESSION_INPUT_LIMITS.subjectNameMax}
            />
          </InputGroup>
          <FieldError>{messageOf(fieldState, t)}</FieldError>
        </TextField>
      )}
    />
  );

  const investigatorField = (
    <Controller
      control={form.control}
      name="investigatorId"
      render={({ field, fieldState }) => (
        <InvestigatorSelect
          value={field.value}
          investigators={investigators}
          presentation={sheet ? 'bottom-sheet' : 'popover'}
          invalid={shows(fieldState)}
          error={messageOf(fieldState, t)}
          onChange={(id) => {
            field.onChange(id);
            field.onBlur();
          }}
        />
      )}
    />
  );

  const roomField = (
    <Controller
      control={form.control}
      name="room"
      render={({ field }) => (
        <FieldSelect
          testID="session-new-room"
          label={t('sessionNew.info.room.label')}
          value={field.value}
          options={ROOMS.map((room) => ({ value: room, label: room }))}
          onChange={field.onChange}
        />
      )}
    />
  );

  const profileField = (
    <Controller
      control={form.control}
      name="profileId"
      render={({ field }) => (
        <FieldSelect
          testID="session-new-profile"
          label={t('sessionNew.info.profile.label')}
          value={field.value}
          options={RECORDING_PROFILES.map((profile) => ({ value: profile.id, label: t('sessionNew.info.profile.standard') }))}
          onChange={field.onChange}
        />
      )}
    />
  );

  const notesField = (
    <Controller
      control={form.control}
      name="notes"
      render={({ field, fieldState }) => (
        <TextField isInvalid={Boolean(fieldState.error)}>
          <Label>{t('sessionNew.info.notes.label')}</Label>
          <TextArea
            testID="session-new-notes"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('sessionNew.info.notes.placeholder')}
            maxLength={SESSION_INPUT_LIMITS.notesMax}
            numberOfLines={3}
          />
          <FieldError>{messageOf(fieldState, t)}</FieldError>
        </TextField>
      )}
    />
  );

  // Fields stagger in 30 ms apart (03M M-PG-NEW step 1); reduced motion: a plain fade.
  const rise = (index: number, node: ReactNode, style?: ViewStyle) => (
    <Animated.View entering={enterRise(index, settings, { distance: 'riseSm' })} style={style}>
      {node}
    </Animated.View>
  );

  return (
    <SectionCard title={t('sessionNew.info.title')} testID="session-new-info">
      {createError ? (
        <Alert status="danger" testID="session-new-create-error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('features.session-new.create.failedTitle')}</Alert.Title>
            <Alert.Description>
              {t(createError === 'UNEXPECTED' ? 'features.session-new.create.unexpected' : `features.session-new.create.${createError}`)}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {twoColumns ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {rise(0, caseField)}
            {rise(1, subjectTypeField)}
            {rise(2, subjectNameField)}
          </View>
          <View style={styles.column}>
            {rise(3, investigatorField)}
            {rise(4, roomField)}
            {rise(5, profileField)}
            {rise(6, notesField)}
          </View>
        </View>
      ) : (
        <View style={styles.column}>
          {rise(0, caseField)}
          {rise(1, subjectTypeField)}
          {rise(2, subjectNameField)}
          {rise(3, investigatorField)}
          {rise(4, roomField)}
          {rise(5, profileField)}
          {rise(6, notesField)}
        </View>
      )}
    </SectionCard>
  );
}

/** A field shows its error once it was left, or while it holds text that is already wrong. */
function shows(state: ControllerFieldState): boolean {
  return Boolean(state.error) && (state.isTouched || state.isDirty);
}

function messageOf(state: ControllerFieldState, t: (key: string) => string): string {
  return shows(state) && state.error?.message ? t(state.error.message) : '';
}

// ---------------------------------------------------------------------------------------------
// Subject type: TagGroup (single) with the MB 3 tones; long-press shows the English gloss
// ---------------------------------------------------------------------------------------------

interface SubjectTypeTagsProps {
  value: SubjectType | undefined;
  invalid: boolean;
  error: string;
  onChange(code: SubjectType): void;
}

function SubjectTypeTags({ value, invalid, error, onChange }: SubjectTypeTagsProps) {
  const { t } = useTranslation();
  const [gloss, setGloss] = useState<SubjectType | null>(null);

  useEffect(() => {
    if (gloss === null) return undefined;
    const timer = setTimeout(() => setGloss(null), GLOSS_MS);
    return () => clearTimeout(timer);
  }, [gloss]);

  return (
    <View style={styles.fieldGap}>
      <Label isRequired isInvalid={invalid}>
        {t('sessionNew.info.subjectType.label')}
      </Label>
      <TagGroup
        selectionMode="single"
        size="lg"
        selectedKeys={value ? [value] : []}
        isRequired
        isInvalid={invalid}
        onSelectionChange={(keys) => {
          const [first] = [...keys];
          // Pressing the selected tag again keeps it (a subject type is required).
          if (typeof first === 'string' && first !== value) onChange(first as SubjectType);
        }}
        testID="session-new-subject-type"
      >
        <TagGroup.List style={styles.tags}>
          {SUBJECT_TYPE_ORDER.map((code) => {
            const selected = code === value;
            return (
              <TagGroup.Item
                key={code}
                id={code}
                testID={`session-new-subject-${code}`}
                accessibilityHint={t(`common.subjectTypeGloss.${code}`)}
                onLongPress={() => setGloss(code)}
                style={[styles.tag, selected ? tagSelectedStyle(code) : styles.tagIdle]}
              >
                <TagGroup.ItemLabel style={selected ? { color: tagTextColor(code) } : undefined}>
                  {t(`common.subjectType.${code}`)}
                </TagGroup.ItemLabel>
              </TagGroup.Item>
            );
          })}
        </TagGroup.List>
      </TagGroup>
      <Typography type="body-xs" color="muted" testID="session-new-subject-gloss">
        {gloss
          ? t('features.session-new.info.glossLine', {
              term: t(`common.subjectType.${gloss}`),
              gloss: t(`common.subjectTypeGloss.${gloss}`),
            })
          : t('features.session-new.info.subjectTypeHint')}
      </Typography>
      <FieldError isInvalid={invalid}>{error}</FieldError>
    </View>
  );
}

/** MB 3: TERSANGKA red, SAKSI blue, LAINNYA neutral (tokens only, MA-22). */
function tagSelectedStyle(code: SubjectType): ViewStyle {
  const tone = SubjectTypeCodeTone[code];
  if (tone === 'default') return { backgroundColor: derived.default, borderColor: palette.gray, borderWidth: 1 };
  return { backgroundColor: statusSoft[tone], borderColor: toneHex[tone], borderWidth: 1 };
}

function tagTextColor(code: SubjectType): string {
  const tone = SubjectTypeCodeTone[code];
  return tone === 'default' ? palette.foreground : toneTextHex[tone];
}

// ---------------------------------------------------------------------------------------------
// Investigator: Select with a SearchField (bottom sheet on phones, popover on tablets)
// ---------------------------------------------------------------------------------------------

interface InvestigatorSelectProps {
  value: string;
  investigators: readonly SimOperator[];
  presentation: 'bottom-sheet' | 'popover';
  invalid: boolean;
  error: string;
  onChange(id: string): void;
}

function InvestigatorSelect({ value, investigators, presentation, invalid, error, onChange }: InvestigatorSelectProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [requested, setRequested] = useState(false);
  // Mount on demand (F-79-2): the sheet or popover must see a closed → open transition of `isOpen`.
  const presence = useSheetPresence(requested, { awaitContent: presentation === 'bottom-sheet' });
  const selected = investigators.find((operator) => operator.id === value);
  const matches = filterInvestigators(investigators, query);

  const items = (
    <>
      <SearchField value={query} onChange={setQuery}>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input testID="session-new-investigator-search" placeholder={t('sessionNew.info.investigator.placeholder')} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      {matches.length === 0 ? (
        <Typography type="body-sm" color="muted" style={styles.empty}>
          {t('features.session-new.info.investigatorEmpty')}
        </Typography>
      ) : (
        matches.map((operator) => (
          <Select.Item
            key={operator.id}
            value={operator.id}
            label={operator.displayName}
            testID={`session-new-investigator-${operator.id}`}
          >
            <View style={styles.itemText}>
              <Select.ItemLabel />
              <Select.ItemDescription>{t(`common.roles.${operator.role}`)}</Select.ItemDescription>
            </View>
            <Select.ItemIndicator />
          </Select.Item>
        ))
      )}
    </>
  );

  return (
    <View style={styles.fieldGap}>
      <Label isRequired isInvalid={invalid}>
        {t('sessionNew.info.investigator.label')}
      </Label>
      <Select
        presentation={presentation}
        value={selected ? { value: selected.id, label: selected.displayName } : undefined}
        onValueChange={(option) => {
          if (option && !Array.isArray(option)) onChange(option.value);
          setQuery('');
          setRequested(false);
        }}
        isOpen={presence.open}
        onOpenChange={(next) => {
          setRequested(next);
          if (!next) setQuery('');
        }}
      >
        <Select.Trigger testID="session-new-investigator" accessibilityLabel={t('sessionNew.info.investigator.label')}>
          <Select.Value placeholder={t('sessionNew.info.investigator.placeholder')} />
          <Search size={ICON} color={palette.gold} />
        </Select.Trigger>
        {presence.mounted ? (
          <Select.Portal>
            <Select.Overlay />
            {presentation === 'bottom-sheet' ? (
              <Select.Content presentation="bottom-sheet" snapPoints={['50%']}>
                <SheetContentSignal onChange={presence.setContentMounted}>
                  <Select.ListLabel>{t('sessionNew.info.investigator.label')}</Select.ListLabel>
                  {items}
                </SheetContentSignal>
              </Select.Content>
            ) : (
              <Select.Content presentation="popover" width="trigger">
                {items}
              </Select.Content>
            )}
          </Select.Portal>
        ) : null}
      </Select>
      <FieldError isInvalid={invalid}>{error}</FieldError>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Room and Recording Profile: short popover Selects
// ---------------------------------------------------------------------------------------------

interface FieldSelectProps {
  testID: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange(value: string): void;
}

function FieldSelect({ testID, label, value, options, onChange }: FieldSelectProps) {
  const [requested, setRequested] = useState(false);
  const presence = useSheetPresence(requested, { awaitContent: false });
  const selected = options.find((option) => option.value === value) ?? { value, label: value };
  return (
    <View style={styles.fieldGap}>
      <Label>{label}</Label>
      <Select
        value={selected}
        onValueChange={(option) => {
          if (option && !Array.isArray(option)) onChange(option.value);
          setRequested(false);
        }}
        isOpen={presence.open}
        onOpenChange={setRequested}
      >
        <Select.Trigger testID={testID} accessibilityLabel={label}>
          <Select.Value placeholder={label} />
          <Select.TriggerIndicator />
        </Select.Trigger>
        {presence.mounted ? (
          <Select.Portal>
            <Select.Overlay />
            <Select.Content presentation="popover" width="trigger">
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} label={option.label} testID={`${testID}-${option.value}`} />
              ))}
            </Select.Content>
          </Select.Portal>
        ) : null}
      </Select>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: spacing[4] },
  column: { flex: 1, gap: spacing[3] },
  fieldGap: { gap: spacing[1] },
  tags: { flexDirection: 'row', gap: spacing[1] },
  tag: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 44 },
  tagIdle: { backgroundColor: derived.fieldBackground, borderColor: derived.fieldBorder, borderWidth: 1 },
  itemText: { flex: 1 },
  empty: { paddingVertical: spacing[2] },
});
