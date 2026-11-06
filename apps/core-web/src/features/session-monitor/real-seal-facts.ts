/** What a REAL sealed item states about its seal (fix wave K, G89b-05). */
export interface RealSealFacts {
  readonly manifestHash: string | null
  readonly algorithm: string
  readonly keyId: string
  /** `true`: the Core says the key is a development key. */
  readonly developmentKey: boolean
  /** `true`: the Core recorded that the item has development sources. */
  readonly developmentSources: boolean
}

/**
 * The seal facts of an item THIS CORE sealed for real (fix wave K, G89b-05): `integritySource: REAL`
 * and a signature that is not the simulated stand-in. null for a simulated or demonstration item:
 * those keep the DEMO / simulated block as it was.
 */
export function realSealFactsOf(item: unknown): RealSealFacts | null {
  if (typeof item !== 'object' || item === null) return null
  const source = item as { integritySource?: unknown; manifestHash?: unknown; developmentSources?: unknown; signature?: { keyId?: unknown; algorithm?: unknown; simulated?: unknown; developmentKey?: unknown } | null }
  const signature = source.signature
  if (source.integritySource !== 'REAL' || typeof signature !== 'object' || signature === null || signature.simulated !== false) return null
  if (typeof signature.keyId !== 'string' || signature.keyId === '' || typeof signature.algorithm !== 'string') return null
  return {
    manifestHash: typeof source.manifestHash === 'string' && source.manifestHash !== '' ? source.manifestHash : null,
    algorithm: signature.algorithm,
    keyId: signature.keyId,
    developmentKey: signature.developmentKey === true,
    developmentSources: source.developmentSources === true,
  }
}
