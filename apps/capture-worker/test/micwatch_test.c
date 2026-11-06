/*
 * M5-WARN-1 (blueprint row 71; test strategy "silence warning never auto-switches"; capture spec
 * E.1; OD-11): the microphone warning raiser on a FAKE CLOCK. The clock is the audio timeline -
 * 480-sample chunks - so 10 s of silence is 1,000 calls and no wall time.
 * `make -C apps/capture-worker unit`. Exit 0 only when every check holds.
 * With -DMICWATCH_PROOF_NO_DEBOUNCE (src/micwatch.c) the raiser warns at once: this test must then
 * FAIL - its red run.
 *
 * "Never an automatic switch" has two halves. Here: the raiser's whole output is the six event
 * bits of micwatch.h; none of them is a switch, and the test holds the returned bits to that set.
 * In the worker: the e2e check `m5warn` holds that a session with a silent and a disconnected
 * microphone writes no AUDIO_SOURCE_INTERVAL record beyond the one of the start.
 */
#include "../src/micwatch.h"

#include <math.h>
#include <stdio.h>

#define SR 48000
#define CHUNK 480
static int failed;
#define CHECK(cond, ...) do { if (!(cond)) { failed++; printf("FAIL %s:%d: ", __FILE__, __LINE__); printf(__VA_ARGS__); printf("\n"); } } while (0)

static int all_bits;
/* `chunks` chunks at `dbfs` (delivered) or without samples (dbfs > 0). Returns the events seen; *at = the chunk (from 1) of the first. */
static int feed(MicWatch *w, int chunks, double dbfs, int *at) {
    int seen = 0;
    double sumsq = dbfs > 0 ? 0 : CHUNK * pow(10.0, dbfs / 10.0);
    if (at) *at = 0;
    for (int i = 1; i <= chunks; i++) {
        int e = micwatch_chunk(w, CHUNK, dbfs > 0 ? 0 : CHUNK, sumsq);
        if (e && at && !*at) *at = i;
        seen |= e;
    }
    all_bits |= seen;
    return seen;
}
#define ABSENT 1.0

int main(void) {
    MicWatch w;
    int at, e;
    /* (1) -50 dBFS for 10 s: 9.9 s raise nothing, the chunk that completes 10.0 s raises MIC_SILENT, once. */
    micwatch_init(&w, -50.0, 10000, 2000, SR);
    e = feed(&w, 200, -20.0, NULL);
    CHECK(e == 0, "speech raised %d", e);
    e = feed(&w, 990, -55.0, NULL);
    CHECK(e == 0 && !w.silent, "9.9 s of silence raised %d", e);
    e = feed(&w, 10, -55.0, &at);
    CHECK(e == MW_SILENT_BEGAN && at == 10 && w.silent, "the 10th second of silence: events %d at chunk %d", e, at);
    e = feed(&w, 3000, -55.0, NULL);
    CHECK(e == 0 && w.silent, "30 s more of the same silence raised %d again", e);
    /* The level returns: cleared within one block. A second episode is raised again (a new fault for the Core: D84 R-3). */
    e = feed(&w, 10, -20.0, &at);
    CHECK(e == MW_SILENT_ENDED && at == 10 && !w.silent, "the level returned: events %d at chunk %d", e, at);
    e = feed(&w, 999, -60.0, NULL);
    CHECK(e == 0, "9.99 s of a second silence raised %d", e);
    e = feed(&w, 1, -60.0, NULL);
    CHECK(e == MW_SILENT_BEGAN, "the second episode: events %d", e);
    /* (2) the threshold itself is silence (at or below), 0.1 dB above it is not; digital zero is silence. */
    micwatch_init(&w, -50.0, 10000, 2000, SR);
    CHECK(feed(&w, 1000, -50.0, NULL) == MW_SILENT_BEGAN, "exactly -50 dBFS for 10 s did not raise");
    micwatch_init(&w, -50.0, 10000, 2000, SR);
    CHECK(feed(&w, 6000, -49.9, NULL) == 0, "-49.9 dBFS for 60 s raised");
    micwatch_init(&w, -50.0, 10000, 2000, SR);
    for (e = 0, at = 0; at < 1000; at++) e |= micwatch_chunk(&w, CHUNK, CHUNK, 0.0);
    CHECK(e == MW_SILENT_BEGAN, "10 s of zeros: events %d", e);
    /* (3) a short sound inside the silence starts the 10 s again. */
    micwatch_init(&w, -50.0, 10000, 2000, SR);
    e = feed(&w, 900, -55.0, NULL) | feed(&w, 10, -20.0, NULL) | feed(&w, 990, -55.0, NULL);
    CHECK(e == 0, "9 s + a sound + 9.9 s raised %d", e);
    CHECK(feed(&w, 10, -55.0, NULL) == MW_SILENT_BEGAN, "10 s after the sound did not raise");
    /* (4) the 2 s disconnect debounce: 1.99 s without samples raise nothing; the chunk that completes 2 s does, once;
     * one chunk with samples clears it. */
    micwatch_init(&w, -50.0, 10000, 2000, SR);
    feed(&w, 100, -20.0, NULL);
    e = feed(&w, 199, ABSENT, NULL);
    CHECK(e == 0 && !w.disconnected, "1.99 s without samples raised %d", e);
    e = feed(&w, 1, ABSENT, NULL);
    CHECK(e == MW_DISCONNECT_BEGAN && w.disconnected, "the chunk that completes 2 s: events %d", e);
    CHECK(feed(&w, 5000, ABSENT, NULL) == 0, "a microphone that stays away is raised again");
    e = feed(&w, 1, -20.0, NULL);
    CHECK(e == MW_DISCONNECT_ENDED && !w.disconnected, "the first chunk with samples: events %d", e);
    /* a gap shorter than the debounce, again and again, never raises */
    for (int k = 0; k < 20; k++) { e = feed(&w, 150, ABSENT, NULL) | feed(&w, 1, -20.0, NULL); CHECK(e == 0, "a 1.5 s gap raised %d (round %d)", e, k); }
    /* (5) no samples is not silence: 60 s without samples never raise MIC_SILENT, and they do not end one. */
    micwatch_init(&w, -50.0, 10000, 2000, SR);
    e = feed(&w, 6000, ABSENT, NULL);
    CHECK(e == MW_DISCONNECT_BEGAN && !w.silent, "60 s without samples: events %d", e);
    micwatch_init(&w, -50.0, 10000, 2000, SR);
    feed(&w, 1000, -55.0, NULL);
    e = feed(&w, 1000, ABSENT, NULL);
    CHECK(e == MW_DISCONNECT_BEGAN && w.silent && w.disconnected, "a silent microphone that goes away: events %d", e);
    /* 9 s of silence, 5 s away, 0.9 s of silence: 9.9 s of DELIVERED silence, nothing raised but the disconnect and its end. */
    micwatch_init(&w, -50.0, 10000, 2000, SR);
    e = feed(&w, 900, -55.0, NULL) | feed(&w, 500, ABSENT, NULL) | feed(&w, 90, -55.0, NULL);
    CHECK(e == (MW_DISCONNECT_BEGAN | MW_DISCONNECT_ENDED), "silence around a gap: events %d", e);
    CHECK(feed(&w, 10, -55.0, NULL) == MW_SILENT_BEGAN, "the 10th second of delivered silence did not raise");
    /* (6) the settings are the caller's: 3 s and 500 ms. */
    micwatch_init(&w, -40.0, 3000, 500, SR);
    CHECK(feed(&w, 299, -45.0, NULL) == 0 && feed(&w, 1, -45.0, NULL) == MW_SILENT_BEGAN, "a 3 s setting is not honoured");
    CHECK(feed(&w, 49, ABSENT, NULL) == 0 && feed(&w, 1, ABSENT, NULL) == MW_DISCONNECT_BEGAN, "a 500 ms setting is not honoured");
    /* (7) the rate controller at its limit (D85 R-3): 2.9 s at the limit raise nothing, 3 s do, once; 2,000 ppm never;
     * cleared after 3 s below nine tenths of the limit; 4,800 ppm (inside, above nine tenths) neither raises nor clears. */
    micwatch_init(&w, -50.0, 10000, 2000, SR);
    e = 0;
    for (int k = 0; k < 600; k++) e |= micwatch_rate(&w, k % 2 ? 2000.0 : -2000.0, 5000.0);
    CHECK(e == 0, "a 2,000 ppm microphone raised %d", e);
    for (int k = 0; k < 29; k++) e |= micwatch_rate(&w, -5000.0, 5000.0);
    CHECK(e == 0 && !w.rate_limited, "2.9 s at the limit raised %d", e);
    e = micwatch_rate(&w, -5000.0, 5000.0);
    CHECK(e == MW_RATE_LIMIT_BEGAN && w.rate_limited, "3 s at the limit: events %d", e);
    all_bits |= e;
    for (int k = 0, again = 0; k < 600; k++) { again |= micwatch_rate(&w, 5000.0, 5000.0); CHECK(again == 0, "raised again at tick %d", k); if (again) break; }
    for (int k = 0; k < 600; k++) e = micwatch_rate(&w, 4800.0, 5000.0);
    CHECK(e == 0 && w.rate_limited, "4,800 ppm cleared the limit");
    for (int k = 0, c = 0; k < 30; k++) { c = micwatch_rate(&w, 1000.0, 5000.0); CHECK((k < 29 && c == 0) || (k == 29 && c == MW_RATE_LIMIT_ENDED), "tick %d inside the range: events %d", k, c); all_bits |= c; }
    CHECK(micwatch_rate(&w, 5000.0, 0.0) == 0, "a build without a controller raises a rate warning");
    /* (8) the raiser's whole vocabulary: the six bits, each seen above, and nothing else. */
    CHECK(all_bits == 63, "the events seen are %d, expected exactly the six of micwatch.h (63)", all_bits);

    printf(failed ? "micwatch_test: %d check(s) FAILED\n" : "micwatch_test: all checks hold (M5-WARN-1)\n", failed);
    return failed ? 1 : 0;
}
