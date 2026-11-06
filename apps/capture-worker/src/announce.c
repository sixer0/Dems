/*
 * The announced address of an ingest: the expected message and the whole-message comparison (announce.h has the
 * rule and its reasons; task 4 blueprint row 58, BR-01, BR-02). Pure.
 */
#include "announce.h"

#include <stdio.h>
#include <string.h>

#define ANNOUNCE_COUNT_MAX 1000000

void announce_gate_reset(AnnounceGate *g, const char *plan_address) {
    char line[ANNOUNCE_EXPECTED_CHARS];
    memset(g, 0, sizeof *g);
    if (!plan_address) return;
    size_t address_len = strlen(plan_address);
    if (!address_len || address_len > ANNOUNCE_ADDRESS_CHARS) return;
    /* The request line as a client that knows the address sends it, then the message the library makes of it:
     * the number in the brackets is the length of that line, so it is computed from the line and never parsed. */
    int line_len = snprintf(line, sizeof line, "ANNOUNCE %s RTSP/1.0", plan_address);
    if (line_len <= 0 || (size_t)line_len >= sizeof line) return;
    int n = snprintf(g->expected, sizeof g->expected, "Parsing[%d]: %s\n", line_len, line);
    if (n <= 0 || (size_t)n >= sizeof g->expected) { g->expected[0] = 0; return; }
    g->expected_len = (size_t)n;
}

static int begins(const char *text, size_t have, const char *word) {
    size_t n = strlen(word);
    return have >= n && !memcmp(text, word, n);
}

/* "Parsing[...]: ANNOUNCE" - whatever stands in the brackets and whatever follows the method. Wider than the
 * library's own wording on purpose: a message this takes for an ANNOUNCE line can only count AGAINST the open. */
static int is_announce_line(const char *text, size_t have) {
    static const char head[] = "Parsing[";
    if (!begins(text, have, head)) return 0;
    size_t i = sizeof head - 1;
    while (i < have && text[i] != ']') i++;
    return i < have && begins(text + i, have - i, "]: ANNOUNCE");
}

/* Every byte is read whatever the first difference is: the time taken says nothing about where two messages part. */
static int same_bytes(const char *a, const char *b, size_t n) {
    volatile unsigned char difference = 0;
    for (size_t i = 0; i < n; i++) difference |= (unsigned char)((unsigned char)a[i] ^ (unsigned char)b[i]);
    return difference == 0;
}

int announce_gate_passed(const AnnounceGate *g) {
    return g->expected_len > 0 && !g->adopted_other && g->lines == 1 && g->matches == 1;
}

/* Row 175, BR-04 (3): the name of a refusal. "No line" is said only when NOTHING of an announce was shown; every
 * other open that may not pass showed a line (or an adopted address) that does not let it. */
AnnounceVerdict announce_gate_verdict(const AnnounceGate *g) {
    if (announce_gate_passed(g)) return ANNOUNCE_PASSED;
    return g->lines == 0 && !g->adopted_other ? ANNOUNCE_NOT_SEEN : ANNOUNCE_NOT_MATCHED;
}

static int holds(const char *text, size_t have, const char *part, size_t n) {
    if (!n || n > have) return 0;
    for (size_t i = 0; i + n <= have; i++) if (text[i] == part[0] && !memcmp(text + i, part, n)) return 1;
    return 0;
}

/* Row 175, BR-04 (2): does this text name the path of the plan's address (announce.h has the rule). */
int announce_names_path(const char *plan_address, const char *text, size_t have) {
    if (!plan_address || !text || !have) return 0;
    /* The path is what follows the first slash after "scheme://host:port"; an address without a scheme is taken
     * whole (it can only withhold more). */
    const char *scheme = strstr(plan_address, "://");
    const char *path = plan_address;
    if (scheme) {
        const char *slash = strchr(scheme + 3, '/');
        if (!slash) return 0;
        path = slash + 1;
    }
    if (holds(text, have, path, strlen(path))) return 1;
    for (const char *element = path; *element;) {
        const char *end = strchr(element, '/');
        size_t n = end ? (size_t)(end - element) : strlen(element);
        if (n >= ANNOUNCE_PATH_ELEMENT_CHARS && holds(text, have, element, n)) return 1;
        if (!end) break;
        element = end + 1;
    }
    return 0;
}

int announce_gate_observe(AnnounceGate *g, const char *text, size_t have, int whole) {
    /* The library adopts the address of an ANNOUNCE that differs from the one it listens on, and says so. */
    if (begins(text, have, "Updating control URI")) { g->adopted_other = 1; return 1; }
    if (!is_announce_line(text, have)) return 0;
    if (g->lines < ANNOUNCE_COUNT_MAX) g->lines++;
    /* THE comparison: the whole message, its length first, then all of its bytes. */
    if (whole && g->expected_len > 0 && have == g->expected_len && same_bytes(text, g->expected, have) && g->matches < ANNOUNCE_COUNT_MAX) g->matches++;
    return !announce_gate_passed(g);
}
