/* See micwatch.h. */
#include "micwatch.h"

#include <math.h>
#include <string.h>

void micwatch_init(MicWatch *w, double silence_dbfs, int silence_ms, int disconnect_ms, int sample_rate) {
    memset(w, 0, sizeof *w);
    w->silence_dbfs = silence_dbfs;
    w->silence_samples = (int64_t)silence_ms * sample_rate / 1000;
    w->disconnect_samples = (int64_t)disconnect_ms * sample_rate / 1000;
    w->block_samples = (int64_t)MICWATCH_BLOCK_MS * sample_rate / 1000;
#ifdef MICWATCH_PROOF_NO_DEBOUNCE           /* TEST BUILD ONLY: a raiser that warns at once (the negative control of M5-WARN-1) */
    w->silence_samples = w->block_samples;
    w->disconnect_samples = 1;
#endif
}

int micwatch_chunk(MicWatch *w, int n, int present, double sumsq) {
    int events = 0;
    if (n <= 0) return 0;
    if (present <= 0) {
        w->absent_samples += n;
        if (!w->disconnected && w->absent_samples >= w->disconnect_samples) { w->disconnected = 1; events |= MW_DISCONNECT_BEGAN; }
        return events;
    }
    w->absent_samples = 0;
    if (w->disconnected) { w->disconnected = 0; events |= MW_DISCONNECT_ENDED; }
    /* The level of what was delivered, block by block. */
    w->block_sumsq += sumsq;
    w->block_n += present;
    if (w->block_n < w->block_samples) return events;
    /* 10 log10(mean square) <= threshold, without a logarithm of zero. */
    int quiet = w->block_sumsq <= (double)w->block_n * pow(10.0, w->silence_dbfs / 10.0);
    if (quiet) {
        w->quiet_samples += w->block_n;
        if (!w->silent && w->quiet_samples >= w->silence_samples) { w->silent = 1; events |= MW_SILENT_BEGAN; }
    } else {
        w->quiet_samples = 0;
        if (w->silent) { w->silent = 0; events |= MW_SILENT_ENDED; }
    }
    w->block_sumsq = 0;
    w->block_n = 0;
    return events;
}

int micwatch_rate(MicWatch *w, double ppm, double limit_ppm) {
    if (limit_ppm <= 0) return 0;
    double a = fabs(ppm);
    if (a >= limit_ppm * 0.999) {
        w->rate_inside = 0;
        if (++w->rate_at_limit >= MICWATCH_RATE_TICKS && !w->rate_limited) { w->rate_limited = 1; return MW_RATE_LIMIT_BEGAN; }
    } else {
        w->rate_at_limit = 0;
        if (a < limit_ppm * MICWATCH_RATE_CLEAR_PERMILLE / 1000.0) {
            if (++w->rate_inside >= MICWATCH_RATE_TICKS && w->rate_limited) { w->rate_limited = 0; return MW_RATE_LIMIT_ENDED; }
        } else w->rate_inside = 0;
    }
    return 0;
}
