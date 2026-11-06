/**
 * One-line summaries of the design book §11.3 manifest fields for the Metadata tab. Values are read
 * from the package's `manifest.json` exactly as stored; unknown shapes fall back to "—".
 */
import type { ManifestFieldKey } from '@dems/shared/demo-data'
import { formatWibDateTime, shortHash } from './model'

type Json = Record<string, unknown>

function obj(value: unknown): Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {}
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
}

function list(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(obj) : []
}

function when(iso: unknown): string {
  const ms = typeof iso === 'string' ? Date.parse(iso) : Number.NaN
  return Number.isFinite(ms) ? formatWibDateTime(ms) : '—'
}

function joinParts(...parts: string[]): string {
  const kept = parts.filter((part) => part.trim().length > 0)
  return kept.length > 0 ? kept.join(' · ') : '—'
}

export function summariseManifestField(key: ManifestFieldKey, manifest: Json): string {
  const value = manifest[key]
  switch (key) {
    case 'sessionId':
    case 'caseReference':
    case 'finalizationStatus':
      return str(value) || '—'
    case 'device': {
      const device = obj(value)
      const certificate = obj(device.certificate)
      return joinParts(str(device.deviceId), str(device.serialNumber), certificate.serialNumber ? `cert ${str(certificate.serialNumber)}` : '')
    }
    case 'operator': {
      const operator = obj(value)
      return joinParts(str(operator.displayName), str(operator.investigatorId), str(operator.role))
    }
    case 'subject': {
      const subject = obj(value)
      return joinParts(str(subject.name), str(subject.type))
    }
    case 'timestamps': {
      const stamps = obj(value)
      return `${when(stamps.startedAt)} – ${when(stamps.stoppedAt)} (UTC${str(stamps.timezone) || '+07:00'})`
    }
    case 'timeSource': {
      const source = obj(value)
      return joinParts(str(source.source), str(source.state), source.stratum !== undefined ? `stratum ${str(source.stratum)}` : '')
    }
    case 'cameras':
    case 'microphones':
      return list(value)
        .map((entry) => `${str(entry.trackId)} ${str(entry.deviceId)}`.trim())
        .join(' · ') || '—'
    case 'tracks':
      return list(value)
        .map((entry) => `${str(entry.trackId)} ${shortHash(str(entry.sha256), 6)}`.trim())
        .join(' · ') || '—'
    case 'encryption': {
      const encryption = obj(value)
      return joinParts(str(encryption.algorithm), encryption.applied === false ? 'declared, not applied (DEMO)' : '')
    }
    case 'signature': {
      const signature = obj(value)
      return joinParts(str(signature.algorithm), str(signature.keyId), str(signature.purpose))
    }
    default:
      return '—'
  }
}
