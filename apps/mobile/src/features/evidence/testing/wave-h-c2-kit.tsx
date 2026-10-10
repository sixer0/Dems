/**
 * Test-only helpers of the wave H C2 tests (gate findings of gates 81 / 89 / 94). Never import it
 * from app code.
 *
 * The items are the engine's own items with the members a Core states for them, shaped as the
 * contract's `EvidenceItemSchema` accepts them (the fake transport checks every answer):
 *   `contractDetail`  a `getEvidence` 200 example of the shared contract, unmodified (reconcile pass R:
 *                     what a real item looks like is the CONTRACT's, never a hand-written object);
 *   `realItem`        a recording THIS Core sealed, on an item of the engine: the members that make it
 *                     one are TAKEN FROM the contract's `productSealed` example;
 *   `seedSealedDemo`  a demo item whose v2 package the seed sealed into this Core's store (the
 *                     contract's `seedSealedDemo` example: DEMO_PACKAGE with `sealedPackage`);
 *   the engine's item as it is: a v1 / simulated demo item.
 */
import { act, screen } from '@testing-library/react-native';
import { CORE_API_EXAMPLES, EvidenceDetailSchema, type EvidenceDetail } from '@dems/shared/api';
import type { EvidenceItem } from '@dems/shared/sim';
import { renderLiveEvidence, type LiveEvidenceBed, type LiveEvidenceBedOptions } from './live-evidence-bed';

export const H = (char: string): string => char.repeat(64);
export const CORE_KEY = 'CORE-KEY-EVSIGN-01';

export type ItemChange = (item: EvidenceItem) => EvidenceItem;

export type ContractItemName = 'withPackage' | 'productSealed' | 'productSealedInterrupted' | 'productSealedOneCamera' | 'noMedia' | 'outsideCaseScope' | 'seedSealedDemo';
/** A `getEvidence` 200 example of the contract, checked against the strict schema of operation 40; a fresh copy. */
export function contractDetail(name: ContractItemName): EvidenceDetail {
  const example = (CORE_API_EXAMPLES.getEvidence?.responses[200] as Record<string, { value: unknown }> | undefined)?.[name];
  if (example === undefined) throw new Error(`the contract has no getEvidence 200 example "${name}"`);
  return EvidenceDetailSchema.parse(JSON.parse(JSON.stringify(example.value)));
}
export const contractDetailNames = (): string[] => Object.keys(CORE_API_EXAMPLES.getEvidence?.responses[200] ?? {});

const CAMERA_FILES = ['VIDEO-01', 'VIDEO-02'] as const;
const fileOf = (trackId: string) => ({ trackId, fileName: `fragments/${trackId}.mp4`, sizeBytes: 3_500, sha256: H(trackId === 'VIDEO-01' ? 'a' : 'b'), fragmentCount: 5 });

/** A recording this Core sealed. `cameras`: the camera files of the package (1 or 2); `files: false` leaves the `files` member out. */
export const realItem =
  (more: Record<string, unknown> = {}, options: { cameras?: readonly string[]; files?: boolean } = {}): ItemChange =>
  (item) => {
    const cameras = options.cameras ?? CAMERA_FILES;
    const sealed = contractDetail('productSealed').evidence;
    // `developmentKey` is left to the case (the key-class cases state each of its values).
    const { developmentKey: _developmentKey, ...signature } = sealed.signature as Record<string, unknown>;
    return {
      ...item,
      durationMs: 8_000,
      status: 'SEALED',
      integritySource: sealed.integritySource,
      manifestVersion: sealed.manifestVersion,
      developmentSources: sealed.developmentSources,
      sealedPackage: sealed.sealedPackage,
      tampered: false,
      tamperedTrackId: null,
      tracks: item.tracks.filter((track) => cameras.includes(track.trackId)),
      ...(options.files === false ? {} : { files: cameras.map(fileOf) }),
      signature,
      transcriptSha256: sealed.transcriptSha256,
      labelsStatus: sealed.labelsStatus,
      ...more,
    } as unknown as EvidenceItem;
  };

/** A demo item the seed sealed into this Core's store (pass E3; D205): DEMO_PACKAGE with `sealedPackage`, as the contract's `seedSealedDemo` example states it. */
export const seedSealedDemo = (more: Record<string, unknown> = {}): ItemChange => realItem({ integritySource: contractDetail('seedSealedDemo').evidence.integritySource, ...more }, { files: false });

export interface Opened {
  readonly b: LiveEvidenceBed;
  readonly id: string;
}

/** The Live bed with the engine's item `suffix` changed before the device signs in. */
export async function bedWith(suffix: string, change: ItemChange | null, options: LiveEvidenceBedOptions = {}): Promise<Opened> {
  const b = await renderLiveEvidence({
    ...options,
    setup: (engine) => {
      options.setup?.(engine);
      if (change === null) return;
      const state = engine.sim.store.getState();
      engine.sim.store.setState({ evidence: state.evidence.map((item) => (item.id.endsWith(`-${suffix}`) ? change(item) : item)) });
    },
  });
  // An item with sealed files mounts the transcript pane, which reads operation 84: "not ready" unless a test scripts it.
  b.fake.answer('getTranscript', () => b.fake.example('getTranscript', 409));
  return { b, id: b.idOf(suffix) };
}

/** Opens the item (the pushed detail on a phone, the detail pane on a tablet) and waits for operation 40's answer to be drawn. */
export async function openItem(b: LiveEvidenceBed, id: string): Promise<void> {
  await b.navigate(`/evidence/${id}`);
  for (let turn = 0; turn < 20 && screen.queryByTestId('evidence-media-checking') !== null; turn += 1) await b.flush();
  await b.flush();
}

function collect(node: unknown, texts: string[]): void {
  if (typeof node === 'string') texts.push(node);
  else if (Array.isArray(node)) for (const child of node) collect(child, texts);
  else if (typeof node === 'object' && node !== null) collect((node as { children?: unknown }).children, texts);
}

/** Every text drawn below a test ID, joined. */
export function textUnder(testID: string): string {
  const texts: string[] = [];
  collect(screen.getByTestId(testID), texts);
  return texts.join(' | ');
}

/** Every text on the screen, joined. */
export function allText(): string {
  const texts: string[] = [];
  collect(screen.UNSAFE_root, texts);
  return texts.join(' | ');
}

export async function settleUi(b: LiveEvidenceBed): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
  await b.flush();
}
