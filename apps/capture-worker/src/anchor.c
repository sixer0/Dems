/* See anchor.h. */
#include "anchor.h"

#include <math.h>
#include <string.h>

#define US 1000000LL

void anchor_start(Anchor *a, int64_t seen_us, int64_t pts_us) {
    a->anchor_us = seen_us;
    a->ref_pts_us = pts_us;
}

int64_t anchor_follow(Anchor *a, int64_t seen_us, int64_t pts_us) {
    int64_t room = (pts_us - a->ref_pts_us) * SLEW_US_PER_S / US, step = seen_us - a->anchor_us;
    /* The allowance is counted from the last packet, used or not. */
    if (pts_us > a->ref_pts_us) a->ref_pts_us = pts_us;
    if (room < 0) room = 0;
    if (step > room) step = room;
    if (step < -room) step = -room;
    a->anchor_us += step;
    return step;
}

void anchor_tick(Anchor *a, int64_t pts_us) {
    if (pts_us > a->ref_pts_us) a->ref_pts_us = pts_us;
}

void trend_init(ClockTrend *t) {
    memset(t, 0, sizeof *t);
    t->bucket_index = -1;
}

static void trend_close_bucket(ClockTrend *t) {
    /* The finished second enters the fit with its best arrival only. */
    int at = (int)(t->bucket_index % CLOCK_WINDOW_S);
    if (t->bucket_index < 0 || !t->bucket_set[at]) return;
    double x = (double)t->bucket_index, y = t->bucket_min[at];
    if (t->n == 0) t->x0 = x;
    x -= t->x0;
    t->n += 1; t->sx += x; t->sy += y; t->sxx += x * x; t->sxy += x * y;
    t->last_x = x;
    /* The baseline: the best arrival of the first seconds (R-2). Seconds without a packet do not count. */
    if (t->baseline_seconds < CLOCK_BASELINE_S) {
        if (!t->baseline_seconds || y < t->baseline_ms) t->baseline_ms = y;
        t->baseline_seconds++;
    }
}

void trend_add(ClockTrend *t, double x_s, double lag_ms) {
    int64_t second = (int64_t)floor(x_s);
    if (second < 0) second = 0;
    if (second != t->bucket_index) {
        trend_close_bucket(t);
        /* Seconds without a packet (a stall) leave their buckets empty. */
        for (int64_t s = t->bucket_index + 1; s <= second && s - t->bucket_index <= CLOCK_WINDOW_S; s++) t->bucket_set[s % CLOCK_WINDOW_S] = 0;
        if (second - t->bucket_index > CLOCK_WINDOW_S) memset(t->bucket_set, 0, sizeof t->bucket_set);
        t->bucket_index = second;
    }
    int at = (int)(second % CLOCK_WINDOW_S);
    if (!t->bucket_set[at] || lag_ms < t->bucket_min[at]) { t->bucket_min[at] = lag_ms; t->bucket_set[at] = 1; }
    t->last_lag_ms = lag_ms;
}

double trend_window_lag_ms(const ClockTrend *t) {
    double best = 0;
    int any = 0;
    for (int i = 0; i < CLOCK_WINDOW_S; i++)
        if (t->bucket_set[i] && (!any || t->bucket_min[i] < best)) { best = t->bucket_min[i]; any = 1; }
    return any ? best : 0;
}

double trend_baseline_ms(const ClockTrend *t, int *learnt) {
    *learnt = t->baseline_seconds >= CLOCK_BASELINE_S;
    return *learnt ? t->baseline_ms : 0;
}

int trend_near_bound(const ClockTrend *t) {
    int learnt;
    double base = trend_baseline_ms(t, &learnt);
    return learnt && fabs(trend_window_lag_ms(t) - base) >= CLOCK_NEAR_BOUND_MS;
}

int clock_lag_sane(double lag_ms, double held_ms) {
    if (held_ms < 0) held_ms = 0;
    return lag_ms >= -CLOCK_SANITY_MS && lag_ms <= CLOCK_SANITY_MS + held_ms;
}

double trend_ppm(const ClockTrend *t, int *fitted) {
    double den = t->n * t->sxx - t->sx * t->sx;
    *fitted = t->last_x >= CLOCK_TREND_MIN_SPAN_S && den > 0;
    return *fitted ? (t->n * t->sxy - t->sx * t->sy) / den * 1000.0 : 0;     /* ms per second -> ppm */
}
