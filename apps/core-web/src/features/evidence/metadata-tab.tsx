import { useMemo, useState } from 'react'
import { Button, Chip, EmptyState, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import type { Key } from '@heroui/react'
import { motion } from 'motion/react'
import { FileJson, FileX, FolderTree } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { getDemoEvidenceDocuments, MANIFEST_FIELDS, PACKAGE_ITEM_FILES, type PackageItemKey } from '@dems/shared/demo-data'
import { formatUtcOffset } from '@dems/shared/realtime'
import { toWibIso } from '@dems/shared/sim'
import { useMotionPolicy } from '@/motion'
import { useEvidenceAssets } from './demo-assets'
import { JsonView } from './json-view'
import { logEvidenceError } from './log'
import { byteSize, formatWibDateTime, shortHash, type EvidenceRow } from './model'
import { summariseManifestField } from './manifest-summary'

type DocumentKey = 'manifest' | 'metadata' | 'signature' | 'audit'
const DOCUMENTS: DocumentKey[] = ['manifest', 'metadata', 'signature', 'audit']

export interface MetadataTabProps {
  row: EvidenceRow
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
 */
export function MetadataTab({ row }: MetadataTabProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const live = useCoreMode() === CoreMode.LIVE
  const { load } = useEvidenceAssets()
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
  const [document, setDocument] = useState<DocumentKey>('manifest')
  const [audit, setAudit] = useState<{ state: 'idle' | 'loading' | 'ready' | 'error'; text: string }>({ state: 'idle', text: '' })

  const loadAudit = async () => {
    if (!pkg || audit.state === 'loading') return
    setAudit({ state: 'loading', text: '' })
    try {
      const bytes = await load(pkg.files.auditExtract.path)
      setAudit({ state: 'ready', text: new TextDecoder().decode(bytes) })
    } catch (error) {
      logEvidenceError('metadata.loadAudit', error, { evidenceId: row.id })
      setAudit({ state: 'error', text: '' })
    }
  }

  const onDocument = (keys: Set<Key>) => {
    const [next] = [...keys]
    if (next === undefined) return
    setDocument(next as DocumentKey)
    if (next === 'audit' && audit.state === 'idle') void loadAudit()
  }

  if (!pkg || !documents) {
    const record = JSON.stringify(
      {
        ...(live
          ? { record: 'CORE', note: "The Core server's record of this item; no DEMO package joins it." }
          : { simulated: true, note: 'SIMULATED record from the in-browser simulator; no DEMO package joins this item.' }),
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
    return (
      <div className="evi-metadata" data-testid="evidence-metadata" data-package={live ? 'core' : 'simulated'}>
        <EmptyState className="evi-empty evi-empty-inline">
          <FileX className="size-6 text-foreground-2" aria-hidden="true" />
          <p className="evi-empty-title">{t('evidence.metadata.noPackage')}</p>
        </EmptyState>
        <JsonView text={record} label={t(live ? 'evidence.live.coreRecord' : 'evidence.metadata.simulatedRecord')} />
      </div>
    )
  }

  const documentText =
    document === 'manifest'
      ? documents.manifestJson
      : document === 'metadata'
        ? documents.metadataJson
        : document === 'signature'
          ? documents.signatureSig
          : audit.text

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
            label={t(`evidence.metadata.documents.${document}`)}
          />
        )}
        <p className="evi-caption">{t('evidence.metadata.exactBytes')}</p>
      </section>
    </div>
  )
}
