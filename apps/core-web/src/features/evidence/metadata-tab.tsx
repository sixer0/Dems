import { useMemo, useState } from 'react'
import { Alert, Button, Chip, EmptyState, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import type { Key } from '@heroui/react'
import { motion } from 'motion/react'
import { FileJson, FileX, FolderTree } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { getDemoEvidenceDocuments, MANIFEST_FIELDS, PACKAGE_ITEM_FILES, type DemoEvidencePackage, type PackageItemKey } from '@dems/shared/demo-data'
import { formatUtcOffset } from '@dems/shared/realtime'
import { toWibIso } from '@dems/shared/sim'
import { useMotionPolicy } from '@/motion'
import { useEvidenceAssets } from './demo-assets'
import { JsonView } from './json-view'
import { logEvidenceError } from './log'
import { byteSize, formatWibDate, formatWibDateTime, packageDescribesItem, shortHash, type EvidenceRow } from './model'
import { summariseManifestField } from './manifest-summary'

type DocumentKey = 'manifest' | 'metadata' | 'signature' | 'audit'
const DOCUMENTS: DocumentKey[] = ['manifest', 'metadata', 'signature', 'audit']

type PackageDocuments = NonNullable<ReturnType<typeof getDemoEvidenceDocuments>>

export interface MetadataTabProps {
  row: EvidenceRow
  /**
   * Live mode: the Core's media reference (operation 40) did not answer, so whether a DEMO package
   * belongs to the item is not known. The empty state then says so in the header chip's words
   * (`evidence.live.mediaUnavailable`), not "No DEMO package for this item", and the record's note
   * claims no absence either (closing copy round, W83 ledger #95; observation of plan row W0, D165).
   * False in Simulated mode and whenever the Core answered.
   */
  mediaUnavailable?: boolean
}

/** The item's own record as JSON: the Core server's in Live mode, the simulator's in Simulated mode. */
function recordText(row: EvidenceRow, header: Record<string, unknown>): string {
  return JSON.stringify(
    {
      ...header,
      evidenceId: row.item.id,
      sessionId: row.item.sessionId,
      caseNumber: row.item.caseNumber,
      subject: { name: row.item.subjectName, type: row.item.subjectType },
      investigatorId: row.item.investigatorId,
      room: row.item.room,
      recordedAt: toWibIso(row.item.recordedAt),
      endedAt: toWibIso(row.item.endedAt),
      sealedAt: row.item.sealedAt === null ? null : toWibIso(row.item.sealedAt),
      status: row.item.status,
      lifecycleStage: row.item.lifecycleStage,
      manifestHash: row.item.manifestHash,
      tracks: row.item.tracks,
      signature: row.item.signature,
    },
    null,
    2,
  )
}

/**
 * Metadata tab (01_specs §14.5.3; research/04 §5.1; design book §11.2, §11.3; S19).
 *
 * - The 13 §11.3 manifest fields, summarised from the package's `manifest.json` (book wording from
 *   `MANIFEST_FIELDS`).
 * - The §11.2 package contents with sizes and SHA-256 (the package tree, S19).
 * - Session notes: the stop reason and custody entries recorded in `metadata.json` (the simulator's
 *   `EvidenceItem.markers` / `notes`, step 54, are empty for the dataset items).
 * - Raw documents: `manifest.json`, `metadata.json` and `signature.sig` exactly as stored (from
 *   `getDemoEvidenceDocuments`), and the audit extract loaded on demand from the package.
 * Items without a package show the simulator's record, labelled SIMULATED. In Live mode the record is
 * the Core server's: it is labelled "Core record" and says so, never "simulated" (04_client_integration_spec
 * §3.2; plan row W0, item 9, decision D158).
 *
 * A joined package of ANOTHER record, Live mode only (E-fix FX-W, E2E-W1-4; controller ruling of row
 * FX-W2). The join keeps the same demo interview on any day (D84 on F-47-1), so on any day but the
 * generator's the package's evidence ID, session and case number differ from the record the Core
 * server holds (`EV-20261001-0012` for `EV-20261006-0012`). Its manifest is then not that record's
 * metadata: the tab shows the Core's record first (as for an item without a package), an info Alert
 * that names the package and says its documents describe that package, and the package's raw
 * documents beside it under a "Bundled DEMO package · <ID>" heading with the DEMO chip. The 13
 * manifest fields and the package tree are shown only for the package's own record.
 * In Simulated mode the bundled package IS the item's own content by construction (the simulator
 * re-dates its dataset; it creates no other record), so the package stays the item's metadata on
 * every day, as before.
 */
export function MetadataTab({ row, mediaUnavailable = false }: MetadataTabProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const live = useCoreMode() === CoreMode.LIVE
  // Live, operation 40 unanswered: whether a DEMO package joins the item is unknown (W83 ledger #95).
  const packageUnknown = live && mediaUnavailable
  const pkg = row.pkg
  const documents = useMemo(() => (pkg ? getDemoEvidenceDocuments(pkg.evidenceSuffix) : null), [pkg])
  const manifest = useMemo<Record<string, unknown> | null>(() => {
    if (!documents) return null
    try {
      return JSON.parse(documents.manifestJson) as Record<string, unknown>
    } catch (error) {
      logEvidenceError('metadata.parseManifest', error, { evidenceId: row.id })
      return null
    }
  }, [documents, row.id])
  const metadata = useMemo<{ session?: { stopReason?: string }; custody?: { at: string; action: string; actorName: string; detail: string | null }[] } | null>(() => {
    if (!documents) return null
    try {
      return JSON.parse(documents.metadataJson) as never
    } catch {
      return null
    }
  }, [documents])
  const recordLabel = t(live ? 'evidence.live.coreRecord' : 'evidence.metadata.simulatedRecord')

  if (!pkg || !documents) {
    const record = recordText(
      row,
      live
        ? {
            record: 'CORE',
            note: packageUnknown
              ? "The Core server's record of this item; its media reference is unavailable, so no DEMO package is shown."
              : "The Core server's record of this item; no DEMO package joins it.",
          }
        : { simulated: true, note: 'SIMULATED record from the in-browser simulator; no DEMO package joins this item.' },
    )
    return (
      <div className="evi-metadata" data-testid="evidence-metadata" data-package={live ? 'core' : 'simulated'}>
        <EmptyState className="evi-empty evi-empty-inline">
          <FileX className="size-6 text-foreground-2" aria-hidden="true" />
          <p className="evi-empty-title">{t(packageUnknown ? 'evidence.live.mediaUnavailable' : 'evidence.metadata.noPackage')}</p>
        </EmptyState>
        <JsonView text={record} label={recordLabel} />
      </div>
    )
  }

  if (live && !packageDescribesItem(pkg, row.item)) {
    // E2E-W1-4 (Live only): the joined package is another record than the Core server's.
    const record = recordText(row, {
      record: 'CORE',
      note: `The Core server's record of this item. The bundled DEMO package ${pkg.evidenceId} is another record and is not this item's metadata.`,
    })
    const packageTitle = t('evidence.metadata.foreign.packageTitle', { id: pkg.evidenceId })
    return (
      <div className="evi-metadata" data-testid="evidence-metadata" data-package="foreign" data-package-id={pkg.evidenceId}>
        <section className="evi-metadata-fields" aria-label={t('evidence.metadata.foreign.recordTitle')}>
          <Alert status="accent" data-testid="evidence-foreign-package">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('evidence.metadata.foreign.title')}</Alert.Title>
              <Alert.Description>
                {t('evidence.metadata.foreign.body', {
                  id: pkg.evidenceId,
                  session: pkg.sessionId,
                  date: formatWibDate(Date.parse(pkg.startedAt)),
                  record: recordLabel,
                })}
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <h3 className="evi-section-title">
            {t('evidence.metadata.foreign.recordTitle')}
            <Chip size="sm" variant="secondary" className="evi-demo-chip">
              <Chip.Label>{t('evidence.live.coreRecord')}</Chip.Label>
            </Chip>
          </h3>
          <JsonView text={record} label={recordLabel} />
        </section>

        <section className="evi-metadata-json" aria-label={packageTitle} data-testid="evidence-foreign-documents">
          <h3 className="evi-section-title">
            <FileJson className="size-4 text-accent" aria-hidden="true" />
            {packageTitle}
            <Chip size="sm" variant="secondary" className="evi-demo-chip">
              <Chip.Label>{t('evidence.demo.chip')}</Chip.Label>
            </Chip>
          </h3>
          <PackageDocumentsView pkg={pkg} documents={documents} evidenceId={row.id} labelPrefix={packageTitle} />
        </section>
      </div>
    )
  }

  return (
    <div className="evi-metadata" data-testid="evidence-metadata" data-package="demo">
      <section className="evi-metadata-fields" aria-label={t('evidence.detail.metadata.manifest')}>
        <h3 className="evi-section-title">
          {t('evidence.metadata.manifestTitle')}
          <Chip size="sm" variant="secondary" className="evi-demo-chip">
            <Chip.Label>{t('evidence.demo.chip')}</Chip.Label>
          </Chip>
        </h3>
        <dl className="evi-kv evi-kv-manifest" data-testid="evidence-manifest-fields">
          {MANIFEST_FIELDS.map((field, index) => (
            <motion.div
              key={field.key}
              data-field={field.key}
              initial={m.reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...m.transitions.row, delay: m.reduced ? 0 : m.seconds(30 * Math.min(index, 7)) }}
            >
              <dt>
                <span className="evi-field-n">{field.n}</span> {field.label}
              </dt>
              <dd>{manifest ? summariseManifestField(field.key, manifest) : '—'}</dd>
            </motion.div>
          ))}
        </dl>

        <h3 className="evi-section-title">
          <FolderTree className="size-4 text-accent" aria-hidden="true" />
          {t('evidence.metadata.packageTitle', { folder: pkg.folder.slice(pkg.folder.lastIndexOf('/') + 1) })}
        </h3>
        <ul className="evi-package-tree" data-testid="evidence-package-tree">
          {(Object.keys(PACKAGE_ITEM_FILES) as PackageItemKey[]).map((key) => {
            const file = pkg.files[key]
            const size = byteSize(file.bytes)
            return (
              <li key={key} data-file={key}>
                <span className="evi-mono evi-strong">{PACKAGE_ITEM_FILES[key]}</span>
                <span className="evi-caption">{size.unit === 'mb' && file.bytes < 1e6 ? t('evidence.metadata.kb', { value: (file.bytes / 1000).toFixed(1) }) : t(`common.units.${size.unit}`, { value: size.value })}</span>
                <span className="evi-mono evi-caption" title={file.sha256}>
                  {shortHash(file.sha256)}
                </span>
              </li>
            )
          })}
          {pkg.tracks.map((track) => (
            <li key={track.trackId} data-file={track.trackId}>
              <span className="evi-mono evi-strong">media/{track.file}</span>
              <span className="evi-caption">{t(`common.units.mb`, { value: (track.stored.bytes / 1e6).toFixed(2) })}</span>
              <span className="evi-mono evi-caption" title={track.sealedSha256}>
                {shortHash(track.sealedSha256)}
              </span>
            </li>
          ))}
        </ul>

        <h3 className="evi-section-title">{t('evidence.detail.metadata.notes')}</h3>
        <dl className="evi-kv evi-kv-compact">
          <div>
            <dt>{t('evidence.metadata.stopReason')}</dt>
            <dd>{metadata?.session?.stopReason?.trim() ? metadata.session.stopReason : t('evidence.metadata.noStopReason')}</dd>
          </div>
          <div>
            <dt>{t('evidence.detail.metadata.markers')}</dt>
            <dd>{t('evidence.metadata.noMarkers')}</dd>
          </div>
          {(metadata?.custody ?? []).map((entry, index) => (
            <div key={`${entry.at}-${index}`}>
              <dt>{`${formatWibDateTime(Date.parse(entry.at))} UTC${formatUtcOffset()}`}</dt>
              <dd>
                {entry.action} · {entry.actorName}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="evi-metadata-json" aria-label={t('evidence.detail.metadata.json')}>
        <PackageDocumentsView pkg={pkg} documents={documents} evidenceId={row.id} labelPrefix={null} />
      </section>
    </div>
  )
}

interface PackageDocumentsViewProps {
  pkg: DemoEvidencePackage
  documents: PackageDocuments
  evidenceId: string
  /** Prefixed to each document's accessible name (the foreign-package heading), or null. */
  labelPrefix: string | null
}

/** The package's raw documents exactly as stored, and its audit extract loaded on demand. */
function PackageDocumentsView({ pkg, documents, evidenceId, labelPrefix }: PackageDocumentsViewProps) {
  const { t } = useTranslation()
  const { load } = useEvidenceAssets()
  const [document, setDocument] = useState<DocumentKey>('manifest')
  const [audit, setAudit] = useState<{ state: 'idle' | 'loading' | 'ready' | 'error'; text: string }>({ state: 'idle', text: '' })

  const loadAudit = async () => {
    if (audit.state === 'loading') return
    setAudit({ state: 'loading', text: '' })
    try {
      const bytes = await load(pkg.files.auditExtract.path)
      setAudit({ state: 'ready', text: new TextDecoder().decode(bytes) })
    } catch (error) {
      logEvidenceError('metadata.loadAudit', error, { evidenceId })
      setAudit({ state: 'error', text: '' })
    }
  }

  const onDocument = (keys: Set<Key>) => {
    const [next] = [...keys]
    if (next === undefined) return
    setDocument(next as DocumentKey)
    if (next === 'audit' && audit.state === 'idle') void loadAudit()
  }

  const documentText =
    document === 'manifest'
      ? documents.manifestJson
      : document === 'metadata'
        ? documents.metadataJson
        : document === 'signature'
          ? documents.signatureSig
          : audit.text
  const documentLabel = t(`evidence.metadata.documents.${document}`)

  return (
    <>
      <div className="evi-json-toolbar">
        <FileJson className="size-4 text-accent" aria-hidden="true" />
        <ToggleButtonGroup aria-label={t('evidence.metadata.document')} selectionMode="single" disallowEmptySelection selectedKeys={new Set<Key>([document])} onSelectionChange={onDocument} size="sm">
          {DOCUMENTS.map((key) => (
            <ToggleButton key={key} id={key} data-testid={`evidence-doc-${key}`}>
              {t(`evidence.metadata.documents.${key}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      {document === 'audit' && audit.state === 'error' ? (
        <div className="evi-inline-error" role="alert">
          <span>{t('evidence.metadata.auditError')}</span>
          <Button size="sm" variant="outline" onPress={() => void loadAudit()}>
            {t('common.actions.retry')}
          </Button>
        </div>
      ) : (
        <JsonView
          key={document}
          text={document === 'audit' && audit.state !== 'ready' ? t('evidence.metadata.loadingAudit') : documentText}
          label={labelPrefix ? `${labelPrefix} · ${documentLabel}` : documentLabel}
        />
      )}
      <p className="evi-caption">{t('evidence.metadata.exactBytes')}</p>
    </>
  )
}
