/**
 * The commissioning screen of the camera network, `/admin/commissioning` (task 4, blueprint row
 * 112, package M10; contract `implementation/102_commissioning_contract.md`, operations 101 to 105;
 * decisions U6, U7, U9, U10). The export name `CommissioningPage` is imported by
 * `routes/_app/admin/commissioning.tsx`; the root carries `data-testid="page-commissioning"`.
 *
 * | Who | What the page shows |
 * |-----|---------------------|
 * | The role is not resolved yet | The header and "Checking your permissions..."; nothing is requested |
 * | A role without `CAPTURE_COMMISSION` (decision U10: TECHNICIAN only) | The header and the role sentence. NO setting, NO scan control, NO address state, and no request. In Live mode the route guard has already sent such an operator to the Dashboard and the sidebar holds no entry |
 * | TECHNICIAN | The three panels: the network settings (operations 101, 102), the factory address scan (103), the temporary host address (104, 105) |
 *
 * WHAT NEEDS PRODUCTION CAPTURE OPERATION. Every write (saving the settings, a scan, removing the
 * temporary address) is carried out by a Core in production capture operation only; any other Core
 * refuses it (`409 COMMISSIONING_NOT_AVAILABLE`) and nothing changes. The console has no operation
 * that names the Core's capture operation, so the screen says the rule ALWAYS, and once the Core
 * has answered with that reason it says that THIS Core is not in it. In Simulated mode it also says
 * that every answer on the screen is a synthetic answer of the in-app simulator.
 *
 * NOTHING SCANS BY ITSELF (decision U9). The scan is one request on one press; opening the page
 * reads the configuration and the address state and asks no address.
 *
 * TWO MORE PANELS, each in a file of its own: the set-IP screens (blueprint row 113, `set-ip.tsx`:
 * the set-network job with its typed camera account, started from a row of the scan result) and
 * the installation acceptance with its revocation (row 118, `acceptance.tsx`). This file builds,
 * sends and holds no credential. The panel card, its error boundary and the refusal hooks are in
 * `parts.tsx` and `refusal.ts`.
 *
 * Kit: `@heroui/react` (Card, Alert, TextField, TextArea, Table, Button, Chip, Skeleton),
 * react-hook-form with the zod resolver for the settings form, and TanStack Query for the two reads.
 */
import { useState, type FormEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Chip, Description, FieldError, Input, Label, Skeleton, Spinner, Table, TextArea, TextField, toast } from '@heroui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Network, Radar, Route as RouteIcon, SlidersHorizontal } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  CAPTURE_NETWORK_CONFIG_LIMITS,
  HOST_ALIAS_HELPER,
  type CameraFactoryScan,
  type CaptureNetworkConfig,
  type FactoryCamera,
  type HostAliasState,
} from '@dems/shared/api'
import { useCorePermission } from '@dems/shared/live'
import { formatClock } from '@dems/shared/realtime'
import { OperatorRole, Permission, selectCan, useSim, useSimInstance } from '@dems/shared/sim'
import { PageHeader } from '@/components/shell/page-header'
import { retryCoreQuery, useCaptureReadGate } from '@/lib/core-queries'
import { usePendingControl } from '@/lib/pending-control'
import { AcceptancePanel } from './acceptance'
import {
  formValuesOf,
  isNotProduction,
  networkSettingsFormSchema,
  readHostAlias,
  readNetworkConfig,
  removeHostAlias,
  scanFactoryCameras,
  settingsChangeOf,
  typedScanAddressOf,
  updateNetworkConfig,
  type CommissioningAnswer,
  type CommissioningFailure,
  type CommissioningRefusal,
  type CommissioningTarget,
  type NetworkSettingsFormValues,
} from './model'
import { scanConflict, scanCountNotKnown } from './set-ip-model'
import { Panel, ReadFailed, RefusalAlert } from './parts'
import { useRefused } from './refusal'
import { COMMISSIONING_RECORD, reportCommissioningError } from './report'
import { SetIpPanel } from './set-ip'
import './commissioning.css'

// ── Access ───────────────────────────────────────────────────────────────────────────────

interface Access {
  readonly target: CommissioningTarget
  /** The role (and in Live mode the link) is known: the page may leave "Checking". */
  readonly resolved: boolean
  readonly can: boolean
}

/** The permission of the signed-in operator: the Core's list in Live mode, the simulator's table otherwise. A hint - the Core decides every call. */
function useAccess(): Access {
  const gate = useCaptureReadGate()
  const sim = useSimInstance()
  const core = useCorePermission(Permission.CAPTURE_COMMISSION)
  const simulated = useSim((state) => selectCan(state, Permission.CAPTURE_COMMISSION))
  const live = gate.live !== null
  return { target: { live: gate.live, sim }, resolved: live ? gate.enabled : true, can: live ? core : simulated }
}

/** A read that was refused or not answered, as the query's error. */
class CommissioningReadError extends Error {
  readonly failure: CommissioningFailure
  constructor(failure: CommissioningFailure) {
    super(`The read ${failure.operationId} was not answered with data.`)
    this.name = 'CommissioningReadError'
    this.failure = failure
  }
}

async function dataOf<T>(answer: Promise<CommissioningAnswer<T>>): Promise<T> {
  const settled = await answer
  if (!settled.ok) throw new CommissioningReadError(settled)
  return settled.data
}

const modeOf = (target: CommissioningTarget): 'live' | 'simulated' => (target.live === null ? 'simulated' : 'live')
const configKey = (target: CommissioningTarget) => ['commissioning', 'networkConfig', modeOf(target)] as const
const aliasKey = (target: CommissioningTarget) => ['commissioning', 'hostAlias', modeOf(target)] as const

// The refusal hooks are in `refusal.ts`, the panel card, its error boundary, the retry and the
// refusal alert in `parts.tsx` (moved there by row 113, unchanged, for the set-IP and the
// acceptance panel).

// ── The page ─────────────────────────────────────────────────────────────────────────────

export function CommissioningPage() {
  const { t } = useTranslation()
  const access = useAccess()
  return (
    <div className="dems-page com-page" data-testid="page-commissioning" data-mode={modeOf(access.target)}>
      <PageHeader icon={Network} title={t('web.commissioning.title')} subtitle={t('web.commissioning.subtitle')} />
      {!access.resolved ? (
        <p className="com-text" role="status" data-testid="com-checking">
          {t('web.commissioning.checking')}
        </p>
      ) : !access.can ? (
        // Decision U10: nothing of the screen is drawn for another role, and nothing is requested.
        <Alert status="warning" data-testid="com-forbidden">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('common.rbac.requiresRole', { role: t(`common.roles.${OperatorRole.TECHNICIAN}`).toUpperCase() })}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : (
        <CommissioningBody target={access.target} />
      )}
    </div>
  )
}

function CommissioningBody({ target }: { target: CommissioningTarget }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  /** True once the Core answered a write with `COMMISSIONING_NOT_AVAILABLE`: said until the page is left. */
  const [notProduction, setNotProduction] = useState(false)
  const config = useQuery({ queryKey: configKey(target), queryFn: () => dataOf(readNetworkConfig(target)), retry: false, refetchOnWindowFocus: false })
  const alias = useQuery({ queryKey: aliasKey(target), queryFn: () => dataOf(readHostAlias(target)), retry: false, refetchOnWindowFocus: false })
  const noted = (refusal: CommissioningRefusal) => {
    if (isNotProduction(refusal)) setNotProduction(true)
  }
  /**
   * Row 113: the camera of the LAST scan the technician chose for an address change, and whether a
   * job of this page runs. In memory only, as the scan result itself (never a URL, never storage).
   * A new scan drops the choice: the Core takes `fromAddress` from its last scan only.
   */
  const [picked, setPicked] = useState<FactoryCamera | null>(null)
  const [jobRunning, setJobRunning] = useState(false)
  const setAlias = (state: HostAliasState) => queryClient.setQueryData<HostAliasState>(aliasKey(target), state)
  // A read is asked again through the key (`retryCoreQuery`): only a mounted, enabled observer is refetched.
  const readConfig = () => retryCoreQuery(queryClient, configKey(target))
  const readAlias = () => retryCoreQuery(queryClient, aliasKey(target))

  return (
    <>
      <div className="com-notices">
        {target.live === null ? (
          <Alert status="accent" data-testid="com-simulated">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('web.commissioning.simulated')}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}
        {notProduction ? (
          <Alert status="warning" role="status" data-testid="com-not-production">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('web.commissioning.notProduction')}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}
        <p className="com-text" data-testid="com-production-only">
          {t('web.commissioning.productionOnly')}
        </p>
      </div>
      <div className="com-grid">
        <Panel id="settings" icon={SlidersHorizontal} title={t('web.commissioning.settings.title')}>
          {config.data !== undefined ? (
            <SettingsForm
              target={target}
              config={config.data}
              onRefused={noted}
              onStored={(stored) => queryClient.setQueryData<CaptureNetworkConfig>(configKey(target), stored)}
              onStale={readConfig}
            />
          ) : config.isError ? (
            <ReadFailed sentence={t('web.commissioning.readFailed')} onRetry={readConfig} testId="com-config-failed" />
          ) : (
            <Skeleton className="h-40 w-full rounded-lg" data-testid="com-config-loading" />
          )}
        </Panel>
        <ScanPanel
          target={target}
          onRefused={noted}
          onAlias={(found) => setAlias({ alias: found })}
          onScanned={() => setPicked(null)}
          pickedAddress={picked?.address ?? null}
          pickDisabled={jobRunning}
          onPick={setPicked}
        />
        <AliasPanel target={target} state={alias.data} failed={alias.isError} onRefused={noted} onState={setAlias} onRead={readAlias} />
        {/* Row 113: the set-IP screens. A refusal of a job is NOT handed to `noted`: "not available" there may also be a production Core without its host inputs. */}
        <SetIpPanel target={target} picked={picked} onClose={() => setPicked(null)} onRunning={setJobRunning} onJobEnded={readAlias} />
        {/* Row 118: the installation acceptance and its revocation. */}
        <AcceptancePanel target={target} />
      </div>
    </>
  )
}

// ── Settings (operations 101 and 102) ────────────────────────────────────────────────────

const L = CAPTURE_NETWORK_CONFIG_LIMITS
const NUMBER_FIELDS = [
  { name: 'aliasHost', min: L.aliasHostMin, max: L.aliasHostMax },
  { name: 'aliasMinutes', min: L.aliasMinutesMin, max: L.aliasMinutesMax },
  { name: 'cameraIpStart', min: L.cameraIpStartMin, max: L.cameraIpStartMax },
] as const

function SettingsForm({
  target,
  config,
  onRefused,
  onStored,
  onStale,
}: {
  target: CommissioningTarget
  config: CaptureNetworkConfig
  onRefused: (refusal: CommissioningRefusal) => void
  onStored: (config: CaptureNetworkConfig) => void
  onStale: () => void
}) {
  const { t } = useTranslation()
  const refused = useRefused()
  const save = usePendingControl()
  const { ref: saveRef } = save
  const [refusal, setRefusal] = useState<CommissioningRefusal | null>(null)
  const [unchanged, setUnchanged] = useState(false)
  // `values`: the form follows the configuration the Core answered (after a save, after a conflict).
  const form = useForm<NetworkSettingsFormValues>({ resolver: zodResolver(networkSettingsFormSchema), mode: 'onTouched', values: formValuesOf(config) })

  const onValid = (values: NetworkSettingsFormValues) => {
    const body = settingsChangeOf(values, config)
    setRefusal(null)
    if (body === null) {
      // Nothing differs from the stored row: nothing leaves the page.
      setUnchanged(true)
      return
    }
    setUnchanged(false)
    save.run((release) => {
      void updateNetworkConfig(target, body)
        .then((answer) => {
          if (answer.ok) {
            onStored(answer.data)
            toast.success(t('web.commissioning.settings.saved'))
            return
          }
          const kind = refused(answer)
          setRefusal(kind)
          onRefused(kind)
          if (kind.kind === 'REVISION_CONFLICT') onStale()
        })
        .catch((error: unknown) => {
          reportCommissioningError('features/commissioning.settings', error, COMMISSIONING_RECORD.threw, { operationId: 'updateCaptureNetworkConfig' })
          setRefusal({ kind: 'OTHER' })
        })
        .finally(release)
    })
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void form.handleSubmit(onValid)()
  }

  return (
    <form className="com-form" onSubmit={onSubmit} noValidate data-testid="com-settings-form" data-revision={config.revision} data-configured={config.configured ? 'true' : 'false'}>
      {config.configured ? null : (
        <Alert status="warning" data-testid="com-not-configured">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('web.commissioning.settings.notConfigured')}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      {(['interfaceName', 'cameraSubnet'] as const).map((name) => (
        <Controller
          key={name}
          control={form.control}
          name={name}
          render={({ field, fieldState }) => (
            <TextField name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={fieldState.invalid} isDisabled={save.busy}>
              <Label>{t(`web.commissioning.settings.${name}.label`)}</Label>
              <Input ref={field.ref} className="font-mono" autoComplete="off" autoCapitalize="off" spellCheck={false} data-testid={`com-field-${name}`} />
              {fieldState.invalid ? (
                <FieldError data-testid={`com-error-${name}`}>{t(`web.commissioning.settings.${name}.error`)}</FieldError>
              ) : (
                <Description>{t(`web.commissioning.settings.${name}.hint`)}</Description>
              )}
            </TextField>
          )}
        />
      ))}
      <Controller
        control={form.control}
        name="factoryAddresses"
        render={({ field, fieldState }) => (
          <TextField name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={fieldState.invalid} isDisabled={save.busy}>
            <Label>{t('web.commissioning.settings.factoryAddresses.label')}</Label>
            <TextArea ref={field.ref} className="font-mono" rows={5} autoComplete="off" autoCapitalize="off" spellCheck={false} data-testid="com-field-factoryAddresses" />
            {fieldState.invalid ? (
              <FieldError data-testid="com-error-factoryAddresses">{t('web.commissioning.settings.factoryAddresses.error', { max: L.factoryAddressesMax })}</FieldError>
            ) : (
              // The row's own sentence: a camera outside the list is found only by a typed address.
              <Description data-testid="com-factory-hint">{t('web.commissioning.settings.factoryAddresses.hint', { max: L.factoryAddressesMax })}</Description>
            )}
          </TextField>
        )}
      />
      {/* Row W6 (request line 557, row V7b): the seventh setting - the allowed ONVIF ports, in the stored order. */}
      <Controller
        control={form.control}
        name="onvifPorts"
        render={({ field, fieldState }) => (
          <TextField name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={fieldState.invalid} isDisabled={save.busy}>
            <Label>{t('web.commissioning.settings.onvifPorts.label')}</Label>
            <TextArea ref={field.ref} className="font-mono" rows={3} inputMode="numeric" autoComplete="off" autoCapitalize="off" spellCheck={false} data-testid="com-field-onvifPorts" />
            {fieldState.invalid ? (
              <FieldError data-testid="com-error-onvifPorts">{t('web.commissioning.settings.onvifPorts.error')}</FieldError>
            ) : (
              <Description data-testid="com-onvif-hint">{t('web.commissioning.settings.onvifPorts.hint', { min: L.onvifPortsMin, max: L.onvifPortsMax })}</Description>
            )}
          </TextField>
        )}
      />
      <div className="com-numbers">
        {NUMBER_FIELDS.map(({ name, min, max }) => (
          <Controller
            key={name}
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
              <TextField name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={fieldState.invalid} isDisabled={save.busy}>
                <Label>{t(`web.commissioning.settings.${name}.label`)}</Label>
                <Input ref={field.ref} className="font-mono" inputMode="numeric" autoComplete="off" data-testid={`com-field-${name}`} />
                {fieldState.invalid ? (
                  <FieldError data-testid={`com-error-${name}`}>{t('web.commissioning.settings.numberError', { min, max })}</FieldError>
                ) : (
                  <Description>{t(`web.commissioning.settings.${name}.hint`, { min, max })}</Description>
                )}
              </TextField>
            )}
          />
        ))}
      </div>
      <p className="com-text" data-testid="com-settings-written">
        {t('web.commissioning.settings.revision', { revision: config.revision })}
        {' · '}
        {config.updatedAt === null || config.updatedBy === null
          ? t('web.commissioning.settings.neverWritten')
          : t('web.commissioning.settings.lastWritten', { time: formatClock(config.updatedAt), operator: config.updatedBy })}
      </p>
      <RefusalAlert refusal={refusal} testId="com-settings-refusal" />
      {unchanged ? (
        <p className="com-text" role="status" data-testid="com-settings-unchanged">
          {t('web.commissioning.settings.unchanged')}
        </p>
      ) : null}
      <div>
        <Button ref={saveRef} type="submit" variant="primary" isPending={save.pending} data-testid="com-settings-save">
          {save.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {t('web.commissioning.settings.save')}
        </Button>
      </div>
    </form>
  )
}

// ── The scan (operation 103) ─────────────────────────────────────────────────────────────

/** What the scan result offers row 113: the camera of a row is chosen for an address change. */
interface ScanPick {
  /** The address of the chosen row, or `null`. */
  readonly pickedAddress: string | null
  /** A job runs: no other camera is offered meanwhile. */
  readonly pickDisabled: boolean
  readonly onPick: (camera: FactoryCamera) => void
}

function ScanPanel({
  target,
  onRefused,
  onAlias,
  onScanned,
  ...pick
}: { target: CommissioningTarget; onRefused: (refusal: CommissioningRefusal) => void; onAlias: (alias: CameraFactoryScan['alias']) => void; onScanned: () => void } & ScanPick) {
  const { t } = useTranslation()
  const refused = useRefused()
  const control = usePendingControl()
  const { ref: scanRef } = control
  const [text, setText] = useState('')
  const [formError, setFormError] = useState(false)
  const [refusal, setRefusal] = useState<CommissioningRefusal | null>(null)
  const [scan, setScan] = useState<CameraFactoryScan | null>(null)

  // THE ONE PLACE a scan is sent from: the operator's press (decision U9: active scan only).
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const typed = text.trim() === '' ? null : typedScanAddressOf(text)
    if (text.trim() !== '' && typed === null) {
      // Refused in the form: nothing leaves the page.
      setFormError(true)
      return
    }
    setFormError(false)
    setRefusal(null)
    control.run((release) => {
      void scanFactoryCameras(target, typed)
        .then((answer) => {
          if (answer.ok) {
            setScan(answer.data)
            // A new result replaces the last one: a camera chosen from the old one is no longer chosen (row 113).
            onScanned()
            // The scan may have left a temporary address in place for the next step: the address panel shows it.
            onAlias(answer.data.alias)
            return
          }
          const kind = refused(answer)
          setRefusal(kind)
          onRefused(kind)
        })
        .catch((error: unknown) => {
          reportCommissioningError('features/commissioning.scan', error, COMMISSIONING_RECORD.threw, { operationId: 'scanFactoryCameras' })
          setRefusal({ kind: 'OTHER' })
        })
        .finally(release)
    })
  }

  return (
    <Panel id="scan" icon={Radar} title={t('web.commissioning.scan.title')} busy={control.busy}>
      <p className="com-text">{t('web.commissioning.scan.intro')}</p>
      <p className="com-text" data-testid="com-scan-outside-list">
        {t('web.commissioning.scan.outsideList')}
      </p>
      <form className="com-row" onSubmit={onSubmit} noValidate data-testid="com-scan-form">
        <TextField
          value={text}
          onChange={(value) => {
            setText(value)
            setFormError(false)
          }}
          isInvalid={formError}
          isDisabled={control.busy}
        >
          <Label>{t('web.commissioning.scan.address.label')}</Label>
          <Input className="font-mono" inputMode="decimal" autoComplete="off" autoCapitalize="off" spellCheck={false} data-testid="com-scan-address" />
          {formError ? <FieldError data-testid="com-scan-address-error">{t('web.commissioning.scan.address.error')}</FieldError> : <Description>{t('web.commissioning.scan.address.hint')}</Description>}
        </TextField>
        <Button ref={scanRef} type="submit" variant="primary" isPending={control.pending} data-testid="com-scan-button">
          {control.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : <Radar aria-hidden="true" size={14} />}
          {t('web.commissioning.scan.action')}
        </Button>
      </form>
      <RefusalAlert refusal={refusal} testId="com-scan-refusal" />
      {scan === null ? null : <ScanResult scan={scan} {...pick} />}
    </Panel>
  )
}

/** A text a device announced: untrusted, drawn as text only, in its own direction. */
function Announced({ camera }: { camera: FactoryCamera }) {
  const { t } = useTranslation()
  const parts = [camera.vendor, camera.model, camera.name].filter((part): part is string => part !== null && part !== '')
  if (parts.length === 0) return <span className="com-text">{t('web.commissioning.scan.deviceUnknown')}</span>
  return <bdi>{parts.join(' · ')}</bdi>
}

function ScanResult({ scan, pickedAddress, pickDisabled, onPick }: { scan: CameraFactoryScan } & ScanPick) {
  const { t } = useTranslation()
  return (
    <div className="com-card-body" data-testid="com-scan-result" data-synthetic={scan.synthetic ? 'true' : 'false'} data-devices={scan.devices.length}>
      {scan.synthetic ? (
        <Alert status="accent" data-testid="com-scan-synthetic">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('web.commissioning.scan.synthetic')}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      <p className="com-text" role="status" data-testid="com-scan-summary">
        {t('web.commissioning.scan.summary', { count: scan.addressCount, time: formatClock(scan.scannedAt) })}
      </p>
      {scan.devices.length === 0 ? (
        <p className="com-text" data-testid="com-scan-none">
          {t('web.commissioning.scan.none')}
        </p>
      ) : (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label={t('web.commissioning.scan.table')} data-testid="com-scan-table">
              <Table.Header>
                <Table.Column isRowHeader>{t('web.commissioning.scan.columns.address')}</Table.Column>
                <Table.Column>{t('web.commissioning.scan.columns.mac')}</Table.Column>
                <Table.Column>{t('web.commissioning.scan.columns.device')}</Table.Column>
                <Table.Column>{t('web.commissioning.scan.columns.onvif')}</Table.Column>
                <Table.Column>{t('web.commissioning.scan.columns.registered')}</Table.Column>
                <Table.Column>{t('web.commissioning.setIp.column')}</Table.Column>
              </Table.Header>
              <Table.Body>
                {/* The order of the answer, as it is. An address is plain text, never a link. */}
                {scan.devices.map((camera, index) => (
                  <Table.Row key={`${camera.address}-${index}`} id={`${camera.address}-${index}`} textValue={camera.address} data-testid={`com-scan-row-${camera.address}`} data-conflict={scanConflict(camera) ? 'true' : 'false'} data-device-count={camera.deviceCount}>
                    <Table.Cell>
                      <span className="font-mono">{camera.address}</span>
                      {scanConflict(camera) ? (
                        <span className="com-text" role="alert" data-testid={`com-scan-conflict-${camera.address}`}>
                          {' '}
                          {t('web.commissioning.scan.conflict')}
                        </span>
                      ) : null}
                      {/* Row V6 (R119-03): a scan that could not count SAYS SO. "Not known" is never drawn as "one device" or as nothing. */}
                      {scanCountNotKnown(camera) ? (
                        <span className="com-text" data-testid={`com-scan-count-unknown-${camera.address}`}>
                          {' '}
                          {t('web.commissioning.scan.countNotKnown')}
                        </span>
                      ) : null}
                    </Table.Cell>
                    <Table.Cell>{camera.mac === null ? <span className="com-text">{t('web.commissioning.scan.macUnknown')}</span> : <span className="font-mono">{camera.mac}</span>}</Table.Cell>
                    <Table.Cell>
                      <Announced camera={camera} />
                    </Table.Cell>
                    <Table.Cell>{camera.onvifReachable ? t('web.commissioning.scan.onvifYes') : t('web.commissioning.scan.onvifNo')}</Table.Cell>
                    <Table.Cell>
                      {camera.registeredDeviceId === null ? t('web.commissioning.scan.notRegistered') : t('web.commissioning.scan.registered', { device: camera.registeredDeviceId })}
                    </Table.Cell>
                    <Table.Cell>
                      {/* Row 113: the address change starts from a row of THIS result. The Core refuses a job on an address with a conflict, so none is offered there. */}
                      {scanConflict(camera) ? (
                        <span className="com-text" data-testid={`com-setip-pick-conflict-${camera.address}`}>
                          {t('web.commissioning.setIp.pickConflict')}
                        </span>
                      ) : camera.mac === null ? (
                        // Row V6 (R119-04): the job is bound to the hardware address of THIS row. A row without one cannot be started.
                        <span className="com-text" data-testid={`com-setip-pick-nomac-${camera.address}`}>
                          {t('web.commissioning.setIp.pickNoMac')}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant={pickedAddress === camera.address ? 'secondary' : 'outline'}
                          isDisabled={pickDisabled}
                          aria-label={t('web.commissioning.setIp.pickLabel', { address: camera.address })}
                          aria-pressed={pickedAddress === camera.address}
                          onPress={() => onPick(camera)}
                          data-testid={`com-setip-pick-${camera.address}`}
                        >
                          {t('web.commissioning.setIp.pick')}
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </div>
  )
}

// ── The temporary host address (operations 104 and 105) ──────────────────────────────────

function AliasPanel({
  target,
  state,
  failed,
  onRefused,
  onState,
  onRead,
}: {
  target: CommissioningTarget
  state: HostAliasState | undefined
  failed: boolean
  onRefused: (refusal: CommissioningRefusal) => void
  onState: (state: HostAliasState) => void
  onRead: () => void
}) {
  const { t } = useTranslation()
  const refused = useRefused()
  const control = usePendingControl()
  const { ref: removeRef } = control
  const [refusal, setRefusal] = useState<CommissioningRefusal | null>(null)
  const alias = state?.alias ?? null

  const onRemove = () => {
    setRefusal(null)
    control.run((release) => {
      void removeHostAlias(target)
        .then((answer) => {
          if (answer.ok) {
            onState(answer.data)
            if (answer.data.alias === null) toast.success(t('web.commissioning.alias.removed'))
            return
          }
          const kind = refused(answer)
          setRefusal(kind)
          onRefused(kind)
          // A removal that failed or found nothing: what is in place is the Core's to say.
          onRead()
        })
        .catch((error: unknown) => {
          reportCommissioningError('features/commissioning.alias', error, COMMISSIONING_RECORD.threw, { operationId: 'removeHostAlias' })
          setRefusal({ kind: 'OTHER' })
        })
        .finally(release)
    })
  }

  return (
    <Panel
      id="alias"
      icon={RouteIcon}
      title={t('web.commissioning.alias.title')}
      busy={control.busy}
      action={
        <Button size="sm" variant="ghost" onPress={onRead} isDisabled={control.busy} data-testid="com-alias-refresh">
          {t('web.commissioning.alias.refresh')}
        </Button>
      }
    >
      <p className="com-text">{t('web.commissioning.alias.intro')}</p>
      {state === undefined ? (
        failed ? (
          <ReadFailed sentence={t('web.commissioning.alias.readFailed')} onRetry={onRead} testId="com-alias-failed" />
        ) : (
          <Skeleton className="h-10 w-full rounded-lg" data-testid="com-alias-loading" />
        )
      ) : alias === null ? (
        <p data-testid="com-alias-state" data-present="false">
          <Chip size="sm" variant="soft" color="default">
            <Chip.Label>{t('web.commissioning.alias.none')}</Chip.Label>
          </Chip>
        </p>
      ) : (
        <div className="com-card-body" data-testid="com-alias-state" data-present="true" data-alias={alias.aliasId}>
          <dl className="com-facts">
            <div>
              <dt>{t('web.commissioning.alias.address')}</dt>
              <dd className="font-mono" data-testid="com-alias-address">{`${alias.address}/${HOST_ALIAS_HELPER.prefixLength}`}</dd>
            </div>
            <div>
              <dt>{t('web.commissioning.alias.reason')}</dt>
              <dd>{t(`web.commissioning.alias.reasons.${alias.reason}`)}</dd>
            </div>
            <div>
              <dt>{t('web.commissioning.alias.addedAt')}</dt>
              <dd className="font-mono">{formatClock(alias.addedAt)}</dd>
            </div>
            <div>
              <dt>{t('web.commissioning.alias.expiresAt')}</dt>
              <dd className="font-mono" data-testid="com-alias-expires">
                {formatClock(alias.expiresAt)}
              </dd>
            </div>
          </dl>
          {alias.removeError === null ? null : (
            <Alert status="danger" role="alert" data-testid="com-alias-remove-error">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('web.commissioning.alias.removeError', { code: alias.removeError })}</Alert.Title>
              </Alert.Content>
            </Alert>
          )}
          <div>
            <Button ref={removeRef} size="sm" variant="outline" onPress={onRemove} isPending={control.pending} data-testid="com-alias-remove">
              {control.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
              {t('web.commissioning.alias.remove')}
            </Button>
          </div>
        </div>
      )}
      <RefusalAlert refusal={refusal} testId="com-alias-refusal" />
    </Panel>
  )
}
