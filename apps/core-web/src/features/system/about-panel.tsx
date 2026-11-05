import { Chip } from '@heroui/react'
import { Fingerprint } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim, type DeviceIdentity, type SimState } from '@dems/shared/sim'
import { ComponentVersionRows } from '@/components/component-versions'
import { usePlatformNotReported, useReportedCoreDeviceId, useSelfCaptureCore } from '@/lib/own-capture'
import { useProductVersions } from '@/lib/product-versions'
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
 *
 * Audit fix row 105 (DF-21 / U-14, rulings D25 N3, D29 Q5, D52; register S7, S8, S9): on a Core in its own
 * capture (`useSelfCaptureCore`, the one rule) the panel draws no "Synthetic demo values" chip (S8) and no value
 * of the appliance model - room, model, hardware revision, slot, IP, the §24.1 identity rows and the SBOM summary
 * read `system.noProducer` (S7). The device id is the Core's stored record (`core_device.id`, replicated); the
 * dataset's id `DEVICE_ID` (a reserved installation id, never an installation's) reads `system.noProducer` there
 * (S9). The simulated lane is unchanged: the chip and every model value stay.
 * Audit row CS2 (U-14c): the S9 rule is the one reader `useReportedCoreDeviceId` (shared `reportedCoreDeviceIdOf`), which the
 * shell top bar and the other surfaces that print the id read too.
 */
export function AboutPanel({ anchorId }: { anchorId: string }) {
  const { t } = useTranslation()
  const device = useSim(selectDevice)
  const about = useSim(selectAbout)
  const platformNotReported = usePlatformNotReported()
  const selfCapture = useSelfCaptureCore()
  // Row 105 (D25 N3, S7/S9): what a Core in its own capture has no producer for reads "Not reported"; the device id is its stored record unless that is the dataset's reserved id.
  const notReported = t('system.noProducer')
  const modelValue = (value: string): string => (selfCapture ? notReported : value)
  const reportedId = useReportedCoreDeviceId()
  // Fix wave J round three (JW-26): on a Core in its own capture `device.softwareVersion`, the identity's two
  // version fields and the update slice are the demonstration model's. They are not drawn there; the
  // components are listed by name with the versions the Core (operation 64) and this console state.
  const versions = useProductVersions(device.softwareVersion)
  const release = releaseInfo(device.softwareVersion)
  const drift = device.identity.coreSoftwareVersion !== device.softwareVersion || about.updateVersion !== device.softwareVersion

  const summary: { key: string; label: string; value: string; mono?: boolean }[] = [
    { key: 'deviceId', label: t('system.about.deviceId'), value: reportedId ?? notReported, mono: reportedId !== null },
    { key: 'room', label: t('system.about.room'), value: modelValue(device.room) },
    { key: 'model', label: t('system.about.model'), value: modelValue(device.productName) },
    ...(versions.modelVersion !== null ? [{ key: 'release', label: t('system.about.softwareRelease'), value: `v${versions.modelVersion}`, mono: true }] : []),
    { key: 'hardware', label: t('system.about.hardwareRevision'), value: modelValue(device.identity.chassisRevision), mono: !selfCapture },
    { key: 'slot', label: t('system.about.activeSlot'), value: selfCapture ? notReported : t('system.update.slot', { slot: about.slot }) },
    { key: 'ip', label: t('system.about.ipAddress'), value: modelValue(about.ip), mono: !selfCapture },
    { key: 'tz', label: t('system.about.timeZone'), value: t('common.time.zone', { offset: about.tz }) },
  ]

  return (
    <SystemPanel
      id="about"
      anchorId={anchorId}
      icon={Fingerprint}
      title={t('system.about.title')}
      action={
        // Row 105 (S8): the chip marks the model's values on the simulated lane only - never on a Core in its own capture.
        selfCapture ? undefined : (
          <Chip size="sm" variant="secondary" className="sys-sim-chip" data-testid="system-about-synthetic">
            <Chip.Label>{t('system.about.synthetic')}</Chip.Label>
          </Chip>
        )
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

      {versions.ownCore ? (
        <section className="sys-subsection" aria-label={t('web.waveJ3.versions.title')} data-testid="system-components">
          <h3 className="sys-subtitle">{t('web.waveJ3.versions.title')}</h3>
          <p className="sys-small" data-testid="system-components-source">{t('web.waveJ3.versions.source')}</p>
          <dl className="sys-identity">
            <ComponentVersionRows rows={versions.rows} rowClassName="sys-identity-row" valueClassName="sys-mono" testIdPrefix="system-component" />
          </dl>
        </section>
      ) : null}

      <div className="sys-about-split">
        <section className="sys-subsection" aria-label={t('system.about.identityTitle')}>
          <h3 className="sys-subtitle">{t('system.about.identityTitle')}</h3>
          <dl className="sys-identity">
            {IDENTITY_FIELDS.map((field) => (
              <div key={field} className="sys-identity-row">
                <dt>{t(`system.about.fields.${field}`)}</dt>
                {/* Closing pass J (D217 (7)): a Core that states `security.platformNotReported` reads no TPM - the row says so, not the dataset's model. */}
                {field === 'tpmModelFirmware' && platformNotReported ? (
                  <dd data-testid="system-about-tpm">{t('common.platformNotReported.value')}</dd>
                ) : versions.ownCore && field === 'coreSoftwareVersion' ? (
                  // JW-26: the Core's own statement (operation 64 `components.core`), never the model's field.
                  <dd className={versions.coreVersion === null ? undefined : 'sys-mono'} data-testid="system-about-coreSoftwareVersion">{versions.coreVersion ?? t('common.platformNotReported.value')}</dd>
                ) : versions.ownCore && field === 'tabletAppVersion' ? (
                  // JW-26: an app states its own version when it pairs; the list is on Paired Devices. The model's field is not it.
                  <dd data-testid="system-about-tabletAppVersion">{t('web.waveJ3.versions.pairedApps')}</dd>
                ) : selfCapture && (field === 'deviceCertificateId' || field === 'cameraModelFirmware') ? (
                  // Fix wave K (C-2): this Core reports no device certificate, and the camera record of the dataset ("Dual-lens IP camera DL-2") is not its source.
                  <dd data-testid={`system-about-${field}`}>{t('common.platformNotReported.value')}</dd>
                ) : selfCapture ? (
                  // Row 105 (D25 N3, S7): the serial number, hardware UUID, board revisions, BSP and provisioning record are the dataset's; this Core reports none.
                  <dd data-testid={`system-about-${field}`}>{notReported}</dd>
                ) : (
                  <dd className="sys-mono" title={device.identity[field]}>
                    {device.identity[field]}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </section>

        <section className="sys-subsection" aria-label={t('system.about.sbomTitle')} data-testid="system-sbom">
          <h3 className="sys-subtitle">{t('system.about.sbomTitle')}</h3>
          <dl className="sys-identity">
            {versions.modelVersion !== null ? (
              <div className="sys-identity-row">
                <dt>{t('system.about.softwareRelease')}</dt>
                <dd className="sys-mono">v{release.version}</dd>
              </div>
            ) : null}
            <div className="sys-identity-row">
              <dt>{t('system.about.buildId')}</dt>
              {/* Row 105 (D25 N3, S7): the build id, checksum and SBOM summary are the sim's `releaseInfo`; a Core in its own capture reports none of them. */}
              <dd className={selfCapture ? undefined : 'sys-mono'} data-testid="system-about-buildId">{selfCapture ? notReported : release.buildId}</dd>
            </div>
            <div className="sys-identity-row">
              <dt>{t('system.about.checksum')}</dt>
              <dd className={selfCapture ? undefined : 'sys-mono'} title={selfCapture ? undefined : release.checksum} data-testid="system-about-checksum">
                {selfCapture ? notReported : release.checksum}
              </dd>
            </div>
            <div className="sys-identity-row">
              <dt>{t('system.about.sbom')}</dt>
              <dd data-testid="system-about-sbom">{selfCapture ? notReported : t('system.about.sbomComponents', { count: release.components })}</dd>
            </div>
            <div className="sys-identity-row">
              <dt>{t('system.about.sbomFormat')}</dt>
              <dd data-testid="system-about-sbomFormat">{selfCapture ? notReported : release.format}</dd>
            </div>
            {/* JW-26: the drift check compares three version fields of the model; on a Core in its own capture none of them is a version of it. */}
            {versions.modelVersion !== null ? (
              <div className="sys-identity-row">
                <dt>{t('system.about.drift')}</dt>
                <dd>
                  <Chip size="sm" variant="soft" color={drift ? 'warning' : 'success'} className="sys-status-chip" data-testid="system-drift">
                    <Chip.Label>{drift ? t('system.about.driftFound') : t('system.about.driftNone')}</Chip.Label>
                  </Chip>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>
    </SystemPanel>
  )
}
