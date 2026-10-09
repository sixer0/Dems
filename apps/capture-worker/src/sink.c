/*
 * One camera file (blueprint row 58; decision D67 option C; capture spec B.2 "Restart rule", C.2).
 *
 * THE RULE: no worker ever truncates or overwrites a file that exists, and a file that holds no
 * fragment never exists under an evidence name. So the file APPEARS AT ITS FINAL NAME ONLY WITH
 * ITS INIT SEGMENT AND ONE WHOLE FRAGMENT IN IT (the first of the two options spec B.2 leaves to
 * this row; fix round 1, finding F-3): the first fragment is written to `<path>.<pid>.part`
 * (created with O_EXCL), then that file is LINKED to the final name. link() is atomic and fails
 * when the name exists, so the create is exclusive by construction, and a process killed at any
 * instant leaves either no file at the final name or one that holds at least init + fragment.
 * The temporary name is then removed; the descriptor stays open and later fragments are appended.
 * A `.part` file a dead worker left is never reused and never removed: it is reported at START.
 * If anything is at the final name, the link fails and the session ends with a fatal error; the
 * bytes that were there are not touched. A file at an output path therefore always means media.
 *
 * HOW. The muxer writes into memory through this unit (an AVIO write callback, not seekable). The
 * bytes are held until they end with a complete top-level `mdat` box, i.e. until at least one
 * whole fragment (`moof` + `mdat`) is there; then everything up to the end of that box goes to the
 * file in one write. From then on every later fragment is written the same way: the file grows
 * fragment by fragment during the session (spec C.2: bytes reach the disk while recording), and a
 * process that dies between two writes leaves a file that ends on a fragment boundary.
 *
 * This is "written to the file" (visible to other processes, survives the death of this process),
 * not an fsync: the fsync policy, the hash chain and the checkpoint records belong to the fMP4
 * writer row, which hooks in at sink_flush_fragments() where each fragment passes as one buffer.
 */
#include "worker.h"

#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define PEND_LIMIT ((size_t)256 * 1024 * 1024)

void sink_init(Sink *s, const char *path) {
    memset(s, 0, sizeof *s);
    s->fd = -1;
    snprintf(s->path, sizeof s->path, "%s", path);
}

int sink_path_occupied(const char *path) {
    struct stat st;
    return lstat(path, &st) == 0 || errno != ENOENT;
}

/* How many `<path>.<n>.part` files of earlier workers lie beside the output path. They are
 * reported and left alone: a temporary file of a dead attempt is never reused and never removed. */
int sink_stale_parts(const char *path) {
    char dir[PATH_CHARS + 1];
    snprintf(dir, sizeof dir, "%s", path);
    char *slash = strrchr(dir, '/');
    if (!slash) return 0;
    const char *base = path + (slash - dir) + 1;
    size_t n = strlen(base);
    if (slash == dir) slash[1] = 0; else *slash = 0;
    DIR *d = opendir(dir);
    if (!d) return 0;
    int found = 0;
    for (struct dirent *e; (e = readdir(d));) {
        size_t len = strlen(e->d_name);
        if (len > n + 6 && !strncmp(e->d_name, base, n) && e->d_name[n] == '.' && !strcmp(e->d_name + len - 5, ".part")) found++;
    }
    closedir(d);
    return found;
}

static int write_fd(int fd, const uint8_t *p, size_t n) {
    while (n) {
        ssize_t w = write(fd, p, n);
        if (w < 0) { if (errno == EINTR) continue; return AVERROR(errno); }
        p += w;
        n -= (size_t)w;
    }
    return 0;
}

/* Walks the complete top-level boxes of the pending bytes. Returns the offset just after the last
 * complete `mdat` (0 when there is none) and counts the `moof` boxes before that offset. */
static size_t complete_fragments(const uint8_t *b, size_t len, int *moofs) {
    size_t off = 0, cut = 0;
    int seen = 0;
    *moofs = 0;
    while (len - off >= 8) {
        uint64_t size = ((uint64_t)b[off] << 24) | ((uint64_t)b[off + 1] << 16) | ((uint64_t)b[off + 2] << 8) | b[off + 3];
        size_t header = 8;
        if (size == 1) {
            if (len - off < 16) break;
            size = 0;
            for (int i = 0; i < 8; i++) size = (size << 8) | b[off + 8 + i];
            header = 16;
        }
        if (size < header || size > len - off) break;      /* 0 ("to the end") never occurs in a fragmented file */
        if (!memcmp(b + off + 4, "moof", 4)) seen++;
        off += (size_t)size;
        if (!memcmp(b + off - (size_t)size + 4, "mdat", 4)) { cut = off; *moofs = seen; }
    }
    return cut;
}

static int sink_flush_fragments(Sink *s) {
    int moofs;
    size_t cut = complete_fragments(s->pend, s->pend_len, &moofs);
    if (!cut) return 0;
    int r;
    if (s->fd < 0) {
        /* The first complete fragment: written under a temporary name, then linked to the final one. */
        char part[PATH_CHARS + 32];
        if (snprintf(part, sizeof part, "%s.%d.part", s->path, (int)getpid()) >= (int)sizeof part) return AVERROR(ENAMETOOLONG);
        int fd = open(part, O_WRONLY | O_CREAT | O_EXCL | O_APPEND | O_CLOEXEC, 0600);
        if (fd < 0) return AVERROR(errno);
        if ((r = write_fd(fd, s->pend, cut)) < 0) { close(fd); return r; }      /* the .part stays: reported by the next worker, never reused */
        if (link(part, s->path) < 0) { r = AVERROR(errno); close(fd); unlink(part); return r; }   /* EEXIST: something is there; it is not touched */
        unlink(part);
        s->fd = fd;
    } else if ((r = write_fd(s->fd, s->pend, cut)) < 0) return r;
    memmove(s->pend, s->pend + cut, s->pend_len - cut);
    s->pend_len -= cut;
    atomic_fetch_add(&s->bytes, (int64_t)cut);
    atomic_fetch_add(&s->fragments, moofs);
    atomic_store(&s->last_fragment_mono_us, mono_us());
    return 0;
}

int sink_write(void *opaque, const uint8_t *buf, int size) {
    Sink *s = opaque;
    if (s->failed) return s->failed;
    if (size <= 0) return 0;
    if (s->pend_len + (size_t)size > s->pend_cap) {
        size_t cap = s->pend_cap ? s->pend_cap : 256 * 1024;
        while (cap < s->pend_len + (size_t)size) cap *= 2;
        uint8_t *grown = cap > PEND_LIMIT ? NULL : realloc(s->pend, cap);
        if (!grown) return s->failed = AVERROR(ENOMEM);
        s->pend = grown;
        s->pend_cap = cap;
    }
    memcpy(s->pend + s->pend_len, buf, (size_t)size);
    s->pend_len += (size_t)size;
    int r = sink_flush_fragments(s);
    if (r < 0) return s->failed = r;
    return size;
}

int sink_close(Sink *s) {
    int r = s->failed;
    if (s->fd >= 0) {
        /* What is left after the last fragment (a trailer box, if the muxer writes one). */
        if (!r && s->pend_len) {
            r = write_fd(s->fd, s->pend, s->pend_len);
            if (!r) atomic_fetch_add(&s->bytes, (int64_t)s->pend_len);
        }
        if (close(s->fd) < 0 && !r) r = AVERROR(errno);
        s->fd = -1;
    }
    /* No fragment was ever complete: no file was created, and none is created now. */
    free(s->pend);
    s->pend = NULL;
    s->pend_len = s->pend_cap = 0;
    return r;
}
