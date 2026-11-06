/*
 * The worker's log quota is counted PER SOURCE (blueprint row 59; pair-58 re-check, navigator B
 * finding R-4; decision D85). `make -C apps/capture-worker unit` runs it: `log_test <scratch file>`.
 *
 * One source floods (libav's messages: 60,000 lines inside one second, as the refused-transport
 * loop does) while three other sources write the lines that tell what happened. With one shared
 * quota the flood used up every line of the second and the incident lines were not in the log.
 * Required here: EVERY incident line is in the log, the flood is cut at its own quota, and the
 * lines it lost are counted under its own name.
 *
 * Built with -DLOG_SHARED_QUOTA (the old rule, kept in ipc.c for this purpose) the same run must
 * FAIL: that build is the negative control, and the Makefile demands its failure.
 */
#include "../src/worker.h"

#include <stdlib.h>
#include <string.h>
#include <time.h>

Session S;
atomic_int g_stop;
const char *g_mux_extra;
void fatal(const char *source, const char *code, int averror) { (void)source; (void)code; (void)averror; }

static int count(const char *text, const char *needle) {
    int n = 0;
    for (const char *p = text; (p = strstr(p, needle)); p += strlen(needle)) n++;
    return n;
}

int main(int argc, char **argv) {
    if (argc != 2) { fprintf(stderr, "usage: log_test <scratch file>\n"); return 2; }
    remove(argv[1]);
    if (log_open(argv[1]) < 0) return 2;
    snprintf(S.id, sizeof S.id, "S-LOG-TEST");
    /* Start early in a second, so that the flood and the incident lines share one second. */
    while (real_us() % US > 50000) { struct timespec ts = { 0, 1000 * 1000 }; nanosleep(&ts, NULL); }
    int64_t t0 = real_us();
    for (int i = 0; i < 60000; i++) {
        logj("warn", "libav", "LIBAV_MESSAGE", "\"av_level\":16,\"text\":\"flood %d\"", i);
        if (i == 500 || i == 20000 || i == 59000) {
            logj("warn", "ingest1", "INGEST_OPEN_STUCK", "\"port\":8555,\"at\":%d", i);
            logj("error", "main", "ingest_thread_abandoned", "\"cam\":1,\"at\":%d", i);
            logj("error", "sink", "WRITER_WRITE_FAILED", "\"cam\":2,\"at\":%d", i);
        }
    }
    int64_t spent = real_us() - t0;
    struct timespec ts = { 1, 100 * 1000 * 1000 };
    nanosleep(&ts, NULL);
    logj("info", "main", "worker_exit", "\"rc\":0");            /* the first line of a later second: the count of the lost lines is said here */
    log_close();

    FILE *f = fopen(argv[1], "rb");
    if (!f) return 2;
    static char text[8 * 1024 * 1024];
    size_t n = fread(text, 1, sizeof text - 1, f);
    fclose(f);
    text[n] = 0;
    int seconds = (int)(spent / US) + 1, bad = 0;
    int flood = count(text, "\"message\":\"LIBAV_MESSAGE\""), stuck = count(text, "\"message\":\"INGEST_OPEN_STUCK\""), abandoned = count(text, "\"message\":\"ingest_thread_abandoned\""),
        failed = count(text, "\"message\":\"WRITER_WRITE_FAILED\""), exit_line = count(text, "\"message\":\"worker_exit\""), lost = count(text, "\"message\":\"log_lines_suppressed\",\"of\":\"libav\"");
    if (stuck != 3 || abandoned != 3 || failed != 3 || exit_line != 1) { bad = 1; printf("log_test: FAILED: incident lines in the log: INGEST_OPEN_STUCK %d of 3, ingest_thread_abandoned %d of 3, WRITER_WRITE_FAILED %d of 3, worker_exit %d of 1\n", stuck, abandoned, failed, exit_line); }
    if (flood < 200 || flood > 200 * (seconds + 1)) { bad = 1; printf("log_test: FAILED: %d lines of the flooding source in %d s (its quota is 200 a second)\n", flood, seconds); }
    if (lost < 1) { bad = 1; printf("log_test: FAILED: the lines the flooding source lost are not counted under its name\n"); }
    if (count(text, "\"of\":\"main\"") || count(text, "\"of\":\"ingest1\"") || count(text, "\"of\":\"sink\"")) { bad = 1; printf("log_test: FAILED: a line of another source was suppressed\n"); }
    remove(argv[1]);
    if (!bad) printf("log_test: all checks hold (60,000 lines of one source in %.2f s: %d written, the rest counted under its name; 10 of 10 lines of the other sources are in the log)\n", (double)spent / 1e6, flood);
    return bad;
}
