/*
 * Video anchoring arithmetic and the camera-clock telemetry (blueprint row 58, fix round 1,
 * navigator findings F-1 and F-5; capture spec F, erratum PE-111-01). Pure functions: no libav,
 * no clock, no global. `test/anchor_test.c` runs them (`make -C apps/capture-worker unit`).
 */
#ifndef DEMS_ANCHOR_H
#define DEMS_ANCHOR_H

#include <stdint.h>

/* The anchor moves by at most this many microseconds per second of media time. */
#define SLEW_US_PER_S 500
/* Telemetry flag: the camera's clock has MOVED this far against the host's since the session's baseline
 * (three quarters of the +-40 ms product bound). See trend_near_bound. */
#define CLOCK_NEAR_BOUND_MS 30.0
/* The first seconds of a camera's trend teach its baseline: the lag of a correct clock behind this
 * camera's steady encode and network delay (pair-58 navigator B, R-2; D85). */
#define CLOCK_BASELINE_S 5
/* Sanity bound on the camera's wall clock at anchoring (navigator B, F-6): no encode or network delay is
 * this long, so a lag beyond it is a wrong clock, and the camera is given up instead of recorded at a wrong time. */
#define CLOCK_SANITY_MS 2000.0
#define CLOCK_WINDOW_S 10
#define CLOCK_TREND_MIN_SPAN_S 10.0

typedef struct Anchor {
    int64_t anchor_us;          /* the camera's wall clock of pts 0, as applied */
    int64_t ref_pts_us;         /* media time of the last video packet seen, with or without a report */
} Anchor;

void anchor_start(Anchor *a, int64_t seen_us, int64_t pts_us);
/* A packet at `pts_us` whose report states the anchor `seen_us`. The applied anchor follows it
 * by at most SLEW_US_PER_S per second of media SINCE THE LAST REPORT: the allowance of a quiet
 * time is not saved up (F-1). Returns the step taken, in microseconds. */
int64_t anchor_follow(Anchor *a, int64_t seen_us, int64_t pts_us);
/* A packet at `pts_us` that carries NO report. It moves nothing, and it advances the reference:
 * media time that passed without a report is not an allowance either (pair-58 re-check R-1: with
 * the reference left where the last report was, 600 s without a report let the next report move
 * the anchor by 200,000 us in one step). The ingest calls one of the two for every video packet. */
void anchor_tick(Anchor *a, int64_t pts_us);

typedef struct ClockTrend {
    double bucket_min[CLOCK_WINDOW_S];  /* smallest lag of each of the last seconds, ms */
    int bucket_set[CLOCK_WINDOW_S];
    int64_t bucket_index;               /* second (of media time) of the newest bucket; -1 before the first */
    double n, sx, sy, sxx, sxy, x0, last_x, last_lag_ms;
    double baseline_ms;                 /* best arrival of the first CLOCK_BASELINE_S seconds that had a packet */
    int baseline_seconds;               /* how many seconds it has been learnt from; learnt at CLOCK_BASELINE_S */
} ClockTrend;

void trend_init(ClockTrend *t);
/* One packet: media time in seconds, lag = arrival time - camera time, in ms. */
void trend_add(ClockTrend *t, double x_s, double lag_ms);
/* The lag as the best arrival of the last CLOCK_WINDOW_S seconds states it: a late arrival (a
 * network stall) can only make a lag larger, so the minimum is what the clocks differ by. */
double trend_window_lag_ms(const ClockTrend *t);
/* The baseline lag of this camera, learnt at the start of the session; *learnt = 0 before it is. */
double trend_baseline_ms(const ClockTrend *t, int *learnt);
/* 1 when the window lag is CLOCK_NEAR_BOUND_MS or more away from the BASELINE: the camera's clock has
 * moved against the host's since the session started (a drift, or a step), as far as arrivals can tell.
 * 0 until the baseline is learnt. A steady delay never sets it, and a stall alone never sets it.
 * WHAT IT CANNOT SEE: an offset that was already there at the start is part of the baseline (it cannot
 * be told from a delay without a round trip). Gross ones are refused at anchoring: clock_lag_sane. */
int trend_near_bound(const ClockTrend *t);
/* The sanity bound at anchoring. lag_ms = arrival - camera time of a packet; held_ms = how long the
 * packet may have waited inside the receiver before it was handed over (waiting only makes a lag larger).
 * 1 when -CLOCK_SANITY_MS <= lag_ms <= CLOCK_SANITY_MS + held_ms. */
int clock_lag_sane(double lag_ms, double held_ms);
/* Fitted change of the per-second best lag in parts per million; 0 with *fitted = 0 before CLOCK_TREND_MIN_SPAN_S. */
double trend_ppm(const ClockTrend *t, int *fitted);

#endif
