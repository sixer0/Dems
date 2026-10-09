/**
 * `@dems/transcriber` — the transcriber of the DEMS Core (blueprint row 76 / M6-W1).
 *
 * This row delivers the adapter seam, its two backends, the single key-loader, the CPU priority
 * rule, the connection probe and the fixture provider. VAD chunking, checkpoints, diarization and
 * document assembly are rows 77 and 78 and build on what is exported here.
 */
export * from './adapter';
export * from './config';
export * from './cpu-priority';
export * from './log';
export * from './probe';
export * from './types';
export * from './wav';
export { ENGINE_ENVIRONMENT, NO_GPU_FLAG, buildWhisperCliArgs, checkCpuLocalFiles, createCpuLocalBackend } from './backends/cpu-local';
export { LOOPBACK_ADDRESS, OMLX_PATHS, connectionTarget, createOmlxHttp, type FetchLike, type OmlxHttp } from './backends/omlx-http';
export { createOmlxServerBackend } from './backends/omlx-server';
export { detectPhysicalCores, type PhysicalCores } from './host/physical-cores';
export { CREDENTIAL_PLACEHOLDER, OMLX_CREDENTIAL_REF, loadCredential, type Credential } from './key-loader';
export * from './fixtures/tts-fixture-provider';
