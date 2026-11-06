/*
 * The microphone warning raiser (blueprint row 71; register NM-10; capture spec E.1; decisions
 * D84 R-1..R-4, D85 R-3, OD-11). Pure functions: no libav, no clock, no global, no output. The
 * clock is the AUDIO TIMELINE itself - samples of the session, one input chunk at a time - so a
 * test drives hours of it without waiting (`test/micwatch_test.c`, check M5-WARN-1).
 *
 * It only SAYS what it sees. It has no way to switch the audio source and returns nothing that
 * could: the selector is commanded in one place (audio.c), by the operator's command alone (OD-11).
 *
 *   silent        the microphone DELIVERS samples and their level stayed at or below the threshold
 *                 for the silence duration. The level is taken over blocks of MICWATCH_BLOCK_MS of
 *                 delivered samples (RMS); one block above the threshold ends the silence.
 *   disconnected  the microphone delivered NO sample for the disconnect debounce. One chunk with a
 *                 sample ends it. Time without samples is not silence: it neither counts toward
 *                 the silence duration nor ends a silence that was raised.
 *   rate limit    the rate controller asked for its limit (+-5,000 ppm) on MICWATCH_RATE_TICKS
 *                 ticks in a row: the microphone's clock is outside what the resampler absorbs, so
 *                 samples are being inserted or dropped. Ended by as many ticks below
 *                 MICWATCH_RATE_CLEAR_PERMILLE of the limit.
 * Every condition is raised once and cleared once; a later occurrence is raised again.
 */
#ifndef DEMS_MICWATCH_H
#define DEMS_MICWATCH_H

#include <stdint.h>

#define MICWATCH_BLOCK_MS 100
#define MICWATCH_RATE_TICKS 30              /* the controller ticks ten times a second: 3 s */
#define MICWATCH_RATE_CLEAR_PERMILLE 900

/* What one call saw begin or end (bits). */
#define MW_SILENT_BEGAN 1
#define MW_SILENT_ENDED 2
#define MW_DISCONNECT_BEGAN 4
#define MW_DISCONNECT_ENDED 8
#define MW_RATE_LIMIT_BEGAN 16
#define MW_RATE_LIMIT_ENDED 32

typedef struct MicWatch {
    double silence_dbfs;
    int64_t silence_samples, disconnect_samples, block_samples;
    double block_sumsq;
    int64_t block_n, quiet_samples, absent_samples;
    int rate_at_limit, rate_inside;
    int silent, disconnected, rate_limited;     /* the conditions that are raised now */
} MicWatch;

void micwatch_init(MicWatch *w, double silence_dbfs, int silence_ms, int disconnect_ms, int sample_rate);
/* One input chunk: `n` samples of the session's timeline passed, the microphone delivered `present`
 * of them (0..n) and the sum of the squares of those is `sumsq`. Returns the MW_ bits of what began or ended. */
int micwatch_chunk(MicWatch *w, int n, int present, double sumsq);
/* One tick of the rate controller: it asks for `ppm` and may ask for at most `limit_ppm` (<= 0: no controller). */
int micwatch_rate(MicWatch *w, double ppm, double limit_ppm);

#endif
