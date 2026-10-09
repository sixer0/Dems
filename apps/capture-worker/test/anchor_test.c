/*
 * Unit checks of anchor.c (blueprint row 58, fix round 1, navigator findings F-1 and F-5).
 * `make -C apps/capture-worker unit`. Exit 0 only when every check holds.
 * With -DOLD_SLEW the slew rule is the one the navigator found (the reference advanced only when
 * a step was taken): the F-1 check must then FAIL - the red run of this test.
 */
#include "../src/anchor.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>

static int failed;
#define CHECK(cond, ...) do { if (!(cond)) { failed++; printf("FAIL %s:%d: ", __FILE__, __LINE__); printf(__VA_ARGS__); printf("\n"); } } while (0)

#ifdef OLD_SLEW
static int64_t follow(Anchor *a, int64_t seen, int64_t pts) {
    int64_t room = (pts - a->ref_pts_us) * SLEW_US_PER_S / 1000000, step = seen - a->anchor_us;
    if (room < 0) room = 0;
    if (step > room) step = room;
    if (step < -room) step = -room;
    a->anchor_us += step;
    if (step) a->ref_pts_us = pts;
    return step;
}
#else
#define follow anchor_follow
#endif

int main(void) {
    const int64_t FRAME = 20000;                         /* 50 fps */
    /* F-1: 600 s of unchanged reports, then the report jumps by +200 ms (navigator B's scenario). */
    Anchor a;
    anchor_start(&a, 1000000000, 0);
    int64_t pts = 0, largest = 0, moved = 0;
    for (int k = 1; k <= 600 * 50; k++) { pts += FRAME; largest = llabs(follow(&a, 1000000000, pts)) > largest ? llabs(follow(&a, 1000000000, pts)) : largest; }
    CHECK(largest == 0, "an unchanged report moved the anchor by %lld us", (long long)largest);
    int64_t first = 0;
    for (int k = 1; k <= 50 * 10; k++) {                 /* the next 10 s */
        pts += FRAME;
        int64_t step = follow(&a, 1000200000, pts);
        if (k == 1) first = step;
        if (llabs(step) > largest) largest = llabs(step);
        moved += step;
    }
    /* One frame of 20 ms may move the anchor by 500 us/s x 0.02 s = 10 us, never by the allowance of the quiet 600 s (300,000 us). */
    CHECK(first <= SLEW_US_PER_S * FRAME / 1000000, "first step after a quiet time: %lld us (allowed %lld)", (long long)first, (long long)(SLEW_US_PER_S * FRAME / 1000000));
    CHECK(largest <= 10, "largest step %lld us", (long long)largest);
    CHECK(moved > 0 && moved <= SLEW_US_PER_S * 10, "moved %lld us in 10 s (allowed %d)", (long long)moved, SLEW_US_PER_S * 10);
    /* A step back is limited the same way and the anchor reaches a report that stays. */
    Anchor b;
    anchor_start(&b, 5000, 0);
    pts = 0;
    for (int k = 0; k < 50 * 30; k++) { pts += FRAME; int64_t s = follow(&b, 0, pts); CHECK(s <= 0 && s >= -10, "backward step %lld", (long long)s); }
    CHECK(b.anchor_us == 0, "after 30 s the anchor is %lld, expected 0 (5,000 us at 500 us/s = 10 s)", (long long)b.anchor_us);
    /* CONTROL: a report that never changes costs nothing however long it lasts. */
    Anchor c;
    anchor_start(&c, 42, 0);
    for (int k = 1; k < 1000; k++) CHECK(follow(&c, 42, k * FRAME) == 0, "moved without a change");

    /* F-5: nearBound. (1) a 4 s network stall alone: arrivals 4 s late, then normal. Never near the bound. */
    ClockTrend t;
    trend_init(&t);
    int near = 0;
    for (int k = 0; k < 50 * 30; k++) {
        double x = k * 0.02, lag = 5.0;
        if (x >= 8 && x < 12) lag = 5.0 + (12.0 - x) * 1000.0;      /* the frames of the stall arrive together at second 12 */
        trend_add(&t, x, lag);
        if (x >= 12.0 && trend_near_bound(&t)) near++;
    }
    CHECK(near == 0, "a stall alone set nearBound on %d packets (window lag %.1f ms)", near, trend_window_lag_ms(&t));
    /* (2) a camera whose clock is 10 s ahead, and one 10 s behind: near the bound at once. */
    for (int sign = -1; sign <= 1; sign += 2) {
        trend_init(&t);
        for (int k = 0; k < 100; k++) trend_add(&t, k * 0.02, sign * 10000.0 + 5.0);
        CHECK(trend_near_bound(&t), "clock %+d s off: nearBound false (window lag %.1f ms)", sign * 10, trend_window_lag_ms(&t));
    }
    /* (3) a drift of 3.5 ms per second: the lag passes 30 ms at second 7; the flag follows at most one window
     * (10 s) later, because it reads the BEST arrival of the window (what keeps a stall out). The trend says 3,500 ppm. */
    trend_init(&t);
    int at = -1, fitted;
    for (int k = 0; k < 50 * 20; k++) { double x = k * 0.02; trend_add(&t, x, 5.0 + 3.5 * x); if (at < 0 && trend_near_bound(&t)) at = (int)x; }
    CHECK(at >= 7 && at <= 17, "drift 3.5 ms/s: nearBound first at second %d (expected 7 to 17)", at);
    double ppm = trend_ppm(&t, &fitted);
    CHECK(fitted && fabs(ppm - 3500.0) < 50.0, "fitted %.1f ppm (fitted=%d), expected 3,500", ppm, fitted);
    /* CONTROL: a healthy camera (5 ms of network lag, 2 ms of jitter) is never near the bound. */
    trend_init(&t);
    near = 0;
    for (int k = 0; k < 50 * 60; k++) { trend_add(&t, k * 0.02, 5.0 + (k % 7) * 0.3); near += trend_near_bound(&t); }
    CHECK(near == 0, "a healthy camera set nearBound %d times", near);

    printf(failed ? "anchor_test: %d check(s) FAILED\n" : "anchor_test: all checks hold\n", failed);
    return failed ? 1 : 0;
}
