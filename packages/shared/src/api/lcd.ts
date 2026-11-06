import { z } from 'zod';

/** Read-only observations of the optional local HTTP -> ESP32 bridge. */
export const LcdIntegrationStatusSchema = z.object({
  backendUrl: z.string().url(),
  reachable: z.boolean(),
  panelConnected: z.boolean().nullable(),
  lastSyncAt: z.number().int().nonnegative().nullable(),
  health: z.enum(['ok', 'warn', 'fail']).nullable(),
  error: z.enum(['UNAVAILABLE', 'INVALID_RESPONSE', 'CORE_NOT_READY']).nullable(),
  channels: z.array(z.object({
    channel: z.number().int().min(1).max(4),
    track: z.enum(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04']).nullable(), // D60 (2026-11-04): four recorded tracks
    /** Dua trek dari satu kamera dual-lens berbagi perangkat yang sama (OD-05). */
    deviceId: z.string().nullable().optional(),
    recording: z.boolean(),
    cameraConnected: z.boolean(),
  })).max(4),
});
export type LcdIntegrationStatus = z.output<typeof LcdIntegrationStatusSchema>;
