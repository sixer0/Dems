/**
 * Display names for the page's devices and rear-panel ports, all from i18n (no simulator English
 * strings on screen; review 40 m4).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { DeviceId, RearPortId } from './sim-adapter'

export interface DeviceLabels {
  /** Short name (banner, drawer title, toasts). */
  name: (id: DeviceId) => string
  /** Long name (MIC 1 - Interviewer (Ch 1)). */
  fullName: (id: DeviceId) => string
  /** What kind of device it is (drawer subtitle). */
  kind: (id: DeviceId) => string
  port: (id: RearPortId) => string
}

export function useDeviceLabels(): DeviceLabels {
  const { t } = useTranslation()
  return useMemo<DeviceLabels>(() => {
    const name = (id: DeviceId): string => {
      switch (id) {
        case 'CAM-01':
          return t('common.devices.camera1')
        case 'CAM-02':
          return t('common.devices.camera2')
        case 'MIC-01':
          return t('common.devices.mic1')
        case 'MIC-02':
          return t('common.devices.mic2')
        case 'POE-SWITCH':
          return t('devices.other.poeSwitch')
        case 'REC-INDICATOR':
          return t('devices.other.recordingIndicator')
        case 'TABLET':
          return t('devices.other.tabletControl')
        case 'GNSS':
          return t('devices.other.gnss')
        case 'TPM':
          return t('devices.other.tpm')
        case 'FRONT-PANEL':
          return t('devices.front.title')
      }
    }
    const fullName = (id: DeviceId): string => {
      if (id === 'MIC-01') return t('devices.audio.mic1')
      if (id === 'MIC-02') return t('devices.audio.mic2')
      return name(id)
    }
    const kind = (id: DeviceId): string => {
      switch (id) {
        case 'CAM-01':
        case 'CAM-02':
          return t('devices.drawer.kind.camera')
        case 'MIC-01':
        case 'MIC-02':
          return t('devices.drawer.kind.microphone')
        case 'POE-SWITCH':
          return t('devices.drawer.kind.poe')
        case 'REC-INDICATOR':
          return t('devices.drawer.kind.relay')
        case 'TABLET':
          return t('devices.drawer.kind.tablet')
        case 'GNSS':
          return t('devices.drawer.kind.gnss')
        case 'TPM':
          return t('devices.drawer.kind.tpm')
        case 'FRONT-PANEL':
          return t('devices.drawer.kind.panel')
      }
    }
    const port = (id: RearPortId): string => {
      switch (id) {
        case 'AC_INPUT':
          return t('devices.ports.acInput')
        case 'POE_CAM_1':
          return t('devices.ports.poeCam1')
        case 'POE_CAM_2_AUX':
          return t('devices.ports.poeCam2')
        case 'MGMT_LAN':
          return t('devices.ports.mgmtLan')
        case 'MIC_IN_1':
          return t('devices.ports.micIn1')
        case 'MIC_IN_2':
          return t('devices.ports.micIn2')
        case 'GNSS_SMA':
          return t('devices.ports.gnssSma')
        case 'RELAY_IO':
          return t('devices.ports.relayIo')
        case 'SERVICE_USB':
          return t('devices.ports.serviceUsb')
      }
    }
    return { name, fullName, kind, port }
  }, [t])
}
