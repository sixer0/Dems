import { Chip } from '@heroui/react'
import { Fingerprint } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim, type DeviceIdentity, type SimState } from '@dems/shared/sim'
import { SystemPanel } from './panel'
import { releaseInfo } from './sim-adapter'

/** §24.1 order (12 items; item 1 and item 12 carry two fields each). */
const IDENTITY_FIELDS = [
  'serialNumber',
  'hardwareUuid',
  'chassisRevision',
  'somPartRevision',
  'audioBoardRevision',
  'poeBoardRevision',
  'powerBoardRevision',
  'bspVersion',
  'coreSoftwareVersion',
  'tabletAppVersion',
  'tpmModelFirmware',
  'cameraModelFirmware',
  'provisioningRecordId',
  'deviceCertificateId',
] as const satisfies readonly (keyof DeviceIdentity)[]

const selectDevice = (s: SimState) => s.device
const selectAbout = (s: SimState) => ({
  ip: s.network.ip,
  slot: s.update.activeSlot,
  updateVersion: s.update.currentVersion,
  tz: s.clock.tz,
})

/**
 * About / identity (01_specs §14.5.8; design book §24 via 01_explore): device ID DEMS-IR-01, room,
 * model, software release, hardware revision, slot, IP; the §24.1 configuration identity (synthetic
 * values from the sim); and the SBOM / release-control summary (§24.3; the sim's synthetic `releaseInfo`, step 54) with the
 * configuration-drift check (the three version sources must agree).
 */
export function AboutPanel({ anchorId }: { anchorId: string }) {
  const { t } = useTranslation()
  const device = useSim(selectDevice)
  const about = useSim(selectAbout)
  const release = releaseInfo(device.softwareVersion)
  const drift = device.identity.coreSoftwareVersion !== device.softwareVersion || about.updateVersion !== device.softwareVersion

  const summary: { key: string; label: string; value: string; mono?: boolean }[] = [
    { key: 'deviceId', label: t('system.about.deviceId'), value: device.id, mono: true },
    { key: 'room', label: t('system.about.room'), value: device.room },
    { key: 'model', label: t('system.about.model'), value: device.productName },
    { key: 'release', label: t('system.about.softwareRelease'), value: `v${device.softwareVersion}`, mono: true },
    { key: 'hardware', label: t('system.about.hardwareRevision'), value: device.identity.chassisRevision, mono: true },
    { key: 'slot', label: t('system.about.activeSlot'), value: t('system.update.slot', { slot: about.slot }) },
    { key: 'ip', label: t('system.about.ipAddress'), value: about.ip, mono: true },
    { key: 'tz', label: t('system.about.timeZone'), value: t('common.time.zone', { offset: about.tz }) },
  ]

  return (
    <SystemPanel
      id="about"
      anchorId={anchorId}
      icon={Fingerprint}
      title={t('system.about.title')}
      action={
        <Chip size="sm" variant="secondary" className="sys-sim-chip">
          <Chip.Label>{t('system.about.synthetic')}</Chip.Label>
        </Chip>
      }
      bodyClassName="sys-about-body"
    >
      <dl className="sys-kv-grid" data-testid="system-about-summary">
        {summary.map((row) => (
          <div key={row.key} className="sys-kv">
            <dt>{row.label}</dt>
            <dd className={row.mono ? 'sys-mono' : undefined} data-testid={`system-about-${row.key}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="sys-about-split">
        <section className="sys-subsection" aria-label={t('system.about.identityTitle')}>
          <h3 className="sys-subtitle">{t('system.about.identityTitle')}</h3>
          <dl className="sys-identity">
            {IDENTITY_FIELDS.map((field) => (
              <div key={field} className="sys-identity-row">
                <dt>{t(`system.about.fields.${field}`)}</dt>
                <dd className="sys-mono" title={device.identity[field]}>
                  {device.identity[field]}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="sys-subsection" aria-label={t('system.about.sbomTitle')} data-testid="system-sbom">
          <h3 className="sys-subtitle">{t('system.about.sbomTitle')}</h3>
          <dl className="sys-identity">
            <div className="sys-identity-row">
              <dt>{t('system.about.softwareRelease')}</dt>
              <dd className="sys-mono">v{release.version}</dd>
            </div>
            <div className="sys-identity-row">
              <dt>{t('system.about.buildId')}</dt>
              <dd className="sys-mono">{release.buildId}</dd>
            </div>
            <div className="sys-identity-row">
              <dt>{t('system.about.checksum')}</dt>
              <dd className="sys-mono" title={release.checksum}>
                {release.checksum}
              </dd>
            </div>
            <div className="sys-identity-row">
              <dt>{t('system.about.sbom')}</dt>
              <dd>{t('system.about.sbomComponents', { count: release.components })}</dd>
            </div>
            <div className="sys-identity-row">
              <dt>{t('system.about.sbomFormat')}</dt>
              <dd>{release.format}</dd>
            </div>
            <div className="sys-identity-row">
              <dt>{t('system.about.drift')}</dt>
              <dd>
                <Chip size="sm" variant="soft" color={drift ? 'warning' : 'success'} className="sys-status-chip" data-testid="system-drift">
                  <Chip.Label>{drift ? t('system.about.driftFound') : t('system.about.driftNone')}</Chip.Label>
                </Chip>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </SystemPanel>
  )
}
