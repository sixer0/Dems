/*
 * Unit checks of anchor.c (blueprint row 58, fix round 1, navigator findings F-1 and F-5; row 60,
 * re-check finding R-1). `make -C apps/capture-worker unit`. Exit 0 only when every check holds.
 * With -DOLD_SLEW the slew rule is the one the navigator found (the reference advanced only when
 * a step was taken): the F-1 check must then FAIL - the red run of this test.
 * With -DNO_TICK a packet without a report does not advance the reference (the ingest as it was
 * before row 60): the R-1 check must then FAIL - its red run.
 * With -DFIRST_LIVE_ONLY the clock is judged on the first live packet alone (row 62's proposal, not
 * applied by row 59): the stalled camera of check (2e) is then given up - the red run of the clock
 * floor of row 71. With -DNO_FLOOR nothing is judged after anchoring (the worker of row 59): the
 * clock behind by 2.6 s of check (2e) is then recorded at a wrong time - its second red run.
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
#ifdef NO_TICK
#define tick(a, pts) ((void)(a), (void)(pts))
#else
#define tick anchor_tick
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

    /* R-1: 600 s of video packets that carry NO report (the ingest calls anchor_tick for each), then a report
     * that is 200 ms off. The quiet time is no allowance: one frame, 10 us. Without the tick: 200,000 us at once. */
    Anchor r1;
    anchor_start(&r1, 1000000000, 0);
    pts = 0;
    for (int k = 1; k <= 600 * 50; k++) { pts += FRAME; tick(&r1, pts); }
    CHECK(r1.anchor_us == 1000000000, "packets without a report moved the anchor");
    pts += FRAME;
    int64_t r1_first = follow(&r1, 1000200000, pts), r1_moved = r1_first, r1_largest = llabs(r1_first);
    for (int k = 2; k <= 50 * 10; k++) {
        pts += FRAME;
        if (k % 5) { tick(&r1, pts); continue; }          /* a report on every fifth packet only */
        int64_t step = follow(&r1, 1000200000, pts);
        if (llabs(step) > r1_largest) r1_largest = llabs(step);
        r1_moved += step;
    }
    CHECK(r1_first <= SLEW_US_PER_S * FRAME / 1000000, "R-1: first step after 600 s without a report: %lld us (allowed %lld)", (long long)r1_first, (long long)(SLEW_US_PER_S * FRAME / 1000000));
    CHECK(r1_largest <= 10, "R-1: largest step %lld us with a report on every fifth packet (one frame's allowance is 10)", (long long)r1_largest);
    CHECK(r1_moved > 0 && r1_moved <= SLEW_US_PER_S * 10, "R-1: moved %lld us in 10 s (allowed %d)", (long long)r1_moved, SLEW_US_PER_S * 10);
    /* A tick never moves the reference backwards (a camera whose pts restarts lower stays frozen until it passes it). */
    Anchor r2;
    anchor_start(&r2, 0, 1000000);
    tick(&r2, 500000);
    CHECK(follow(&r2, 100000, 1000000 + FRAME) <= 10, "R-1: a lower pts reopened the allowance");

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
    /* (2) R-2: a CORRECT clock behind a steady 35 ms encode-and-network delay is never near the bound (it read
     * true before the baseline existed), and its baseline is that delay. */
    trend_init(&t);
    near = 0;
    for (int k = 0; k < 50 * 60; k++) { trend_add(&t, k * 0.02, 35.0 + (k % 7) * 0.3); near += trend_near_bound(&t); }
    int learnt;
    double base = trend_baseline_ms(&t, &learnt);
    CHECK(near == 0, "a steady 35 ms delay set nearBound %d times", near);
    CHECK(learnt && fabs(base - 35.0) < 1.0, "baseline %.2f ms (learnt=%d), expected 35", base, learnt);
    /* (2b) the same camera, and its clock steps by +60 ms (lag -25) or -60 ms (lag +95) at second 20: near the
     * bound afterwards. Ahead is seen at once; behind once the window holds no older second (10 s). */
    for (int sign = -1; sign <= 1; sign += 2) {
        trend_init(&t);
        int first = -1, before = 0;
        for (int k = 0; k < 50 * 40; k++) {
            double x = k * 0.02;
            trend_add(&t, x, 35.0 + (x >= 20.0 ? sign * 60.0 : 0.0));
            if (x < 20.0) before += trend_near_bound(&t);
            else if (first < 0 && trend_near_bound(&t)) first = (int)x;
        }
        CHECK(before == 0, "step %+d ms: nearBound before the step on %d packets", sign * 60, before);
        CHECK(first >= 20 && first <= (sign < 0 ? 21 : 31), "step %+d ms at second 20: nearBound first at second %d", sign * 60, first);
        CHECK(trend_near_bound(&t), "step %+d ms: not near the bound at the end", sign * 60);
    }
    /* (2c) before the baseline is learnt the flag is false, whatever the lag. */
    trend_init(&t);
    near = 0;
    for (int k = 0; k < 50 * (CLOCK_BASELINE_S - 1); k++) { trend_add(&t, k * 0.02, 500.0); near += trend_near_bound(&t); }
    CHECK(near == 0, "nearBound before the baseline is learnt (%d packets)", near);
    /* (2d) F-6: the sanity bound at anchoring. A clock 10 s ahead or behind is refused; a 35 ms delay and a
     * packet that waited 900 ms inside the receiver are not; the wait is no allowance for a clock that is AHEAD. */
    CHECK(!clock_lag_sane(-10000.0, 0) && !clock_lag_sane(10000.0, 0), "a clock 10 s off passes the sanity bound");
    CHECK(clock_lag_sane(35.0, 0) && clock_lag_sane(-35.0, 0), "a 35 ms lag is refused");
    CHECK(clock_lag_sane(CLOCK_SANITY_MS + 900.0, 900.0) && !clock_lag_sane(CLOCK_SANITY_MS + 901.0, 900.0), "the wait inside the receiver is not allowed for exactly");
    CHECK(!clock_lag_sane(-CLOCK_SANITY_MS - 1.0, 5000.0), "a wait excuses a clock that is ahead");
    CHECK(clock_lag_sane(CLOCK_SANITY_MS, 0) && clock_lag_sane(-CLOCK_SANITY_MS, 0), "the bound itself is refused");
    /* (2e) Row 71, the clock floor (D127 (1)). `judge` is what the ingest does on the first packet that did not wait.
     *   case A  a camera with a CORRECT clock that stalls: its first packets arrive on time (lag 20 ms; the one at
     *           anchoring had waited 300 ms), then it freezes 4 s and every later packet comes 3.9 to 4.1 s late
     *           (`p4_stall_pinned`). It must be KEPT.
     *   case B  a clock 2.6 s BEHIND: at anchoring the packet had waited 0.25 s of an allowance of 0.9 s (lag 2,850 ms,
     *           inside 2,000 + 900: the anchoring check passes - the gap of row 59). No packet ever has a lag below
     *           2,600 ms. It must be GIVEN UP on the first live packet.
     *   case C  a clock 2.5 s AHEAD whose packet at anchoring had waited 0.8 s (lag -1,700 ms: passes). GIVEN UP.
     *   case D  a healthy camera behind 35 ms of delay. KEPT. */
    {
        struct { const char *name; double lag_at_anchor, held_at_anchor, early[3], live[3]; int n_early; int keep; } cases[] = {
            { "A stalled, correct clock", 320.0, 300.0, { 20.0, 22.0, 19.0 }, { 3900.0, 4100.0, 3950.0 }, 3, 1 },
            { "B clock 2.6 s behind",     2850.0, 900.0, { 2610.0, 2605.0, 0 }, { 2600.0, 2604.0, 2602.0 }, 2, 0 },
            { "C clock 2.5 s ahead",      -1700.0, 800.0, { -2480.0, 0, 0 }, { -2495.0, -2490.0, -2493.0 }, 1, 0 },
            { "D healthy, 35 ms",         335.0, 300.0, { 36.0, 35.0, 37.0 }, { 35.0, 36.0, 35.5 }, 3, 1 },
        };
        for (unsigned i = 0; i < sizeof cases / sizeof cases[0]; i++) {
            ClockFloor f;
            clock_floor_init(&f);
            CHECK(clock_floor_sane(&f), "%s: an empty floor is refused", cases[i].name);
            CHECK(clock_lag_sane(cases[i].lag_at_anchor, cases[i].held_at_anchor), "%s: refused at anchoring already (the case does not exercise the floor)", cases[i].name);
            clock_floor_add(&f, cases[i].lag_at_anchor);
            for (int k = 0; k < cases[i].n_early; k++) clock_floor_add(&f, cases[i].early[k]);
            clock_floor_add(&f, cases[i].live[0]);
#if defined(FIRST_LIVE_ONLY)
            int kept = clock_lag_sane(cases[i].live[0], 0);
#elif defined(NO_FLOOR)
            int kept = 1;
#else
            int kept = clock_floor_sane(&f);
#endif
            CHECK(kept == cases[i].keep, "%s: %s on the first live packet (floor %.1f ms over %d packets)", cases[i].name, kept ? "KEPT" : "GIVEN UP", f.min_lag_ms, f.packets);
        }
    }
    /* (3) a drift of 3.5 ms per second: the lag is 30 ms above its 5 ms baseline at second 8.6; the flag follows at most one window
     * (10 s) later, because it reads the BEST arrival of the window (what keeps a stall out). The trend says 3,500 ppm. */
    trend_init(&t);
    int at = -1, fitted;
    for (int k = 0; k < 50 * 20; k++) { double x = k * 0.02; trend_add(&t, x, 5.0 + 3.5 * x); if (at < 0 && trend_near_bound(&t)) at = (int)x; }
    CHECK(at >= 8 && at <= 19, "drift 3.5 ms/s: nearBound first at second %d (expected 8 to 19: 30 ms above the 5 ms baseline at second 8.6)", at);
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
