/*
 * THE CAPTURE GUARD (task 4 blueprint row 23, work package WP-02; its condition "guard needed" is met by
 * experiment E-7, test/022_e7_without_guard.md: the FFmpeg helper does not end when its standard input ends,
 * 0 of 24, and survives a SIGKILL of its parent while its consumer lives, 30 of 30).
 *
 * A SEPARATE PROGRAM, build/capture-guard, one source file, no library but the system's. It is neither the worker
 * (the C files of the folder above, rules: ../../check.sh) nor the relay (../relay/, rules: ../../relay-check.sh); its own rules and its
 * import net are in ../../test/guard_test.py. The Core's production process door starts it in the place of a
 * helper that cannot be trusted to end by itself (the configuration key DEMS_CAPTURE_GUARD names this binary):
 *
 *     capture-guard <absolute path of the program> [its arguments ...]
 *
 * WHAT IT DOES
 *   1. sets its core-file limit to 0 (soft and hard, read back): the child inherits it and cannot raise it;
 *   2. starts ONE child: fork, then execve of argv[1] with argv[1..] as the child's argument vector, UNCHANGED,
 *      and the environment it was given, UNCHANGED. No shell, no search path, no word is split, joined or read;
 *   3. watches, every GUARD_SLICE_MS: (a) has the child ended, (b) has its own standard input ended, (c) has its
 *      parent gone away (its parent process is no longer the one that started it), (d) was it told to end
 *      (SIGTERM, SIGINT, SIGHUP);
 *   4. on (b), (c) or (d) ENDS the child: SIGTERM, and after GUARD_TERM_BOUND_MS a SIGKILL if it is still there;
 *   5. REAPS the child (waitpid) and passes its exit on: its exit status as the guard's own, or 128 + the number
 *      of the signal that ended it.
 *
 * THE START MESSAGE NEVER PASSES THROUGH THIS PROGRAM. The door writes it to the guard's standard input
 * (docs/.../implementation/021_production_door.md). The child INHERITS that same descriptor, so the kernel hands
 * the bytes to the child's own read; the guard forwards nothing. It never reads descriptor 0: it asks the system
 * only WHETHER the input is at its end (poll, and the COUNT of waiting bytes, FIONREAD - a number, not a byte).
 * So no byte of a start message is ever in this process's memory, and it writes nothing: not a line, not a
 * byte, to any descriptor (standard output and standard error are the child's, inherited). The two statements
 * are held on the source and on the linked binary (it imports no function that reads, writes, prints, opens,
 * reads the environment or starts a shell): test/guard_test.py.
 *
 * "THE INPUT HAS ENDED", without reading it: the descriptor reports a hang-up or an error, or it reports
 * "readable" while 0 bytes wait (that is what the end of a pipe or of a socket looks like), GUARD_EOF_LOOKS times
 * in a row, GUARD_EOF_PAUSE_MS apart. The repetition is for one race: the child may take the waiting bytes
 * between the guard's two questions, which looks like the end for an instant; the real end is permanent. Bytes
 * that wait unread are the child's and do not count as an end. Standard input must be a pipe or a socket (what
 * the door gives): anything else (a file, a terminal, /dev/null) has no end that means "the Core is gone", and
 * the guard refuses to start rather than guard nothing.
 *
 * WHAT IT DOES NOT COVER. A SIGKILL of the guard itself cannot be handled by it. On Linux the child is given the
 * parent-death signal (prctl PR_SET_PDEATHSIG, SIGKILL) between fork and exec, behind the compile-time seam
 * `__linux__` below: the kernel then ends the child when the guard dies. That branch is NOT compiled on macOS
 * and is proven only on the Linux host: hardware check 9A/H-02, row 79. On macOS a child of a killed guard
 * lives on until its consumer goes (E-7). A child that starts programs of its own is ended alone: its own
 * children are not the guard's.
 *
 * THE GUARD'S OWN CODES (it says nothing else; a child may use the same numbers, the door's caller knows which
 * program it started): 120 usage (no program, or not an absolute path), 121 the core-file limit could not be
 * set to 0, 122 standard input is not a pipe or a socket, 123 the child could not be started (fork),
 * 126 the program could not be executed (said by the child side, before any of the program ran).
 */
#include <errno.h>
#include <poll.h>
#include <signal.h>
#include <sys/ioctl.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>
#ifdef __linux__
#include <sys/prctl.h>
#endif

#define GUARD_SLICE_MS 50                   /* one look at the child, the input and the parent */
#define GUARD_TERM_BOUND_MS 2000            /* from SIGTERM to SIGKILL */
#define GUARD_EOF_LOOKS 3
#define GUARD_EOF_PAUSE_MS 2

#define GUARD_USAGE 120
#define GUARD_HYGIENE_FAILED 121
#define GUARD_INPUT_NOT_A_PIPE 122
#define GUARD_NOT_STARTED 123
#define GUARD_NOT_EXECUTED 126

extern char **environ;

static volatile sig_atomic_t g_told;

static void on_signal(int number) { (void)number; g_told = 1; }

static long long mono_ms(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (long long)t.tv_sec * 1000LL + t.tv_nsec / 1000000LL;
}

static void pause_ms(int ms) {
    struct timespec t = { ms / 1000, (long)(ms % 1000) * 1000000L };
    nanosleep(&t, NULL);                    /* a signal may shorten it: every caller looks again */
}

/* One look at standard input, which is never read. 1: at its end. 0: open (empty, or bytes wait for the child). */
static int input_looks_ended(int wait_ms) {
    struct pollfd p = { STDIN_FILENO, POLLIN, 0 };
    int waiting = 0;
    int r = poll(&p, 1, wait_ms);
    if (r < 0) return errno == EINTR ? 0 : 1;
    if (r == 0) return 0;
    if (p.revents & (POLLHUP | POLLERR | POLLNVAL)) return 1;
    if (!(p.revents & POLLIN)) return 0;
    if (ioctl(STDIN_FILENO, FIONREAD, &waiting) < 0) return 1;
    if (waiting > 0) { pause_ms(wait_ms); return 0; }       /* the child's bytes: not an end, and not a busy loop */
    return 1;
}

static int input_ended(void) {
    if (!input_looks_ended(GUARD_SLICE_MS)) return 0;
    for (int look = 1; look < GUARD_EOF_LOOKS; look++) {
        pause_ms(GUARD_EOF_PAUSE_MS);
        if (!input_looks_ended(0)) return 0;
    }
    return 1;
}

/* The child's exit as this program's own. */
static int passed_on(int status) {
    if (WIFEXITED(status)) return WEXITSTATUS(status);
    if (WIFSIGNALED(status)) return 128 + WTERMSIG(status);
    return GUARD_NOT_STARTED;
}

/* 1 and *status when the child has ended (it is reaped by this call). */
static int child_ended(pid_t child, int *status, int block) {
    for (;;) {
        pid_t got = waitpid(child, status, block ? 0 : WNOHANG);
        if (got == child) return 1;
        if (got < 0 && errno == EINTR) continue;
        if (got < 0) { *status = 0; return 1; }             /* no such child: nothing is left to wait for */
        return 0;
    }
}

int main(int argc, char **argv) {
    struct rlimit none = { 0, 0 }, now;
    struct sigaction told;
    struct stat input;
    int status = 0;

    if (argc < 2 || argv[1][0] != '/') return GUARD_USAGE;
    if (setrlimit(RLIMIT_CORE, &none) || getrlimit(RLIMIT_CORE, &now) || now.rlim_cur != 0 || now.rlim_max != 0) return GUARD_HYGIENE_FAILED;
    if (fstat(STDIN_FILENO, &input) || !(S_ISFIFO(input.st_mode) || S_ISSOCK(input.st_mode))) return GUARD_INPUT_NOT_A_PIPE;

    /* Handlers, never "ignore": a handler goes back to the default in the child at its exec, an ignored signal
     * would stay ignored there and change the helper. No restart: a wait that a signal interrupts returns. */
    told.sa_handler = on_signal;
    told.sa_flags = 0;
    sigemptyset(&told.sa_mask);
    sigaction(SIGTERM, &told, NULL);
    sigaction(SIGINT, &told, NULL);
    sigaction(SIGHUP, &told, NULL);

    pid_t parent = getppid(), self = getpid();
    pid_t child = fork();
    if (child < 0) return GUARD_NOT_STARTED;
    if (child == 0) {
#ifdef __linux__
        /* THE COMPILE-TIME SEAM (Linux only; proven by hardware check 9A/H-02 / row 79, not on macOS): the kernel
         * ends this child when the guard dies, a SIGKILL of the guard included. The guard may have died between
         * the fork and this line: then the signal would never come, so the child looks once. */
        if (prctl(PR_SET_PDEATHSIG, SIGKILL, 0, 0, 0) || getppid() != self) _exit(GUARD_NOT_EXECUTED);
#else
        (void)self;
#endif
        execve(argv[1], argv + 1, environ);
        _exit(GUARD_NOT_EXECUTED);
    }

    for (;;) {
        if (child_ended(child, &status, 0)) return passed_on(status);
        if (g_told || getppid() != parent || input_ended()) break;
    }

    /* End the child: asked first, killed at the bound, waited for in every case. */
    kill(child, SIGTERM);
    for (long long bound = mono_ms() + GUARD_TERM_BOUND_MS; mono_ms() < bound;) {
        if (child_ended(child, &status, 0)) return passed_on(status);
        pause_ms(10);
    }
    kill(child, SIGKILL);
    child_ended(child, &status, 1);
    return passed_on(status);
}
