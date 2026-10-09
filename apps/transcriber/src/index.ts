/**
 * `@dems/transcriber` — the transcriber of the DEMS Core (blueprint row 76 / M6-W1).
 *
 * Row 76 delivered the adapter seam, its two backends, the single key-loader, the CPU priority
 * rule, the connection probe and the fixture provider. Row 77 (M6-W2) adds the pipeline under
 * `./pipeline`: audio intake, Silero VAD chunking, STT per chunk, the phantom-tail clamp, media
 * time, chunk checkpoints with resume and the mirror port of `transcript_chunks`. Row 78 (M6-W3)
 * adds the diarization post-pass (`./pipeline/diarization`, 2 speakers, LABELLED or UNAVAILABLE),
 * the canonical `dems.transcript/1` document with its hash and renderings (`./pipeline/document`)
 * and the assembly step that writes them once (`./pipeline/assembly`).
 */
export * from './adapter';
export * from './config';
export * from './cpu-priority';
export * from './log';
export * from './probe';
export * from './types';
export * from './wav';
export {
  ENGINE_ENVIRONMENT,
  ENGINE_RECORD_FILE,
  NO_GPU_FLAG,
  buildWhisperCliArgs,
  checkCpuLocalFiles,
  createCpuLocalBackend,
  createEngineGuard,
  judgeAgainstCaptureWorker,
  type CaptureWorkerPid,
  type CaptureWorkerVerdict,
  type EngineGuard,
} from './backends/cpu-local';
export { LOOPBACK_ADDRESS, OMLX_PATHS, connectionTarget, createOmlxHttp, type FetchLike, type OmlxHttp } from './backends/omlx-http';
export { createOmlxServerBackend } from './backends/omlx-server';
export { detectPhysicalCores, type PhysicalCores } from './host/physical-cores';
export { CREDENTIAL_PLACEHOLDER, OMLX_CREDENTIAL_REF, loadCredential, type Credential, type CredentialOpener, type EncryptedCredentialSource } from './key-loader';
export * from './fixtures/tts-fixture-provider';
export * from './pipeline/assembly';
export * from './pipeline/audio-source';
export * from './pipeline/checkpoint';
export * from './pipeline/chunker';
export * from './pipeline/clamp';
export * from './pipeline/constants';
export * from './pipeline/diarization';
export * from './pipeline/document';
export * from './pipeline/media-time';
export * from './pipeline/mirror';
export * from './pipeline/runner';
export * from './pipeline/silero-vad';
