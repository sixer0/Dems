/*
 * The worker's side of @dems/capture-protocol (blueprint row 58; capture spec B.2; the nine-point
 * gap list of the row-57 pair review).
 *
 * OUT: one JSON object per line on standard output, and NOTHING else is ever written there (a
 * line that is no frame ends the worker on the supervisor's side). Frames are queued and written
 * by one writer thread, so that no recording thread ever blocks on the pipe:
 *   - HELLO, HEARTBEAT, ACK, WARNING, RECORD and CRASH are never dropped and keep their order;
 *   - TELEMETRY is a level: a frame that still waits is replaced by the newer one.
 * A failed write means the supervisor is gone: the worker stops recording and exits.
 *
 * IN: a small JSON reader for the commands (lines of at most MAX_FRAME_CHARS characters).
 *
 * LOG: one JSON object per line, appended to the file named by --log. Never a URL, a path, a
 * credential or sample data: codes, counters, a camera index and a port only. Standard error is
 * not used: the supervisor closes it. THE LOG IS BOUNDED (fix round 1, finding F-2): at most
 * LOG_LINES_PER_SECOND lines a second PER SOURCE (the rest are counted and said in one line per
 * source; row 59, finding R-4), at most LOG_SOURCE_RUN_BYTES per source and LOG_RUN_BYTES per
 * worker run (then one last line, and silence), and a file that passed
 * LOG_ROTATE_BYTES is moved aside when a worker starts (one generation). Nothing a library or a
 * client does can fill the data directory through this file.
 */
#include "worker.h"

#include <ctype.h>
#include <errno.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

int64_t mono_us(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec * US + t.tv_nsec / 1000; }
int64_t real_us(void) { struct timespec t; clock_gettime(CLOCK_REALTIME, &t); return t.tv_sec * US + t.tv_nsec / 1000; }

/* ---------------------------------------------------------------- log */
/* THE QUOTA IS COUNTED PER SOURCE (blueprint row 59; pair-58 re-check, navigator B finding R-4).
 * With one shared quota a flood of one source - libav's messages, about 700,000 a second when an
 * open is refused in a loop - used up every line of every second, and the lines that told what
 * happened (the ingest that was given up, the camera summary, the exit) were not in the log.
 * Now every source (`main`, `sink`, `ingest1`, `libav`, ...) has its own lines per second and its
 * own share of the run's bytes, so no source can silence another. The whole log of a run is still
 * capped (LOG_RUN_BYTES), and that cap can only be reached by several sources together. */
#define LOG_ROTATE_BYTES (8 * 1024 * 1024)
#define LOG_RUN_BYTES (16 * 1024 * 1024)
#define LOG_SOURCE_RUN_BYTES (LOG_RUN_BYTES / 4)
#define LOG_LINES_PER_SECOND 200
#define LOG_SOURCES 16
typedef struct { char name[24]; int64_t in_second, suppressed, bytes; } LogSource;
static LogSource log_source[LOG_SOURCES];        /* the last slot is shared by every source beyond the table */
static int log_sources;
static int64_t log_second, log_bytes;
static int log_capped;
static FILE *g_log;
static pthread_mutex_t g_log_mx = PTHREAD_MUTEX_INITIALIZER;

int log_open(const char *path) {
    struct stat st;
    /* One generation is kept: a log that grew past the limit is moved aside when a worker starts. */
    if (stat(path, &st) == 0 && st.st_size > LOG_ROTATE_BYTES) {
        char old[PATH_CHARS + 8];
        if (snprintf(old, sizeof old, "%s.1", path) < (int)sizeof old) rename(path, old);
    }
    g_log = fopen(path, "a");
    return g_log ? 0 : -1;
}

void log_close(void) {
    pthread_mutex_lock(&g_log_mx);
    if (g_log) fclose(g_log);
    g_log = NULL;
    pthread_mutex_unlock(&g_log_mx);
}

static LogSource *log_source_of(const char *source) {
#ifdef LOG_SHARED_QUOTA             /* TEST BUILD ONLY: the old rule, one quota for all (the negative control of test/log_test.c) */
    source = "all";
#endif
    for (int i = 0; i < log_sources; i++) if (!strcmp(log_source[i].name, source)) return &log_source[i];
    if (log_sources == LOG_SOURCES) return &log_source[LOG_SOURCES - 1];
    LogSource *s = &log_source[log_sources++];
    snprintf(s->name, sizeof s->name, "%s", log_sources == LOG_SOURCES ? "other" : source);
    return s;
}

void logj(const char *level, const char *source, const char *msg, const char *extra, ...) {
    char buf[1024];
    va_list ap;
    va_start(ap, extra);
    vsnprintf(buf, sizeof buf, extra, ap);
    va_end(ap);
    pthread_mutex_lock(&g_log_mx);
    if (g_log && !log_capped) {
        int64_t now = real_us(), second = now / US;
        int n = 0;
        if (second != log_second) {
            for (int i = 0; i < log_sources; i++) {
                LogSource *s = &log_source[i];
                if (s->suppressed)
                    n += fprintf(g_log, "{\"ts_us\":%lld,\"level\":\"warn\",\"source\":\"capture-worker.log\",\"pid\":%d,\"sessionId\":\"%s\",\"message\":\"log_lines_suppressed\",\"of\":\"%s\",\"lines\":%lld,\"limit_per_second\":%d}\n",
                                 (long long)now, (int)getpid(), S.id, s->name, (long long)s->suppressed, LOG_LINES_PER_SECOND);
                s->in_second = s->suppressed = 0;
            }
            log_second = second;
        }
        LogSource *s = log_source_of(source);
        if (s->in_second++ < LOG_LINES_PER_SECOND && s->bytes <= LOG_SOURCE_RUN_BYTES) {
            int w = fprintf(g_log, "{\"ts_us\":%lld,\"level\":\"%s\",\"source\":\"capture-worker.%s\",\"pid\":%d,\"sessionId\":\"%s\",\"message\":\"%s\"%s%s}\n",
                            (long long)now, level, source, (int)getpid(), S.id, msg, buf[0] ? "," : "", buf);
            if (w > 0) {
                n += w;
                s->bytes += w;
                if (s->bytes > LOG_SOURCE_RUN_BYTES)
                    n += fprintf(g_log, "{\"ts_us\":%lld,\"level\":\"error\",\"source\":\"capture-worker.log\",\"pid\":%d,\"sessionId\":\"%s\",\"message\":\"log_source_capped\",\"of\":\"%s\",\"limit_bytes\":%d}\n",
                                 (long long)now, (int)getpid(), S.id, s->name, LOG_SOURCE_RUN_BYTES);
            }
        } else s->suppressed++;
        if (n > 0) log_bytes += n;
        if (log_bytes > LOG_RUN_BYTES) {
            log_capped = 1;
            fprintf(g_log, "{\"ts_us\":%lld,\"level\":\"error\",\"source\":\"capture-worker.log\",\"pid\":%d,\"sessionId\":\"%s\",\"message\":\"log_capped\",\"limit_bytes\":%d}\n", (long long)now, (int)getpid(), S.id, LOG_RUN_BYTES);
        }
        if (n > 0) fflush(g_log);
    }
    pthread_mutex_unlock(&g_log_mx);
}

/* libav error text is ASCII without quotes; copy it defensively into a JSON-safe buffer. */
const char *errstr(int e, char *b, size_t n) {
    av_strerror(e, b, n);
    for (char *p = b; *p; p++) if (*p == '"' || *p == '\\' || (unsigned char)*p < 0x20) *p = ' ';
    return b;
}

/* ---------------------------------------------------------------- frames out */
typedef struct Frame { struct Frame *next; size_t len; char text[]; } Frame;

static pthread_mutex_t q_mx = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t q_cv = PTHREAD_COND_INITIALIZER;
static Frame *q_head, *q_tail, *q_level;
static int q_len, q_closing;
static atomic_int q_broken;
static pthread_t writer_th, beat_th;
static int writer_started, beat_started, beat_ms = 500;
#define QUEUE_LIMIT 8192

int ipc_broken(void) { return atomic_load(&q_broken); }

static Frame *frame_make(const char *fmt, va_list ap) {
    char body[4096];
    int n = vsnprintf(body, sizeof body, fmt, ap);
    if (n < 0 || n >= (int)sizeof body) return NULL;
    size_t len = (size_t)n + 16;
    Frame *f = malloc(sizeof *f + len + 1);
    if (!f) return NULL;
    f->next = NULL;
    f->len = (size_t)snprintf(f->text, len + 1, "{\"v\":%d,%s}\n", CAPTURE_PROTOCOL_VERSION, body);
    return f;
}

void ipc_send(const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    Frame *f = frame_make(fmt, ap);
    va_end(ap);
    if (!f) { fatal("ipc", "FRAME_BUILD_FAILED", AVERROR(ENOMEM)); return; }
    pthread_mutex_lock(&q_mx);
    if (q_len >= QUEUE_LIMIT) {
        /* The supervisor reads at all times; a queue this long means it does not. Nothing of the
         * lossless class is dropped silently: the worker gives up loudly instead. */
        pthread_mutex_unlock(&q_mx);
        free(f);
        fatal("ipc", "FRAME_QUEUE_OVERFLOW", AVERROR(ENOBUFS));
        return;
    }
    if (q_tail) q_tail->next = f; else q_head = f;
    q_tail = f;
    q_len++;
    pthread_cond_signal(&q_cv);
    pthread_mutex_unlock(&q_mx);
}

void ipc_send_level(const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    Frame *f = frame_make(fmt, ap);
    va_end(ap);
    if (!f) return;                             /* a level that cannot be built is skipped */
    pthread_mutex_lock(&q_mx);
    free(q_level);                              /* the one that still waits is superseded */
    q_level = f;
    pthread_cond_signal(&q_cv);
    pthread_mutex_unlock(&q_mx);
}

static int write_all(const char *p, size_t n) {
    while (n) {
        ssize_t w = write(STDOUT_FILENO, p, n);
        if (w < 0) { if (errno == EINTR) continue; return -1; }
        p += w;
        n -= (size_t)w;
    }
    return 0;
}

static void *writer_main(void *arg) {
    (void)arg;
    for (;;) {
        pthread_mutex_lock(&q_mx);
        while (!q_head && !q_level && !q_closing) pthread_cond_wait(&q_cv, &q_mx);
        Frame *f = q_head;
        if (f) { q_head = f->next; if (!q_head) q_tail = NULL; q_len--; }
        else if (q_level) { f = q_level; q_level = NULL; }
        int done = !f && q_closing;
        pthread_mutex_unlock(&q_mx);
        if (done) return NULL;
        if (!f) continue;
        if (!atomic_load(&q_broken) && write_all(f->text, f->len) < 0) {
            /* SIGPIPE is ignored: a broken pipe arrives here. The supervisor is gone. */
            atomic_store(&q_broken, 1);
            atomic_store(&g_stop, 1);
        }
        free(f);
    }
}

static void *beat_main(void *arg) {
    (void)arg;
    uint64_t counter = 0;
    int64_t next = mono_us();
    for (;;) {
        pthread_mutex_lock(&q_mx);
        int closing = q_closing;
        pthread_mutex_unlock(&q_mx);
        if (closing) return NULL;
        int64_t now = mono_us();
        if (now >= next) {
            ipc_send("\"type\":\"HEARTBEAT\",\"counter\":%llu", (unsigned long long)++counter);
            next += (int64_t)beat_ms * 1000;
            if (next < now) next = now + (int64_t)beat_ms * 1000;
        }
        struct timespec ts = { 0, 5 * 1000 * 1000 };
        nanosleep(&ts, NULL);
    }
}

/* What HELLO names. A PROOF build - a build with ANY of the switches of worker.h (review R63-06) - says so:
 * the Core starts no worker whose version carries the mark. */
#ifdef DEMS_PROOF_BUILD
#define HELLO_WORKER_VERSION WORKER_VERSION "-PROOF"
#else
#define HELLO_WORKER_VERSION WORKER_VERSION
#endif

int ipc_start(int heartbeat_ms, const char *refusal) {
    beat_ms = heartbeat_ms;
    if (pthread_create(&writer_th, NULL, writer_main, NULL)) return -1;
    writer_started = 1;
    if (refusal) {
        /* The worker refuses to start (review R63-07): ONE frame instead of HELLO, and no heartbeat. */
        ipc_send("\"type\":\"CRASH\",\"sessionId\":null,\"code\":\"%s\",\"signal\":null,\"exitCode\":%d", refusal, EXIT_FATAL);
        return 0;
    }
    /* HELLO is the first frame, before any heartbeat. */
    ipc_send("\"type\":\"HELLO\",\"protocolVersion\":%d,\"workerVersion\":\"%s\"", CAPTURE_PROTOCOL_VERSION, HELLO_WORKER_VERSION);
    if (pthread_create(&beat_th, NULL, beat_main, NULL)) return -1;
    beat_started = 1;
    return 0;
}

/* Lets the writer hand on every frame that waits, then ends both threads. */
void ipc_stop(void) {
    pthread_mutex_lock(&q_mx);
    q_closing = 1;
    pthread_cond_broadcast(&q_cv);
    pthread_mutex_unlock(&q_mx);
    if (beat_started) pthread_join(beat_th, NULL);
    if (writer_started) pthread_join(writer_th, NULL);
    beat_started = writer_started = 0;
}

/* ---------------------------------------------------------------- JSON in */
typedef struct { char *p; JNode *arena; int cap, used, depth; } JP;

static void jskip(JP *j) { while (*j->p == ' ' || *j->p == '\t' || *j->p == '\r' || *j->p == '\n') j->p++; }
static JNode *jnew(JP *j) { if (j->used >= j->cap) return NULL; JNode *n = &j->arena[j->used++]; memset(n, 0, sizeof *n); return n; }

static int hex4(const char *s, unsigned *out) {
    unsigned v = 0;
    for (int i = 0; i < 4; i++) {
        int c = (unsigned char)s[i];
        if (!isxdigit(c)) return -1;
        v = v * 16 + (unsigned)(isdigit(c) ? c - '0' : (tolower(c) - 'a' + 10));
    }
    *out = v;
    return 0;
}

/* Parses a string in place: the unescaped text is never longer than the escaped one. */
static const char *jstring(JP *j) {
    if (*j->p != '"') return NULL;
    char *r = ++j->p, *w = r;
    for (;;) {
        unsigned char c = (unsigned char)*r;
        if (c == 0 || c < 0x20) return NULL;
        if (c == '"') { r++; break; }
        if (c != '\\') { *w++ = (char)c; r++; continue; }
        r++;
        switch (*r) {
        case '"': *w++ = '"'; r++; break;
        case '\\': *w++ = '\\'; r++; break;
        case '/': *w++ = '/'; r++; break;
        case 'b': *w++ = '\b'; r++; break;
        case 'f': *w++ = '\f'; r++; break;
        case 'n': *w++ = '\n'; r++; break;
        case 'r': *w++ = '\r'; r++; break;
        case 't': *w++ = '\t'; r++; break;
        case 'u': {
            unsigned cp, lo;
            if (hex4(r + 1, &cp)) return NULL;
            r += 5;
            if (cp >= 0xD800 && cp <= 0xDBFF) {
                if (r[0] != '\\' || r[1] != 'u' || hex4(r + 2, &lo) || lo < 0xDC00 || lo > 0xDFFF) return NULL;
                cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
                r += 6;
            } else if (cp >= 0xDC00 && cp <= 0xDFFF) return NULL;
            if (cp == 0) return NULL;                       /* no NUL inside a C string */
            if (cp < 0x80) *w++ = (char)cp;
            else if (cp < 0x800) { *w++ = (char)(0xC0 | (cp >> 6)); *w++ = (char)(0x80 | (cp & 0x3F)); }
            else if (cp < 0x10000) { *w++ = (char)(0xE0 | (cp >> 12)); *w++ = (char)(0x80 | ((cp >> 6) & 0x3F)); *w++ = (char)(0x80 | (cp & 0x3F)); }
            else { *w++ = (char)(0xF0 | (cp >> 18)); *w++ = (char)(0x80 | ((cp >> 12) & 0x3F)); *w++ = (char)(0x80 | ((cp >> 6) & 0x3F)); *w++ = (char)(0x80 | (cp & 0x3F)); }
            break;
        }
        default: return NULL;
        }
    }
    char *start = j->p;
    *w = 0;
    j->p = r;
    return start;
}

static JNode *jvalue(JP *j) {
    if (++j->depth > 16) return NULL;
    jskip(j);
    JNode *n = jnew(j);
    if (!n) return NULL;
    char c = *j->p;
    if (c == '{' || c == '[') {
        int obj = c == '{';
        n->t = obj ? J_OBJ : J_ARR;
        j->p++;
        jskip(j);
        JNode **link = &n->child;
        if (*j->p == (obj ? '}' : ']')) { j->p++; j->depth--; return n; }
        for (;;) {
            const char *key = NULL;
            jskip(j);
            if (obj) {
                if (!(key = jstring(j))) return NULL;
                jskip(j);
                if (*j->p++ != ':') return NULL;
            }
            JNode *v = jvalue(j);
            if (!v) return NULL;
            v->key = key;
            *link = v;
            link = &v->next;
            n->n++;
            jskip(j);
            if (*j->p == ',') { j->p++; continue; }
            if (*j->p == (obj ? '}' : ']')) { j->p++; break; }
            return NULL;
        }
    } else if (c == '"') {
        n->t = J_STR;
        if (!(n->str = jstring(j))) return NULL;
    } else if (!strncmp(j->p, "true", 4)) { n->t = J_BOOL; n->b = 1; j->p += 4; }
    else if (!strncmp(j->p, "false", 5)) { n->t = J_BOOL; j->p += 5; }
    else if (!strncmp(j->p, "null", 4)) { n->t = J_NULL; j->p += 4; }
    else if (c == '-' || isdigit((unsigned char)c)) {
        char *end;
        n->t = J_NUM;
        n->num = strtod(j->p, &end);
        if (end == j->p) return NULL;
        n->is_int = 1;
        for (const char *q = j->p; q < end; q++) if (*q == '.' || *q == 'e' || *q == 'E') n->is_int = 0;
        j->p = end;
    } else return NULL;
    j->depth--;
    return n;
}

JNode *json_parse(char *text, JNode *arena, int arena_len) {
    JP j = { text, arena, arena_len, 0, 0 };
    JNode *root = jvalue(&j);
    if (!root) return NULL;
    jskip(&j);
    return *j.p ? NULL : root;
}

const JNode *jget(const JNode *obj, const char *key) {
    if (!obj || obj->t != J_OBJ) return NULL;
    const JNode *found = NULL;
    for (const JNode *m = obj->child; m; m = m->next)
        if (m->key && !strcmp(m->key, key)) { if (found) return NULL; found = m; }   /* a member named twice is no member */
    return found;
}

int id_ok(const JNode *v, int max) {
    if (!v || v->t != J_STR) return 0;
    size_t n = strlen(v->str);
    if (n < 1 || n > (size_t)max) return 0;
    for (const char *p = v->str; *p; p++)
        if (!isalnum((unsigned char)*p) && *p != '.' && *p != '_' && *p != ':' && *p != '-') return 0;
    return 1;
}
