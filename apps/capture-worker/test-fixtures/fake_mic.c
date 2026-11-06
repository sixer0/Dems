/*
 * NM-14 fake microphones (blueprint row 60; first written for row 58): a SEPARATE PROCESS with
 * its own clock reads (capture spec A.2 W-5, A.8 "fixture requirements" (1); erratum PE-111-05)
 * and, with --ppm, its own SAMPLE clock. The beep half of the flash+beep generator. Test fixture
 * only. It opens no socket: its only outputs are the named pipes and the manifest it is given.
 *
 * It writes raw PCM (32-bit float, little-endian, 48 kHz, mono) into one to four named pipes (D61,
 * 2026-11-04: the four numbered microphone channels of a plan are recorded at once; was one or two),
 * one 10 ms chunk every 10 ms, the way a capture device hands samples over: chunk i is written when
 * its last sample has been "captured", at e0 + (i + 1) * 10 ms on this process's own clock.
 *
 *   mic 1  quiet noise (0.01, a fixed pseudo-random sequence) so that every encoder packet differs
 *          (pair-111 N-9: with silence only the packets of the beeps could tell two encoders apart), plus
 *          1 kHz bursts of 100 ms at 0.5 whose first sample is the first sample at or after each
 *          absolute instant of --beep-at-us, counted from e0 = this process's own read of the
 *          wall clock when it starts. Nothing the worker knows enters that placement.
 *   mic 2  880 Hz at 0.1 (audibly different from mic 1).
 *   mic 3  660 Hz at 0.1, mic 4  440 Hz at 0.1 (D61, 2026-11-04: the two further channels, each
 *          audibly different from every other row; the --stop2-after / --start2-after rule stays the
 *          lane's channel-2 rule).
 *
 * The manifest (JSON lines) states e0 and the onset sample of every beep: the truth an analyser
 * compares the recorded file against.
 *
 * THE BEEPS OF A PAIR (audit row 152b; D5 pairs, row 152, D135): a camera file carries its OWN pair's channel
 * (VIDEO-0N <-> MIC-0N), no longer one shared track, so the flash-to-beep check of camera N needs the beeps on
 * channel N. `--beep-on 1,2` puts the same bursts (same onset samples, the same manifest lines) on each named
 * channel: on channel 2 a burst REPLACES the 880 Hz tone for its 100 ms, as it replaces the noise on channel 1, and
 * the tone is held at zero for the 50 ms before the burst (the onset rule of av_analyse.py wants 50 ms below its
 * threshold, and the encoder's pre-echo of the burst then sits on near-silence, as on channel 1). The tone keeps its
 * phase across the gap (its samples are computed from the sample index). Default `1`: channel 1 only, as before (the
 * tone checks of channels 2..4 stay pure).
 *
 *   --ppm P             both mics' sample clock against the host (-2000 = 2,000 ppm slow, 100 = 100 ppm fast)
 *   --stop-at S --resume-at S    the device delivers nothing in between and then goes on (stop and return)
 *   --deliver-late-us D every chunk is handed over D microseconds after its instant: a constant
 *                       device latency the worker cannot know. Used as the control that the AV
 *                       check sees a capture latency (pair-58 F-4 (c): 5,000 us read as +5.01 ms).
 */
#include <errno.h>
#include <fcntl.h>
#include <math.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define SR 48000
#define CHUNK 480
#define US 1000000LL
#define MAX_BEEPS 256

static int64_t now_us(clockid_t c) { struct timespec t; clock_gettime(c, &t); return t.tv_sec * US + t.tv_nsec / 1000; }

static int write_all(int fd, const void *buf, size_t n) {
    const char *p = buf;
    while (n) {
        ssize_t w = write(fd, p, n);
        if (w < 0) { if (errno == EINTR) continue; return -1; }
        p += w;
        n -= (size_t)w;
    }
    return 0;
}

int main(int argc, char **argv) {
    const char *out[4] = { NULL, NULL, NULL, NULL }, *manifest_path = NULL;   /* D61: four channels */
    double seconds = 10, stop2_after = -1, start2_after = 0, ppm = 0, stop_at = -1, resume_at = -1;
    long long late_us = 0;
    int64_t beep_at[MAX_BEEPS], onset[MAX_BEEPS];
    int n_beeps = 0, beep_on[4] = { 1, 0, 0, 0 };          /* row 152b: the channels that carry the beeps */
    for (int i = 1; i + 1 < argc; i += 2) {
        const char *k = argv[i], *v = argv[i + 1];
        if (!strcmp(k, "--out1")) out[0] = v;
        else if (!strcmp(k, "--out2")) out[1] = v;
        else if (!strcmp(k, "--out3")) out[2] = v;                                  /* D61 (2026-11-04): channels 3 and 4 */
        else if (!strcmp(k, "--out4")) out[3] = v;
        else if (!strcmp(k, "--seconds")) seconds = atof(v);
        else if (!strcmp(k, "--manifest")) manifest_path = v;
        else if (!strcmp(k, "--stop2-after")) stop2_after = atof(v);        /* mic 2 falls silent (no samples) after this many seconds */
        else if (!strcmp(k, "--start2-after")) start2_after = atof(v);      /* mic 2 delivers nothing before this many seconds */
        else if (!strcmp(k, "--ppm")) ppm = atof(v);                        /* both mics' sample clock against the host: -2000 = 2,000 ppm SLOW */
        else if (!strcmp(k, "--stop-at")) stop_at = atof(v);                /* both mics deliver nothing from this second ... */
        else if (!strcmp(k, "--resume-at")) resume_at = atof(v);            /* ... to this one (the device stopped and came back) */
        else if (!strcmp(k, "--deliver-late-us")) late_us = atoll(v);        /* constant delivery delay of every chunk */
        else if (!strcmp(k, "--beep-on")) {                                 /* row 152b: e.g. "1,2" - each a channel 1..4 */
            beep_on[0] = beep_on[1] = beep_on[2] = beep_on[3] = 0;
            for (const char *c = v; *c; c++) {
                if (*c >= '1' && *c <= '4' && (c[1] == ',' || c[1] == 0)) beep_on[*c - '1'] = 1;
                else if (*c != ',') { fprintf(stderr, "FAKE_MIC bad --beep-on\n"); return 2; }
            }
        }
        else if (!strcmp(k, "--beep-at-us")) {
            for (const char *s = v; *s && n_beeps < MAX_BEEPS;) {
                char *end;
                beep_at[n_beeps++] = strtoll(s, &end, 10);
                if (end == s) { fprintf(stderr, "FAKE_MIC bad --beep-at-us\n"); return 2; }
                s = *end == ',' ? end + 1 : end;
            }
        } else { fprintf(stderr, "FAKE_MIC unknown argument %s\n", k); return 2; }
    }
    if (!out[0] || !manifest_path || seconds <= 0) {
        fprintf(stderr, "usage: fake_mic --out1 <fifo> [--out2 <fifo>] [--out3 <fifo>] [--out4 <fifo>] --manifest <file.jsonl> [--seconds S] [--beep-at-us t1,t2,...] [--stop2-after S] [--start2-after S] [--ppm P] [--stop-at S --resume-at S] [--deliver-late-us D] [--beep-on 1,2,...]\n");
        return 2;
    }
    signal(SIGPIPE, SIG_IGN);
    FILE *mf = fopen(manifest_path, "w");
    if (!mf) { fprintf(stderr, "FAKE_MIC cannot write the manifest\n"); return 1; }
    int fd[4] = { -1, -1, -1, -1 };                        /* D61 (2026-11-04): one per numbered channel */
    for (int m = 0; m < 4; m++) {
        if (!out[m]) continue;
        fd[m] = open(out[m], O_WRONLY);                     /* waits until the worker reads the pipe */
        if (fd[m] < 0) { fprintf(stderr, "FAKE_MIC cannot open pipe %d: %s\n", m + 1, strerror(errno)); return 1; }
    }

    /* e0: this process's own two clock reads. Sample n of every mic was "captured" at e0 + n/SR. */
    int64_t e0_real = now_us(CLOCK_REALTIME), e0_mono = now_us(CLOCK_MONOTONIC);
    fprintf(mf, "{\"type\":\"mic\",\"pid\":%d,\"e0_real_us\":%lld,\"sr\":%d,\"chunk\":%d,\"ppm\":%.1f,\"stop_at\":%.3f,\"resume_at\":%.3f,\"deliver_late_us\":%lld}\n", (int)getpid(), (long long)e0_real, SR, CHUNK, ppm, stop_at, resume_at, late_us);
    for (int b = 0; b < n_beeps; b++) {
        int64_t d = beep_at[b] - e0_real;
        /* ceil: the first sample at or after the instant, on the MIC's clock (sample k is captured at e0 + k / (SR * (1 + ppm))). */
        onset[b] = d < 0 ? -1 : (int64_t)ceil((double)d * SR * (1.0 + ppm * 1e-6) / US);
        fprintf(mf, "{\"type\":\"beep\",\"index\":%d,\"at_us\":%lld,\"onset_sample\":%lld}\n", b, (long long)beep_at[b], (long long)onset[b]);
    }
    fflush(mf);

    int64_t total = (int64_t)(seconds * SR), n = 0, max_late = 0, written2 = 0;
    float a[CHUNK], s[CHUNK], x[CHUNK], y[CHUNK];          /* D61: channels 3 and 4 join */
    int alive[4] = { 1, fd[1] >= 0, fd[2] >= 0, fd[3] >= 0 };
    uint64_t lcg = 0x9E3779B97F4A7C15ULL;
    while (n < total && alive[0]) {
        for (int i = 0; i < CHUNK; i++) {
            int64_t k = n + i;
            lcg = lcg * 6364136223846793005ULL + 1442695040888963407ULL;
            float v = (float)(0.01 * ((double)(lcg >> 40) / 8388608.0 - 1.0)), beep = 0;
            int in_beep = 0;                                    /* 1: inside a burst; -1: in the 50 ms before one */
            for (int b = 0; b < n_beeps; b++) {
                int64_t d = k - onset[b];
                if (onset[b] >= 0 && d >= 0 && d < SR / 10) { beep = (float)(0.5 * cos(2 * M_PI * 1000.0 * (double)d / SR)); in_beep = 1; break; }
                if (onset[b] >= 0 && d < 0 && d >= -(SR / 20)) in_beep = -1;
            }
            a[i] = in_beep > 0 && beep_on[0] ? beep : v;
            s[i] = in_beep && beep_on[1] ? beep : (float)(0.1 * sin(2 * M_PI * 880.0 * (double)k / SR));
            x[i] = in_beep && beep_on[2] ? beep : (float)(0.1 * sin(2 * M_PI * 660.0 * (double)k / SR));           /* D61: channel 3 */
            y[i] = in_beep && beep_on[3] ? beep : (float)(0.1 * sin(2 * M_PI * 440.0 * (double)k / SR));           /* D61: channel 4 */
        }
        /* Hand the chunk over ON its instant: sleep to 1.5 ms before it, then watch the clock (a
         * plain sleep overshoots by most of a millisecond on this host, which would be a constant
         * "device latency" of the fixture). */
        int64_t due = e0_mono + late_us + (int64_t)((double)(n + CHUNK) * US / (SR * (1.0 + ppm * 1e-6))), wait = due - now_us(CLOCK_MONOTONIC);
        if (wait > 1500) { struct timespec ts = { (wait - 1500) / US, ((wait - 1500) % US) * 1000 }; nanosleep(&ts, NULL); }
        else if (wait < 0 && -wait > max_late) max_late = -wait;
        while (now_us(CLOCK_MONOTONIC) < due) { }
        double t = (double)n / SR;
        int stopped = stop_at >= 0 && t >= stop_at && (resume_at < 0 || t < resume_at);
        if (stopped) { n += CHUNK; continue; }                  /* the device is away: its clock goes on, nothing is delivered */
        if (write_all(fd[0], a, sizeof a) < 0) alive[0] = 0;
        if (alive[1] && t >= start2_after && (stop2_after < 0 || t < stop2_after)) {
            if (write_all(fd[1], s, sizeof s) < 0) alive[1] = 0; else written2 += CHUNK;
        }
        /* D61 (2026-11-04): channels 3 and 4 have no silence rule of their own - they deliver while the fixture runs. */
        if (alive[2] && write_all(fd[2], x, sizeof x) < 0) alive[2] = 0;
        if (alive[3] && write_all(fd[3], y, sizeof y) < 0) alive[3] = 0;
        n += CHUNK;
    }
    fprintf(mf, "{\"type\":\"end\",\"samples\":%lld,\"samples_mic2\":%lld,\"max_late_us\":%lld,\"reader_gone\":%s}\n", (long long)n, (long long)written2, (long long)max_late, alive[0] ? "false" : "true");
    fclose(mf);
    for (int m = 0; m < 4; m++) if (fd[m] >= 0) close(fd[m]);
    return 0;
}
