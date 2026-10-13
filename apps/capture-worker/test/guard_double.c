/* The DOUBLE of a helper for the checks of the capture guard (task 4 blueprint row 23; test/guard_test.py builds
 * and starts it). Test code only: it stands for "a helper that cannot be trusted to end by itself".
 *
 *     guard_double <mode> <report file> [any further words ...]
 *
 * It writes ONE report (to a temporary name, then renamed: the report's existence means "ready") and then behaves
 * as its mode says. It never ends because its standard input ended - that is the property of the FFmpeg helper
 * the guard exists for (experiment E-7).
 *
 *   stay        waits for ever; SIGTERM ends it (the default)
 *   ignoreterm  waits for ever and ignores SIGTERM
 *   exit:<n>    leaves with status n
 *   selfkill    ends itself with SIGKILL
 *   readline    first reads standard input up to a line feed, reports how many bytes it read and their FNV-1a
 *               hash (the bytes themselves are written nowhere), then waits for ever
 *
 * The report: `pid`, `core <soft> <hard>` (the core-file limit it was started with), one `arg <hex>` per word of
 * its argument vector, one `env <hex>` per entry of its environment, and for readline `line <bytes> <hash>`. */
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <unistd.h>

extern char **environ;

static void hex(FILE *f, const char *word, const char *s) {
    fprintf(f, "%s ", word);
    for (; *s; s++) fprintf(f, "%02x", (unsigned char)*s);
    fprintf(f, "\n");
}

int main(int argc, char **argv) {
    char tmp[4096];
    struct rlimit core;
    unsigned long long hash = 1469598103934665603ULL, bytes = 0;
    if (argc < 3 || strlen(argv[2]) > sizeof tmp - 8) return 99;
    const char *mode = argv[1];
    if (!strcmp(mode, "ignoreterm")) signal(SIGTERM, SIG_IGN);
    if (!strcmp(mode, "readline")) {
        char c;
        while (read(STDIN_FILENO, &c, 1) == 1) {
            hash = (hash ^ (unsigned char)c) * 1099511628211ULL;
            bytes++;
            if (c == '\n') break;
        }
    }
    snprintf(tmp, sizeof tmp, "%s.tmp", argv[2]);
    FILE *f = fopen(tmp, "w");
    if (!f) return 98;
    getrlimit(RLIMIT_CORE, &core);
    fprintf(f, "pid %ld\ncore %llu %llu\n", (long)getpid(), (unsigned long long)core.rlim_cur, (unsigned long long)core.rlim_max);
    for (int i = 0; i < argc; i++) hex(f, "arg", argv[i]);
    for (char **e = environ; *e; e++) hex(f, "env", *e);
    if (!strcmp(mode, "readline")) fprintf(f, "line %llu %016llx\n", bytes, hash);
    fclose(f);
    if (rename(tmp, argv[2])) return 97;
    if (!strncmp(mode, "exit:", 5)) return atoi(mode + 5);
    if (!strcmp(mode, "selfkill")) kill(getpid(), SIGKILL);
    for (;;) pause();
}
