import { useState } from 'react'
import { Accordion, Alert, Button, Chip, Description, FieldError, Input, Label, ListBox, Radio, RadioGroup, Select, Spinner, Switch, TextField, toast } from '@heroui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { STT_BACKENDS, STT_CREDENTIAL_VALUE_MAX_LENGTH, STT_ENDPOINT_MAX_LENGTH, STT_MODEL_ID_MAX_LENGTH, SttAppliesFrom, SttBackend, SttConnectionDetailCode } from '@dems/shared/api'
import type { SttConfig, SttConfigUpdateResult, SttConnectionTest } from '@dems/shared/api'
import { settle, useCorePermission, useLiveSelector } from '@dems/shared/live'
import { useRetryCooldown } from '@dems/shared/realtime'
import { formatWibTime, Permission } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { retryCoreQuery, useQueryFailure } from '@/lib/core-queries'
import { usePendingControl } from '@/lib/pending-control'
import type { WebLive } from '@/runtime'
import { useSystemLiveMode } from './live'
import {
  STT_CONFIG_QUERY_KEY,
  sttCallFailureOf as callFailureOf,
  sttConfigQueryOptions,
  SttReadError,
  testSttConnection,
  updateSttConfig,
  useSttConfigGate,
} from './stt-config-queries'
import { logSystemError } from './log'
import {
  buildSttUpdate,
  classifySttSaveFailure,
  draftOf,
  EMPTY_STT_CREDENTIAL,
  hasSttErrors,
  isTranscriberNotReady,
  rolesHoldingPermission,
  STT_SECRET_FORM_OFFERED,
  sttChangedNames,
  SttCredentialEdit,
  sttDraftDiffers,
  SttSaveFailure,
  sttTestResultKey,
  validateSttDraft,
  type SttCallFailure,
  type SttCredentialDraft,
  type SttDraft,
  type SttFieldErrors,
} from './stt-config-model'

/** The permission of the two gated controls, G11 "Save" and G12 "Test connection" (ux §11). */
const STT_PERMISSION = Permission.CAPTURE_CONFIG

/** What a record of this section may say about a failed call: its status and code. Never a value of the form. */
const callFacts = (failure: SttCallFailure | null) => ({ status: failure?.status ?? null, code: failure?.error.code ?? null })

/** The stored configuration of an answer of operation 91, without `appliesFrom`. */
function storedOf(result: SttConfigUpdateResult): SttConfig {
  const { appliesFrom: _appliesFrom, ...config } = result
  return config
}

const STT_DETAIL_CODES = Object.values(SttConnectionDetailCode)

const Access = { CHECKING: 'checking', ALLOWED: 'allowed', REFUSED: 'refused' } as const
type Access = (typeof Access)[keyof typeof Access]

/**
 * Settings → Transcription (STT) (task 3 blueprint row 117; R-8; `08_client_ux_spec.md` §8a, flow 8;
 * `03_api_contract.md` §2.5).
 *
 * | Aspect | Behaviour |
 * |--------|-----------|
 * | Read | Operation 90 through `sttConfigQueryOptions` (`lib/core-queries.ts`): on every entry of the section and after a save. No slice carries it |
 * | Gate (G11 Save, G12 Test connection) | `CAPTURE_CONFIG`. Until the session's role is known, the link is up and the configuration has been read: **"Checking your permissions…"** and every control disabled — never hidden, never enabled at once. Then either enabled, or disabled with the reason ("Requires the … role") |
 * | Save | Operation 91 with `revision` (of the configuration the edit started from) and the changed members only. `model` is trimmed and checked with the shared `isSttModelId` first |
 * | Applies | `appliesFrom: NEXT_SESSION` → the banner "Saved — applies to the next session"; `pendingForNextSession` keeps a note while it waits |
 * | Refusals | 409 `REVISION_CONFLICT` → reload prompt; 422 `ENDPOINT_NOT_LOOPBACK` → the field's message; 503 `CREDENTIAL_STORE_NOT_READY` → said plainly next to the credential (not "the Core server is starting"); everything else → the shared presenter, then the section's own words |
 * | Test connection | Operation 92 on the STORED configuration (disabled while the form differs from it). `reachable: false` is an inline result, not a toast. 503 `TRANSCRIBER_NOT_READY` is an inline notice |
 * | Credential | Write-only. The field is opened by the operator, starts empty every time, is emptied when the save is sent (whatever the answer), when it is closed and when the section is closed (it unmounts). The Core returns "set / not set" and the kind only. The typed text is never rendered elsewhere, logged, cached or put in an error |
 * | Simulated mode | A one-line note: the configuration is the Core server's |
 */
export function SttConfigSection() {
  const { t } = useTranslation()
  const live = useSystemLiveMode()
  if (!live) {
    return (
      <p className="sys-muted sys-small" data-testid="stt-live-only">
        {t('system.stt.liveOnly')}
      </p>
    )
  }
  return <SttConfigLive />
}

/** The item's key in the Settings accordion. */
export const STT_SETTINGS_ITEM_ID = 'transcription'

/**
 * The whole "Transcription (STT)" item of the Settings accordion, so the panel mounts it with one
 * import and one line (`<SttSettingsItem />`, decision D95). The markup and class names are those
 * of the panel's own `Item`. The section is mounted only while the item is open: closing the item
 * unmounts it, which drops the form state and the write-only credential field with it (ux §8a
 * "Secrecy": cleared on close), and opening it reads operation 90 again (C3 §2.5 "Slice").
 */
export function SttSettingsItem() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Accordion.Item id={STT_SETTINGS_ITEM_ID} className="sys-acc-item" data-testid={`system-settings-${STT_SETTINGS_ITEM_ID}`} onExpandedChange={setOpen}>
      <Accordion.Heading>
        <Accordion.Trigger className="sys-acc-trigger">
          <span className="sys-acc-title">
            <Mic className="sys-acc-icon" aria-hidden="true" strokeWidth={1.75} />
            <span>{t('system.stt.title')}</span>
          </span>
          <Accordion.Indicator className="sys-acc-indicator" />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body className="sys-acc-body">{open ? <SttConfigSection /> : null}</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  )
}

function SttConfigLive() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const gate = useSttConfigGate()
  const live = gate.live
  const query = useQuery(sttConfigQueryOptions(gate))
  const presentCoreError = useCoreErrorPresenter()
  const sessionKnown = useLiveSelector((source: WebLive | null) => source !== null && source.session != null)
  const permitted = useCorePermission(STT_PERMISSION)
  const { run: runSave, busy: saveBusy, pending: savePending, ref: saveRef } = usePendingControl()
  const { run: runTest, busy: testBusy, pending: testPending, ref: testRef } = usePendingControl()

  /** The edit in progress: the configuration it started from (its `revision` is the optimistic lock) and the values. */
  const [edit, setEdit] = useState<{ readonly base: SttConfig; readonly values: SttDraft } | null>(null)
  /** Write-only: starts empty at every mount, emptied when a save is sent and on close. Never initialised from anything. */
  const [credential, setCredential] = useState<SttCredentialDraft>(EMPTY_STT_CREDENTIAL)
  const [fieldErrors, setFieldErrors] = useState<SttFieldErrors>({})
  const [conflict, setConflict] = useState(false)
  const [storeNotReady, setStoreNotReady] = useState(false)
  const [savedFor, setSavedFor] = useState<SttAppliesFrom | null>(null)
  const [tested, setTested] = useState<SttConnectionTest | null>(null)
  const [testNotReady, setTestNotReady] = useState(false)

  const config = query.data
  const access: Access = !sessionKnown || !gate.enabled || (config === undefined && !query.isError) ? Access.CHECKING : permitted ? Access.ALLOWED : Access.REFUSED
  // G81-03: every role the access rule admits ("Supervisor / Technician"), as the storage policy drawer words the same permission.
  const admittedRoles = rolesHoldingPermission(STT_PERMISSION)
  const refusedReason = admittedRoles.length === 0 ? t('common.rbac.deniedTitle') : t('common.rbac.requiresRole', { role: admittedRoles.map((role) => t(`common.roles.${role}`)).join(' / ') })

  // A failed read: the shared presenter first (an outage, a limit), then this section's own record.
  useQueryFailure(query, (error) => {
    const failure = error instanceof SttReadError ? error.failure : null
    if (failure !== null && presentCoreError(failure) !== null) return
    logSystemError('SttConfig.read', error, { operationId: 'getSttConfig', ...callFacts(failure) }, 'warn')
  })
  const reread = () => retryCoreQuery(queryClient, STT_CONFIG_QUERY_KEY)
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(reread)

  const base = edit?.base ?? config
  const values = edit?.values ?? (config === undefined ? null : draftOf(config))
  const locked = access !== Access.ALLOWED || saveBusy
  const dirty = base !== undefined && values !== null && (sttDraftDiffers(base, values) || credential.edit !== SttCredentialEdit.KEEP)

  const change = (patch: Partial<SttDraft>) => {
    if (base === undefined || values === null) return
    setEdit({ base, values: { ...values, ...patch } })
    setSavedFor(null)
    if (patch.endpoint !== undefined || patch.backend !== undefined) setFieldErrors(({ endpoint: _endpoint, ...rest }) => rest)
    if (patch.model !== undefined) setFieldErrors(({ model: _model, ...rest }) => rest)
  }

  const setCredentialDraft = (next: SttCredentialDraft) => {
    setCredential(next)
    setStoreNotReady(false)
    setSavedFor(null)
    setFieldErrors(({ credential: _credential, ...rest }) => rest)
  }

  const reload = () => {
    setEdit(null)
    setCredential(EMPTY_STT_CREDENTIAL)
    setFieldErrors({})
    setConflict(false)
    setStoreNotReady(false)
    reread()
  }

  const save = () => {
    if (live === null || base === undefined || values === null || access !== Access.ALLOWED) return
    // The result names fields and message keys only: it holds no typed value, and it is not logged.
    const errors = validateSttDraft(values, credential)
    setFieldErrors(errors)
    if (hasSttErrors(errors)) return
    const body = buildSttUpdate(base, values, credential)
    if (body === null) {
      toast.info(t('system.stt.nothingToSave'))
      return
    }
    const changed = sttChangedNames(body)
    setConflict(false)
    setStoreNotReady(false)
    setSavedFor(null)
    // Sent once: the typed credential leaves the form state with this press, whatever the Core answers (ux §8a "Secrecy").
    setCredential(EMPTY_STT_CREDENTIAL)
    runSave((release) =>
      settle(() => updateSttConfig(live, body), {
        ok: (result) => {
          queryClient.setQueryData<SttConfig>(STT_CONFIG_QUERY_KEY, storedOf(result))
          setEdit(null)
          setTested(null)
          setSavedFor(result.appliesFrom)
          if (result.appliesFrom === SttAppliesFrom.NOW) toast.success(t('system.stt.saved'))
          // Clients re-read operation 90 after 91 (C3 §2.5 "Slice").
          void queryClient.invalidateQueries({ queryKey: STT_CONFIG_QUERY_KEY, exact: true })
        },
        fail: (error) => {
          const failure = callFailureOf(error)
          switch (classifySttSaveFailure(failure)) {
            case SttSaveFailure.CONFLICT:
              setConflict(true)
              return
            case SttSaveFailure.ENDPOINT_NOT_LOOPBACK:
              setFieldErrors({ endpoint: 'endpointNotLoopback' })
              return
            case SttSaveFailure.CREDENTIAL_STORE_NOT_READY:
              setStoreNotReady(true)
              return
            case SttSaveFailure.REFUSED:
              logSystemError('SttConfig.save', error, { operationId: 'updateSttConfig', changed, ...callFacts(failure) }, 'warn')
              toast.danger(t('system.stt.saveRefused'))
              return
            default:
              if (presentCoreError(error, { permission: STT_PERMISSION }) !== null) return
              logSystemError('SttConfig.save', error, { operationId: 'updateSttConfig', changed, ...callFacts(failure) })
              toast.danger(t('system.stt.saveFailed'))
          }
        },
        done: release,
      }),
    )
  }

  const test = () => {
    if (live === null || access !== Access.ALLOWED || dirty) return
    setTestNotReady(false)
    runTest((release) =>
      settle(() => testSttConnection(live), {
        ok: (result) => {
          setTested(result)
          void queryClient.invalidateQueries({ queryKey: STT_CONFIG_QUERY_KEY, exact: true })
        },
        fail: (error) => {
          const failure = callFailureOf(error)
          if (isTranscriberNotReady(failure)) {
            setTested(null)
            setTestNotReady(true)
            return
          }
          if (presentCoreError(error, { permission: STT_PERMISSION }) !== null) return
          logSystemError('SttConfig.test', error, { operationId: 'testSttConnection', ...callFacts(failure) })
          toast.danger(t('system.stt.testFailed'))
        },
        done: release,
      }),
    )
  }

  const lastTest = tested ?? config?.lastTest ?? null
  // A closed set: a code this build does not know gets no sentence (never the answer's own text).
  const testedDetail = tested === null ? undefined : STT_DETAIL_CODES.find((code) => code === tested.detailCode)

  return (
    <div className="flex flex-col gap-3" data-testid="stt-config" data-access={access}>
      <p className="sys-muted sys-small">{t('system.stt.lead')}</p>

      <p className="sys-small flex items-center gap-2" role="status" data-testid="stt-access">
        {access === Access.CHECKING ? (
          <>
            <Spinner size="sm" color="current" />
            <span>{t('system.stt.checking')}</span>
          </>
        ) : access === Access.REFUSED ? (
          <span className="sys-muted">{t('system.stt.readOnly', { reason: refusedReason })}</span>
        ) : null}
      </p>

      {query.isError && config === undefined ? (
        <Alert status="danger" data-testid="stt-load-error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('system.stt.loadFailed')}</Alert.Title>
          </Alert.Content>
          <Button size="sm" variant="outline" onPress={retry} isDisabled={!canRetry || !gate.enabled} data-testid="stt-load-retry">
            {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
          </Button>
        </Alert>
      ) : null}

      {config !== undefined && config.pendingForNextSession && savedFor !== SttAppliesFrom.NEXT_SESSION ? (
        <Alert status="accent" data-testid="stt-pending-next">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('system.stt.pendingNextSession')}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {savedFor === SttAppliesFrom.NEXT_SESSION ? (
        <Alert status="success" data-testid="stt-saved-next">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('system.stt.savedNextSession')}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {conflict ? (
        <Alert status="warning" data-testid="stt-conflict">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('system.stt.conflict')}</Alert.Title>
          </Alert.Content>
          <Button size="sm" variant="outline" onPress={reload} data-testid="stt-reload">
            {t('system.stt.reload')}
          </Button>
        </Alert>
      ) : null}

      {config !== undefined && values !== null ? (
        <>
          <Switch isSelected={values.enabled} onChange={(on) => change({ enabled: on })} isDisabled={locked} className="sys-setting" data-testid="stt-enabled">
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label>{t('system.stt.enabled')}</Label>
            </Switch.Content>
            <Description>{t('system.stt.enabledHint')}</Description>
          </Switch>

          <Select
            value={values.backend}
            onChange={(key) => {
              const chosen = STT_BACKENDS.find((backend) => backend === key)
              if (chosen !== undefined) change({ backend: chosen })
            }}
            isDisabled={locked}
            className="sys-setting"
            data-testid="stt-backend"
          >
            <Label>{t('system.stt.backend')}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {STT_BACKENDS.map((backend) => (
                  <ListBox.Item key={backend} id={backend} textValue={t(`system.stt.backends.${backend}`)}>
                    {t(`system.stt.backends.${backend}`)}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          {values.backend === SttBackend.OMLX_SERVER ? (
            <TextField
              value={values.endpoint}
              onChange={(text) => change({ endpoint: text })}
              isDisabled={locked}
              isInvalid={fieldErrors.endpoint !== undefined}
              validationBehavior="aria"
              maxLength={STT_ENDPOINT_MAX_LENGTH}
              autoComplete="off"
              className="sys-setting"
              name="stt-endpoint"
            >
              <Label>{t('system.stt.endpoint')}</Label>
              <Input spellCheck={false} autoCapitalize="none" autoCorrect="off" data-testid="stt-endpoint" />
              <Description>{t('system.stt.endpointHint')}</Description>
              {fieldErrors.endpoint !== undefined ? <FieldError data-testid="stt-endpoint-error">{t(`system.stt.${fieldErrors.endpoint}`)}</FieldError> : null}
            </TextField>
          ) : null}

          <TextField
            value={values.model}
            onChange={(text) => change({ model: text })}
            isDisabled={locked}
            isInvalid={fieldErrors.model !== undefined}
            validationBehavior="aria"
            // Room for white space around the identifier: it is trimmed before the check and the send.
            maxLength={STT_MODEL_ID_MAX_LENGTH + 32}
            autoComplete="off"
            className="sys-setting"
            name="stt-model"
          >
            <Label>{t('system.stt.model')}</Label>
            <Input spellCheck={false} autoCapitalize="none" autoCorrect="off" data-testid="stt-model" />
            <Description>{t('system.stt.modelHint')}</Description>
            {fieldErrors.model !== undefined ? <FieldError data-testid="stt-model-error">{t(`system.stt.${fieldErrors.model}`)}</FieldError> : null}
          </TextField>

          <div className="sys-setting-line" data-testid="stt-language">
            <span className="sys-label">{t('system.stt.language')}</span>
            <span>{t('system.stt.languageValue')}</span>
          </div>

          <Switch isSelected={values.diarization} onChange={(on) => change({ diarization: on })} isDisabled={locked} className="sys-setting" data-testid="stt-diarization">
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label>{t('system.stt.diarization')}</Label>
            </Switch.Content>
            <Description>{t('system.stt.diarizationHint')}</Description>
          </Switch>

          <CredentialEditor
            config={config}
            credential={credential}
            onChange={setCredentialDraft}
            isDisabled={locked}
            error={fieldErrors.credential}
            storeNotReady={storeNotReady}
          />

          <div className="sys-setting-line" data-testid="stt-last-test">
            <span className="sys-label">{t('system.stt.lastTest')}</span>
            {lastTest === null ? (
              <span className="sys-muted">{t('system.stt.lastTestNone')}</span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <Chip size="sm" variant="soft" color={!lastTest.reachable ? 'danger' : lastTest.modelAvailable ? 'success' : 'warning'} data-testid="stt-test-result">
                  <Chip.Label>{t(`system.stt.testResult.${sttTestResultKey(lastTest)}`)}</Chip.Label>
                </Chip>
                {tested !== null ? (
                  testedDetail === undefined ? null : (
                    <span className="sys-muted sys-small" data-testid="stt-test-detail">
                      {t(`system.stt.testDetail.${testedDetail}`)}
                    </span>
                  )
                ) : config.lastTest !== undefined ? (
                  <span className="sys-muted sys-small sys-mono">{t('system.stt.lastTestAt', { time: formatWibTime(config.lastTest.testedAt) })}</span>
                ) : null}
              </span>
            )}
          </div>

          {testNotReady ? (
            <Alert status="warning" data-testid="stt-test-not-ready">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('system.stt.testNotReady')}</Alert.Title>
              </Alert.Content>
            </Alert>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          ref={saveRef}
          size="sm"
          variant="primary"
          onPress={save}
          isDisabled={access !== Access.ALLOWED || config === undefined || conflict}
          isPending={savePending}
          data-busy={saveBusy || undefined}
          data-testid="stt-save"
        >
          {savePending ? <Spinner size="sm" color="current" /> : null}
          {t('system.stt.save')}
        </Button>
        <Button
          ref={testRef}
          size="sm"
          variant="outline"
          onPress={test}
          isDisabled={access !== Access.ALLOWED || config === undefined || dirty || saveBusy}
          isPending={testPending}
          data-busy={testBusy || undefined}
          data-testid="stt-test"
        >
          {testPending ? <Spinner size="sm" color="current" /> : null}
          {t('system.stt.test')}
        </Button>
        <span className="sys-muted sys-small" data-testid="stt-test-hint">
          {access === Access.ALLOWED && dirty ? t('system.stt.testUnsaved') : t('system.stt.testHint')}
        </span>
      </div>
    </div>
  )
}

interface CredentialEditorProps {
  config: SttConfig
  credential: SttCredentialDraft
  onChange: (next: SttCredentialDraft) => void
  isDisabled: boolean
  error: SttFieldErrors['credential']
  storeNotReady: boolean
}

/**
 * The credential of the server backend: its state ("Set" with the kind, or "Not set") and the
 * write-only field. The field exists only after the operator opened it and is empty when it opens;
 * `value` is the form state of this press alone. Nothing here reads a stored credential: none exists
 * on the client. The REFERENCE form is offered; the SECRET form is offered when
 * `STT_SECRET_FORM_OFFERED` is on (blueprint row 84).
 */
function CredentialEditor({ config, credential, onChange, isDisabled, error, storeNotReady }: CredentialEditorProps) {
  const { t } = useTranslation()
  const open = credential.edit === SttCredentialEdit.REFERENCE || credential.edit === SttCredentialEdit.SECRET
  const secret = credential.edit === SttCredentialEdit.SECRET
  const close = () => onChange(EMPTY_STT_CREDENTIAL)

  return (
    <div className="flex flex-col gap-2" data-testid="stt-credential">
      <div className="sys-setting-line">
        <span className="sys-label">{t('system.stt.credential')}</span>
        <span data-testid="stt-credential-state" data-set={config.credentialSet}>
          {config.credentialSet
            ? `${t('system.stt.credentialSet')}${config.credentialKind === undefined ? '' : ` · ${t(`system.stt.credentialKinds.${config.credentialKind}`)}`}`
            : t('system.stt.credentialNotSet')}
        </span>
      </div>

      {credential.edit === SttCredentialEdit.KEEP ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" isDisabled={isDisabled} onPress={() => onChange({ edit: SttCredentialEdit.REFERENCE, text: '' })} data-testid="stt-credential-change">
            {t('system.stt.credentialChange')}
          </Button>
          {config.credentialSet ? (
            <Button size="sm" variant="ghost" isDisabled={isDisabled} onPress={() => onChange({ edit: SttCredentialEdit.CLEAR, text: '' })} data-testid="stt-credential-remove">
              {t('system.stt.credentialRemove')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {credential.edit === SttCredentialEdit.CLEAR ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="sys-small" data-testid="stt-credential-remove-pending">
            {t('system.stt.credentialRemovePending')}
          </span>
          <Button size="sm" variant="ghost" isDisabled={isDisabled} onPress={close} data-testid="stt-credential-close">
            {t('common.actions.cancel')}
          </Button>
        </div>
      ) : null}

      {open ? (
        <>
          {STT_SECRET_FORM_OFFERED ? (
            <RadioGroup
              value={credential.edit}
              // Changing the form empties the field: a typed secret is never carried into the reference field.
              onChange={(kind) => onChange({ edit: kind === SttCredentialEdit.SECRET ? SttCredentialEdit.SECRET : SttCredentialEdit.REFERENCE, text: '' })}
              orientation="horizontal"
              isDisabled={isDisabled}
              className="sys-setting"
              aria-label={t('system.stt.credential')}
              data-testid="stt-credential-kind"
            >
              <Radio value={SttCredentialEdit.REFERENCE}>
                <Radio.Content>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <Label>{t('system.stt.credentialRef')}</Label>
                </Radio.Content>
              </Radio>
              <Radio value={SttCredentialEdit.SECRET}>
                <Radio.Content>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <Label>{t('system.stt.credentialSecret')}</Label>
                </Radio.Content>
              </Radio>
            </RadioGroup>
          ) : null}
          <TextField
            // A new field per form, so no text survives a change of the form in the DOM either.
            key={credential.edit}
            type={secret ? 'password' : 'text'}
            value={credential.text}
            onChange={(text) => onChange({ edit: credential.edit, text })}
            isDisabled={isDisabled}
            isInvalid={error !== undefined}
            validationBehavior="aria"
            maxLength={STT_CREDENTIAL_VALUE_MAX_LENGTH}
            autoComplete="off"
            className="sys-setting"
            name="stt-credential"
          >
            <Label>{secret ? t('system.stt.credentialSecret') : t('system.stt.credentialRef')}</Label>
            <Input spellCheck={false} autoCapitalize="none" autoCorrect="off" data-testid="stt-credential-input" />
            <Description>{secret ? t('system.stt.credentialSecretHint') : t('system.stt.credentialRefHint')}</Description>
            {error !== undefined ? <FieldError data-testid="stt-credential-error">{t(`system.stt.${error}`)}</FieldError> : null}
          </TextField>
          <div>
            <Button size="sm" variant="ghost" isDisabled={isDisabled} onPress={close} data-testid="stt-credential-close">
              {t('system.stt.credentialClose')}
            </Button>
          </div>
        </>
      ) : null}

      {storeNotReady ? (
        <Alert status="warning" data-testid="stt-credential-store-not-ready">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('system.stt.credentialStoreNotReady')}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
    </div>
  )
}
