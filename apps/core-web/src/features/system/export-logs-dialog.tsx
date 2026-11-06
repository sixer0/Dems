import { useState } from 'react'
import { Button, Description, FieldError, Label, Modal, Spinner, TextArea, TextField, toast } from '@heroui/react'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApiErrorCode, EXPORT_REASON_MAX_LENGTH, type AuditPage, type EventPage } from '@dems/shared/api'
import { settle, useCoreActions } from '@dems/shared/live'
import { CORE_DEVICE_ID_NOT_REPORTED, EXPORT_REASON_MIN_LENGTH, Permission, reportedCoreDeviceIdOf, useSimInstance, type ExportResult } from '@dems/shared/sim'
import { CoreErrorNoticeKind, useCoreErrorPresenter } from '@/lib/core-errors'
import { SIGNED_OUT_PAGE } from '@/lib/core-page-walk'
import { usePendingControl } from '@/lib/pending-control'
import { productVersionsOf, useSystemComponents } from '@/lib/product-versions'
import { useWebLive } from '@/runtime'
import {
  buildLogExportFile,
  downloadJson,
  LOG_EXPORT_VERSION_NOT_REPORTED,
  LOG_PAGE_LIMIT,
  logExportTarget,
  LogWalkError,
  readAllEvents,
  readExportedAuditRows,
  type AuditPageAnswer,
  type EventPageAnswer,
} from './live-log-export'
import { logSystemError, newSystemCorrelationId } from './log'
import { requiredRoleFor } from './model'

export interface ExportLogsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * A8 in Live mode (plan row W76; backend task 04_client_integration_spec §8.2 A8; finding CPC1-22;
 * decision F59). The Core requires a reason for a log export (5 to 500 characters after trimming,
 * operation 62): `exportLogs()` without one is always answered 422 `INVALID_REASON`. This dialog
 * collects it, keeps the contract's bounds itself, and treats the Core's 422 as the judge: a reason
 * the Core still refuses is shown on the field, the dialog stays open with what was typed.
 *
 * After the 202 the file is built from every page of operations 59 and 63 (AC-C-60) plus `services`
 * and `diagnostics` of the replica, then downloaded; the success toast names the export ID. The
 * dialog shows the page being read. Simulated mode never renders this dialog: its Export logs button
 * exports at once, as before.
 */
export function ExportLogsDialog({ isOpen, onOpenChange }: ExportLogsDialogProps) {
  const { t } = useTranslation()
  const actions = useCoreActions()
  const sim = useSimInstance()
  const systemComponents = useSystemComponents()
  const live = useWebLive()
  const presentCoreError = useCoreErrorPresenter()
  const { busy, pending, ref: submitRef, run: runExport } = usePendingControl()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  /** The Core answered `422 INVALID_REASON` for this reason (F59: the Core is the judge). */
  const [refused, setRefused] = useState(false)
  /** The page being read once the Core accepted the export; null otherwise. */
  const [page, setPage] = useState<number | null>(null)

  const trimmed = reason.trim()
  const valid = trimmed.length >= EXPORT_REASON_MIN_LENGTH
  const reasonError = refused
    ? t('system.live.export.reasonRefused')
    : touched && !valid
      ? t('system.live.export.reasonTooShort', { min: EXPORT_REASON_MIN_LENGTH })
      : null

  const finish = () => {
    setReason('')
    setTouched(false)
    setRefused(false)
    onOpenChange(false)
  }

  /**
   * Decision D176 (finding F75-2): a Core read runs only while an operator is signed in. The walk
   * (`lib/core-page-walk.ts`) asks before EVERY page; after a sign-out (or any session end) it sends
   * nothing more and ends as the Core would have answered (401 `NOT_SIGNED_IN`, which the presenter
   * leaves silent: the shell shows the login screen).
   */
  const signedIn = () => live !== null && live.session !== null
  const readAuditPage = async (cursor: string | null): Promise<AuditPageAnswer> => {
    if (live === null) return SIGNED_OUT_PAGE
    const answer = await live.client.call('listAuditRows', { query: cursor === null ? { limit: LOG_PAGE_LIMIT } : { limit: LOG_PAGE_LIMIT, cursor } })
    return answer.ok ? { ok: true, data: answer.data as AuditPage } : answer
  }
  const readEventPage = async (cursor: string | null): Promise<EventPageAnswer> => {
    if (live === null) return SIGNED_OUT_PAGE
    const answer = await live.client.call('listEvents', { query: cursor === null ? { limit: LOG_PAGE_LIMIT } : { limit: LOG_PAGE_LIMIT, cursor } })
    return answer.ok ? { ok: true, data: answer.data as EventPage } : answer
  }

  /** The Core accepted the export: read its logs, build the file, hand it to the browser. */
  const buildFile = async (exportId: string, exportReason: string): Promise<void> => {
    const target = logExportTarget(sim.store.getState().audit.rows, exportId)
    let auditPages = 0
    setPage(1)
    try {
      const rows = await readExportedAuditRows(readAuditPage, target, {
        signedIn,
        onPage: (read) => {
          auditPages = read
          setPage(read + 1)
        },
      })
      const events = await readAllEvents(readEventPage, { signedIn, onPage: (read) => setPage(auditPages + read + 1) })
      const state = sim.store.getState()
      const versions = productVersionsOf({ ...systemComponents, modelVersion: state.device.softwareVersion })
      // Audit row CS2 (U-14c, S9): the id the Core reports - never the dataset's reserved id on a Core in its own capture.
      const deviceId = reportedCoreDeviceIdOf(state) ?? CORE_DEVICE_ID_NOT_REPORTED
      downloadJson(
        `dems-logs-${deviceId}-${exportId}.json`,
        buildLogExportFile({
          // Closing pass J4, item 3: on a Core in its own capture the file states what it is - no `demo` flag, no "synthetic".
          ownCapture: versions.ownCore,
          exportId,
          reason: exportReason,
          deviceId,
          // Fix wave J round three (JW-26): the file of a Core in its own capture names that Core's version, not the model's.
          softwareVersion: versions.modelVersion ?? versions.coreVersion ?? LOG_EXPORT_VERSION_NOT_REPORTED,
          ...(versions.ownCore ? { components: versions.rows } : {}),
          at: target.at ?? state.clock.now,
          rows,
          events,
          services: state.services,
          diagnostics: state.diagnostics,
        }),
      )
      toast.success(t('system.live.export.done', { exportId }), { description: t('system.live.export.doneBody', { rows: rows.length, events: events.length }) })
      finish()
    } catch (error) {
      // D176: the session ended during the walk; nothing more was sent and nothing is said (the shell
      // shows the login screen with its own notice).
      if (error instanceof LogWalkError && error.code === ApiErrorCode.NOT_SIGNED_IN) return
      // A refused page or an outage goes to the presenter first (the limit, the outage, a session end);
      // the export itself was recorded by the Core, which the page's own sentence says.
      // W92-13: the export was accepted, so the outage sentence leaves out "Nothing was changed".
      const notice = presentCoreError(error instanceof LogWalkError && error.reason.kind === 'CALL' ? error.reason.failure : error, { afterAcceptedCommand: true })
      if (notice?.kind === CoreErrorNoticeKind.SIGNED_OUT || notice?.kind === CoreErrorNoticeKind.STOPPED) return
      toast.warning(t('system.live.export.readFailed', { exportId }))
      logSystemError('Maintenance.exportLogs.read', error, {
        exportId,
        list: error instanceof LogWalkError && 'list' in error.reason ? error.reason.list : null,
        correlationId: newSystemCorrelationId(),
      })
    } finally {
      setPage(null)
    }
  }

  /** The Core refused with the result union (CL-19). */
  const refusedBy = (result: Extract<ExportResult, { ok: false }>) => {
    if (result.status === 422) {
      setRefused(true)
      return
    }
    toast.danger(t('system.maintenance.exportDenied'), {
      description:
        result.status === 401
          ? t('system.maintenance.exportNotSignedIn')
          : t('common.rbac.requiresRole', { role: t(`common.roles.${requiredRoleFor(Permission.AUDIT_EXPORT) ?? 'SUPERVISOR'}`) }),
    })
    if (result.status !== 403 && result.status !== 401) logSystemError('Maintenance.exportLogs', null, { status: result.status, reason: result.reason })
    finish()
  }

  const submit = () => {
    setTouched(true)
    if (!valid) return
    const exportReason = trimmed.slice(0, EXPORT_REASON_MAX_LENGTH)
    runExport((release) => {
      settle(() => actions.exportLogs({ reason: exportReason }), {
        ok: (result) => {
          if (!result.ok) {
            refusedBy(result)
            release()
            return
          }
          void buildFile(result.exportId, exportReason).finally(release)
        },
        fail: (error) => {
          release()
          // The presenter words an outage (LB-6: the dialog stays open with the reason), a limit, a session end.
          if (presentCoreError(error) !== null) return
          toast.danger(t('system.errors.generic'))
          logSystemError('Maintenance.exportLogs', error, { correlationId: newSystemCorrelationId() })
        },
      })
    })
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => (open ? onOpenChange(true) : busy ? undefined : finish())} variant="blur">
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog aria-label={t('system.live.export.title')} className="sys-export-dialog" data-testid="system-export-dialog">
          <Modal.Header className="sys-diag-header">
            <Download className="sys-card-icon" aria-hidden="true" strokeWidth={1.75} />
            <Modal.Heading>{t('system.live.export.title')}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="sys-export-body">
            <p className="sys-muted sys-small">{t('system.live.export.lead')}</p>
            <TextField
              isRequired
              value={reason}
              onChange={(value) => {
                setReason(value.slice(0, EXPORT_REASON_MAX_LENGTH))
                setRefused(false)
              }}
              onBlur={() => setTouched(true)}
              isInvalid={reasonError !== null}
              isDisabled={busy}
              className="sys-setting"
              data-testid="system-export-reason-field"
            >
              <Label>{t('system.live.export.reasonLabel')}</Label>
              <TextArea placeholder={t('system.live.export.reasonPlaceholder')} rows={3} data-testid="system-export-reason" />
              {reasonError ? (
                <FieldError data-testid="system-export-reason-error">{reasonError}</FieldError>
              ) : (
                <Description>{t('system.live.export.reasonHint', { min: EXPORT_REASON_MIN_LENGTH })}</Description>
              )}
            </TextField>
            {page !== null ? (
              <p className="sys-muted sys-small sys-mono" role="status" data-testid="system-export-progress">
                {t('system.live.export.reading', { page })}
              </p>
            ) : null}
          </Modal.Body>
          <Modal.Footer className="sys-diag-footer">
            <Button variant="ghost" isDisabled={busy} onPress={finish} data-testid="system-export-cancel">
              {t('system.live.export.cancel')}
            </Button>
            <Button ref={submitRef} variant="primary" isPending={pending} onPress={submit} data-testid="system-export-submit">
              {pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
              {t('system.live.export.submit')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
