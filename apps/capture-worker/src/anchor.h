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
/* Telemetry flag: the camera's clock is this far from the host's (three quarters of the +-40 ms product bound). */
#define CLOCK_NEAR_BOUND_MS 30.0
#define CLOCK_WINDOW_S 10
#define CLOCK_TREND_MIN_SPAN_S 10.0

typedef struct Anchor {
    int64_t anchor_us;          /* the camera's wall clock of pts 0, as applied */
    int64_t ref_pts_us;         /* media time of the last packet that carried a report */
} Anchor;

void anchor_start(Anchor *a, int64_t seen_us, int64_t pts_us);
/* A packet at `pts_us` whose report states the anchor `seen_us`. The applied anchor follows it
 * by at most SLEW_US_PER_S per second of media SINCE THE LAST REPORT: the allowance of a quiet
 * time is not saved up (F-1). Returns the step taken, in microseconds. */
int64_t anchor_follow(Anchor *a, int64_t seen_us, int64_t pts_us);

typedef struct ClockTrend {
    double bucket_min[CLOCK_WINDOW_S];  /* smallest lag of each of the last seconds, ms */
    int bucket_set[CLOCK_WINDOW_S];
    int64_t bucket_index;               /* second (of media time) of the newest bucket; -1 before the first */
    double n, sx, sy, sxx, sxy, x0, last_x, last_lag_ms;
} ClockTrend;

void trend_init(ClockTrend *t);
/* One packet: media time in seconds, lag = arrival time - camera time, in ms. */
void trend_add(ClockTrend *t, double x_s, double lag_ms);
/* The lag as the best arrival of the last CLOCK_WINDOW_S seconds states it: a late arrival (a
 * network stall) can only make a lag larger, so the minimum is what the clocks differ by. */
double trend_window_lag_ms(const ClockTrend *t);
/* 1 when the clocks differ by CLOCK_NEAR_BOUND_MS or more. A stall alone never sets it. */
int trend_near_bound(const ClockTrend *t);
/* Fitted change of the per-second best lag in parts per million; 0 with *fitted = 0 before CLOCK_TREND_MIN_SPAN_S. */
double trend_ppm(const ClockTrend *t, int *fitted);

#endif
