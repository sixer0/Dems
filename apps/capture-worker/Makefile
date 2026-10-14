# DEMS capture worker (blueprint rows 111, 58 and 59; Q-WORKER answer (a), D24).
# Links the FFmpeg that is already installed; installs nothing. Output goes to build/ (git-ignored).
# Run from the repository root:  make -C apps/capture-worker
#
#   make            static rules (check + their self-test), then build/capture-worker
#   make check      the static rules over src/ (M3-SR-2, row 58 part)
#   make selftest   the same rules over planted sources: each MUST fail (negative controls)
#   make proof      PROOF BUILDS, never installed and never started by the Core:
#                     build/capture-worker-negctl   the pinned flags plus ONE forbidden mux option
#                                                   (the negative control of the AV checks)
#                     build/capture-worker-delaymoov the delay_moov variant measured in part P4
#                     build/capture-worker-norefusal a worker that does NOT recognise the refused
#                                                   transport (fix round 1, F-2: the damage must stay bounded)
#                     build/capture-worker-nocomp    no mic clock compensation: the negative control of the slow-mic check (F-4)
#                     build/capture-worker-writefault        the write of fragment 3 of camera 1 comes back short, then
#                                                            fails (row 59: the file must be back at its last good length)
#                     build/capture-worker-writefault-notrunc the same without the truncation: the negative control
#                                                            (the torn tail stays; the tail validation must flag it)
#                     build/capture-worker-intervalskew      the AUDIO_SOURCE_INTERVAL record of a switch names a sample one
#                                                            input chunk late (row 71: the mutation the interval check must catch)
#                     build/capture-worker-nofloor           the clock floor is judged and logged but NOT acted on (fix pass F-M3,
#                                                            review R63-12: the negative control of the floor's wiring in the ingest)
#                     build/capture-worker-nobound           no fragment size bound: neither the cut nor the writer's refusal
#                                                            (review R63-02: the negative control "with the rule off")
#                     build/capture-worker-noannounce        the log callback sees no message of the library (task 4 row 58,
#                                                            BR-01: "the library no longer says the ANNOUNCE line"): the gate is
#                                                            NOT off - it must refuse every push, the right path too
#   make fixtures   the NM-14 fixture set from test-fixtures/ (fake camera, fake mics, the vendored
#                   row-111 skeleton used as the negative control of the socket check)
#   make e2e        THE capture end-to-end series with one aggregate exit code (test/e2e.py; sandbox
#                   off; outside `npm test`; re-run after any FFmpeg upgrade)
#   make unit       unit checks of the pure parts: the slew limit and the clock telemetry
#                   (test/anchor_test.c; its red run is the same file with -DOLD_SLEW), and the
#                   camera file under kill -9 (test/sink_kill_test.c, 200 kills), the fMP4 writer
#                   (test/writer_test.c: chains re-derived from the file, failed and short writes;
#                   its red run is the same file with -DDEMS_PROOF_KEEP_TORN_TAIL) and the per-source
#                   log quota (test/log_test.c; its red run: -DLOG_SHARED_QUOTA), the clock floor of row 71
#                   (anchor_test.c check (2e); red runs -DFIRST_LIVE_ONLY and -DNO_FLOOR) and the microphone
#                   warning raiser on a sample-count clock (test/micwatch_test.c = M5-WARN-1; red run
#                   -DMICWATCH_PROOF_NO_DEBOUNCE), and the announced address of an ingest (test/announce_test.c,
#                   task 4 row 58: the right message passes, seven near misses and every other case do not)
CC         := clang
PKG_CONFIG ?= pkg-config
LIBS_PC    := libavformat libavcodec libavfilter libswresample libavutil
# NOT `?=` (review R63-06): a CFLAGS of the ENVIRONMENT must not reach the release build - it could carry a
# proof switch. (A switch that arrives anyway, on the make command line, still marks the binary: worker.h.)
# -D_DEFAULT_SOURCE (task 4 row 193, finding L-1 of row 78): under -std=c11 the C library of Linux declares the
# POSIX functions the worker uses (clock_gettime, nanosleep, sigaction, lstat, ftruncate, O_CLOEXEC, O_DIRECTORY)
# only when a feature-test macro asks for them. This one is the relay's and the guard's (below), and it is the
# one that HIDES NOTHING on macOS: Apple's headers do not read it. A _POSIX_C_SOURCE or _XOPEN_SOURCE in its place
# would hide F_FULLFSYNC there and make the writer a weaker one without a word (test/writer_test.c holds that).
CFLAGS     := -std=c11 -D_DEFAULT_SOURCE -O2 -g -Wall -Wextra -Werror
CFLAGS     += $(shell $(PKG_CONFIG) --cflags $(LIBS_PC))
LDLIBS     := $(shell $(PKG_CONFIG) --libs $(LIBS_PC)) -lm -lpthread

BUILD := build
BIN   := $(BUILD)/capture-worker
SRC   := src/capture_worker.c src/ipc.c src/sink.c src/ingest.c src/audio.c src/anchor.c src/micwatch.c src/announce.c
HDR   := src/worker.h src/anchor.h src/micwatch.h src/announce.h

FIXTURES := $(BUILD)/fake_cam $(BUILD)/fake_mic $(BUILD)/capture-worker-skeleton111 $(BUILD)/writer_replay $(BUILD)/m5_mic $(BUILD)/gapped_mic

# THE CAPTURE RELAY (task 4 blueprint row 41, WP-03a): a SEPARATE PROGRAM with source and rules of its own.
#   make relay         its static rules and their self-test (relay-check.sh), its unit checks, then
#                      build/capture-relay and the import net over what the binary imports
#   make relay-check   the relay's static rules over src/relay/ and their self-test (planted lines: each MUST fail)
#   make relay-unit    the pure part (src/relay/relay_core.c) against test/relay_unit_test.c
# HOW THE TWO PROGRAMS ARE KEPT APART. The worker listens on loopback and never dials out; the relay dials the
# camera and the loopback ingest and never listens. So: (1) the worker's sources are the explicit list SRC / HDR
# above and `check.sh src` reads src/*.c and src/*.h - a glob that does not reach src/relay/; (2) the relay's
# sources are the explicit list below, all under src/relay/, read by relay-check.sh and by nothing of the
# worker; (3) the relay includes no header of the worker and links no object of it (it links three libraries,
# not the worker's five); (4) its binary is build/capture-relay - not a `capture-worker-<name>`, which is the
# name of a proof build. relay-check.sh holds (1), (2) and (4) on this file.
#
# ROW 186 (security review verification/06_security_relay_client.md, H-1; fixes F-1, F-2). The relay reads bytes a
# camera chose, in the process that holds the camera account. So, every time `make` runs:
#   make relay-asan    the unit checks again, built with AddressSanitizer and UndefinedBehaviorSanitizer (warnings
#                      are errors, no recovery): the 34 named malformed-input cases on heap copies of exact length,
#                      and the real camera leg on a socket pair. Then three NEGATIVE CONTROLS: copies of the
#                      source with ONE bound removed each must make that build fail (one of them by a report of
#                      the sanitizer itself). And build/capture-relay-san, the whole relay with the sanitizers,
#                      for the fixture runs (test-fixtures/row186_bounds.py takes it with ROW186_RELAY).
#   make relay-fuzz    the fuzz build (test/relay_fuzz.c: eight entry points - the eighth, `report`, is row 42's: the
#                      two report lines of standard output - and a deterministic mutation driver of
#                      its own - the installed clang has no libFuzzer runtime) with the same sanitizers, run for
#                      RELAY_FUZZ_SECONDS per entry point with the seed RELAY_FUZZ_SEED. A longer run:
#                      make relay-fuzz RELAY_FUZZ_SECONDS=40
# THE HARDENING OF THE RELEASE BUILD of the relay (the worker's flags are not touched):
#   -D_FORTIFY_SOURCE=2 (after -U: a toolchain that sets it by default must not make the build fail on a
#   redefinition), -fstack-protector-strong, -fPIE: accepted by the clang of this Mac (measured) and stated for the
#   clang of Ubuntu 24.04. NOT set here, because this Mac's toolchain refuses them: `-pie` (Apple clang: "argument
#   unused", an error under -Werror; its executables are position independent without it) and
#   `-Wl,-z,relro,-z,now` (a flag of the ELF linkers only). Both are set on Linux alone and are UNPROVEN until the
#   Linux build (row 79). relay-check.sh --imports holds the BINARY to what the flags are for: it imports the stack
#   check and a checked copy function, and it is position independent.
RELAY_BIN    := $(BUILD)/capture-relay
RELAY_SRC    := src/relay/relay.c src/relay/relay_rtsp.c src/relay/relay_core.c
RELAY_HDR    := src/relay/relay.h
RELAY_PC     := libavformat libavcodec libavutil
RELAY_HARDEN := -U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=2 -fstack-protector-strong -fPIE
RELAY_HARDEN_LD :=
ifeq ($(shell uname -s),Linux)
RELAY_HARDEN_LD += -pie -Wl,-z,relro,-z,now
endif
RELAY_CFLAGS := -std=c11 -D_DEFAULT_SOURCE -O2 -g -Wall -Wextra -Werror $(RELAY_HARDEN) $(shell $(PKG_CONFIG) --cflags $(RELAY_PC))
RELAY_LDLIBS := $(shell $(PKG_CONFIG) --libs $(RELAY_PC))
# Test builds of the relay's sources. RELAY_TEST_HOOKS (the camera leg on a descriptor the test made) is named
# HERE ONLY: relay-check.sh refuses it in RELAY_CFLAGS and refuses a relay binary that holds the hook.
RELAY_TEST_CFLAGS := -std=c11 -D_DEFAULT_SOURCE -g -Wall -Wextra -Werror -DRELAY_TEST_HOOKS $(shell $(PKG_CONFIG) --cflags $(RELAY_PC))
RELAY_SAN    := -O1 -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer
RELAY_UNIT_SRC := test/relay_unit_test.c src/relay/relay_core.c src/relay/relay_rtsp.c
RELAY_UNIT_LIBS := $(shell $(PKG_CONFIG) --libs libavutil)
RELAY_FUZZ_SECONDS ?= 2
RELAY_FUZZ_SEED ?= 186

# THE CAPTURE GUARD (task 4 blueprint row 23, WP-02; needed by experiment E-7): a THIRD separate program, ONE source
# file under src/guard/ (a folder neither check.sh nor relay-check.sh reads), no library but the system's. It
# starts one helper, ends it when its own standard input ends or its parent goes away, reaps it and passes its
# exit on (src/guard/guard.c has the whole picture).
#   make guard         build/capture-guard and the double, then test/guard_test.py: the guard's static rules and
#                      import net with their controls, and its behaviour measured on doubles (about 10 s; no port)
# It is built with the relay's hardening flags; its binary is build/capture-guard - not a `capture-worker-<name>`.
GUARD_BIN    := $(BUILD)/capture-guard
GUARD_SRC    := src/guard/guard.c
GUARD_CFLAGS := -std=c11 -D_DEFAULT_SOURCE -O2 -g -Wall -Wextra -Werror $(RELAY_HARDEN)

.PHONY: all clean check selftest versions proof unit fixtures e2e relay relay-check relay-unit relay-asan relay-fuzz relay-fuzz-controls guard

all: check selftest unit $(BIN) relay guard

guard: $(GUARD_BIN) $(BUILD)/guard_double
	@CC="$(CC)" python3 test/guard_test.py all

$(GUARD_BIN): $(GUARD_SRC) Makefile
	@mkdir -p $(BUILD)
	$(CC) $(GUARD_CFLAGS) -o $@ $(GUARD_SRC) $(RELAY_HARDEN_LD)

# The double of a helper for the guard's checks (test code; it never ends because its input ended).
$(BUILD)/guard_double: test/guard_double.c Makefile
	@mkdir -p $(BUILD)
	$(CC) -std=c11 -D_DEFAULT_SOURCE -O2 -Wall -Wextra -Werror -o $@ $<

relay: relay-check relay-unit relay-asan relay-fuzz $(RELAY_BIN)

relay-check:
	@sh relay-check.sh src/relay
	@sh relay-check.sh --selftest

relay-unit:
	@mkdir -p $(BUILD)
	@$(CC) $(RELAY_TEST_CFLAGS) -O2 -o $(BUILD)/relay_unit_test $(RELAY_UNIT_SRC) $(RELAY_UNIT_LIBS) && $(BUILD)/relay_unit_test

# The unit checks under the sanitizers, then their negative controls: `file|sed script|what`. A control that
# changes nothing (the line it removes is gone) is stale and fails the build; one that still passes shows a check
# that cannot fail.
relay-asan:
	@mkdir -p $(BUILD)
	@$(CC) $(RELAY_TEST_CFLAGS) $(RELAY_SAN) -o $(BUILD)/relay_unit_test_san $(RELAY_UNIT_SRC) $(RELAY_UNIT_LIBS)
	@echo "relay-asan: the unit checks built with AddressSanitizer and UndefinedBehaviorSanitizer:" && $(BUILD)/relay_unit_test_san
	@for control in 'relay_core.c~s/if (!one || one > n) { p->damaged = 1; return 0; }/if (!one) { p->damaged = 1; return 0; }/~the size of a unit among several is not held to the packet (review case 32: the sanitizer must report the read)' \
	                'relay_core.c~s/if (lengths++) return -1;/if (lengths++) body = 0;/~a second Content-Length is taken (review case 9)' \
	                'relay_core.c~s/if (codes == p->units) return 1;/if (codes) return 1;/~a start code inside a unit is handed on (review case 34, M-2)'; do \
	  file=$${control%%~*}; rest=$${control#*~}; script=$${rest%%~*}; what=$${rest#*~}; \
	  rm -rf $(BUILD)/relay-control; mkdir -p $(BUILD)/relay-control/src/relay $(BUILD)/relay-control/test; \
	  cp src/relay/*.c src/relay/*.h $(BUILD)/relay-control/src/relay/; cp test/relay_unit_test.c $(BUILD)/relay-control/test/; \
	  sed "$$script" src/relay/$$file > $(BUILD)/relay-control/src/relay/$$file; \
	  if cmp -s src/relay/$$file $(BUILD)/relay-control/src/relay/$$file; then echo "relay_unit_test: the control '$$what' changed nothing: it is stale"; exit 1; fi; \
	  ( cd $(BUILD)/relay-control && $(CC) $(RELAY_TEST_CFLAGS) $(RELAY_SAN) -o unit $(RELAY_UNIT_SRC) $(RELAY_UNIT_LIBS) ) || exit 1; \
	  if { $(BUILD)/relay-control/unit > $(BUILD)/relay-control/out 2>&1; } 2>/dev/null; then echo "relay_unit_test: with this bound removed the sanitizer build still passes - the check cannot fail: $$what"; exit 1; \
	  else echo "relay_unit_test: fails as required when $$what (negative control; $$(grep -c 'ERROR: AddressSanitizer' $(BUILD)/relay-control/out) sanitizer report, $$(grep -c 'FAILED: ' $(BUILD)/relay-control/out) failed check line(s))"; fi; \
	done; rm -rf $(BUILD)/relay-control
	@$(CC) $(RELAY_TEST_CFLAGS) -URELAY_TEST_HOOKS $(RELAY_SAN) -o $(BUILD)/capture-relay-san $(RELAY_SRC) $(RELAY_LDLIBS)

relay-fuzz:
	@mkdir -p $(BUILD)
	@$(CC) $(RELAY_TEST_CFLAGS) $(RELAY_SAN) -o $(BUILD)/relay_fuzz test/relay_fuzz.c src/relay/relay_core.c src/relay/relay_rtsp.c $(RELAY_UNIT_LIBS)
	@$(BUILD)/relay_fuzz --seconds $(RELAY_FUZZ_SECONDS) --seed $(RELAY_FUZZ_SEED)

# NOT part of `make` (22 sanitizer builds, about 3 minutes): does the fuzz build FIND a planted flaw? One bound
# removed per copy of the sources; every one must be found (test/relay_fuzz_controls.sh).
relay-fuzz-controls:
	@CC="$(CC)" PKG_CONFIG="$(PKG_CONFIG)" sh test/relay_fuzz_controls.sh $(RELAY_FUZZ_CONTROL_SECONDS)

# The version pin of check.sh (test/static/libavformat.pin) holds for this build as well: relay-check.sh compares
# the relay's own pin with that file, and `make` runs `check` before it comes here.
$(RELAY_BIN): $(RELAY_SRC) $(RELAY_HDR) Makefile relay-check.sh
	@mkdir -p $(BUILD)
	$(CC) $(RELAY_CFLAGS) -o $@ $(RELAY_SRC) $(RELAY_HARDEN_LD) $(RELAY_LDLIBS)
	@sh relay-check.sh --imports $@ || { rm -f $@; exit 1; }

# The worker itself. After the link, THE IMPORT NET (review R63-08): the file-making functions the BINARY imports
# are exactly the pinned ones (test/static/imports.pin) - whatever the spelling in the sources was (an alias through
# an assembler label, a name glued by the preprocessor). A binary that imports another one is removed.
$(BIN): $(SRC) $(HDR) Makefile test/static/imports.pin test/static/pinned_calls.py
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) -o $@ $(SRC) $(LDLIBS)
	@python3 test/static/pinned_calls.py --imports $@ test/static/imports.pin || { rm -f $@; exit 1; }

check:
	@sh check.sh src

selftest:
	@sh check.sh --selftest

# The ONE occurrence of a forbidden mux option outside the planted sources of the self-test: the
# negative control of M3-AV-1/2 (capture spec C.4). It shifts the whole video track by about
# 450 ms while the file still decodes. check.sh holds this file to exactly this one line.
proof: check
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='"use_editlist=1"' -o $(BUILD)/capture-worker-negctl $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_MOVFLAGS='"+frag_keyframe+delay_moov+default_base_moof+skip_trailer"' -o $(BUILD)/capture-worker-delaymoov $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_PROOF_NO_REFUSAL_EXIT -o $(BUILD)/capture-worker-norefusal $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DMIC_MAX_PPM=0 -o $(BUILD)/capture-worker-nocomp $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_PROOF_WRITE_FAULT=3 -o $(BUILD)/capture-worker-writefault $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_PROOF_WRITE_FAULT=3 -DDEMS_PROOF_KEEP_TORN_TAIL -o $(BUILD)/capture-worker-writefault-notrunc $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_PROOF_INTERVAL_SKEW=480 -o $(BUILD)/capture-worker-intervalskew $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_PROOF_NO_CLOCK_FLOOR -o $(BUILD)/capture-worker-nofloor $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_PROOF_NO_FRAGMENT_BOUND -o $(BUILD)/capture-worker-nobound $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_PROOF_ANNOUNCE_UNSEEN -o $(BUILD)/capture-worker-noannounce $(SRC) $(LDLIBS)

unit:
	@mkdir -p $(BUILD)
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -o $(BUILD)/anchor_test test/anchor_test.c src/anchor.c -lm && $(BUILD)/anchor_test
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -DOLD_SLEW -o $(BUILD)/anchor_test_old test/anchor_test.c src/anchor.c -lm && { $(BUILD)/anchor_test_old >/dev/null && { echo "anchor_test: the old slew rule passes: the test cannot fail"; exit 1; } || echo "anchor_test: the old slew rule fails it, as required (negative control)"; }
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -DNO_TICK -o $(BUILD)/anchor_test_notick test/anchor_test.c src/anchor.c -lm && { $(BUILD)/anchor_test_notick >/dev/null && { echo "anchor_test: without the tick on report-less packets the test passes: the R-1 check cannot fail"; exit 1; } || echo "anchor_test: without the tick on report-less packets it fails, as required (negative control, R-1)"; }
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -DFIRST_LIVE_ONLY -o $(BUILD)/anchor_test_firstlive test/anchor_test.c src/anchor.c -lm && { $(BUILD)/anchor_test_firstlive >/dev/null && { echo "anchor_test: judging the first live packet alone passes: the clock-floor check cannot fail"; exit 1; } || echo "anchor_test: judging the first live packet alone gives the stalled camera up, as required (negative control, row 71 clock floor)"; }
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -DNO_FLOOR -o $(BUILD)/anchor_test_nofloor test/anchor_test.c src/anchor.c -lm && { $(BUILD)/anchor_test_nofloor >/dev/null && { echo "anchor_test: without the clock floor the test passes: the check of a clock behind cannot fail"; exit 1; } || echo "anchor_test: without the clock floor a clock 2.6 s behind is kept, as required (negative control, row 71 clock floor)"; }
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -o $(BUILD)/micwatch_test test/micwatch_test.c src/micwatch.c -lm && $(BUILD)/micwatch_test
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -DMICWATCH_PROOF_NO_DEBOUNCE -o $(BUILD)/micwatch_test_nodebounce test/micwatch_test.c src/micwatch.c -lm && { $(BUILD)/micwatch_test_nodebounce >/dev/null && { echo "micwatch_test: a raiser without its durations passes: M5-WARN-1 cannot fail"; exit 1; } || echo "micwatch_test: a raiser that warns at once fails it, as required (negative control, M5-WARN-1)"; }
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -o $(BUILD)/announce_test test/announce_test.c src/announce.c && $(BUILD)/announce_test
	@$(CC) $(CFLAGS) -o $(BUILD)/sink_kill_test test/sink_kill_test.c src/sink.c $(LDLIBS) && $(BUILD)/sink_kill_test $(BUILD)/sink_kill 200
	@$(CC) $(CFLAGS) -o $(BUILD)/writer_test test/writer_test.c src/sink.c $(LDLIBS) && $(BUILD)/writer_test $(BUILD)/writer_scratch
	@$(CC) $(CFLAGS) -DDEMS_PROOF_KEEP_TORN_TAIL -o $(BUILD)/writer_test_notrunc test/writer_test.c src/sink.c $(LDLIBS) && { $(BUILD)/writer_test_notrunc $(BUILD)/writer_scratch_notrunc > $(BUILD)/writer_test_notrunc.out; rc=$$?; \
	  n=$$(grep -c 'FAILED: .*TRUNCATION' $(BUILD)/writer_test_notrunc.out); o=$$(grep 'FAILED: ' $(BUILD)/writer_test_notrunc.out | grep -vc 'TRUNCATION'); \
	  if [ $$rc -ne 0 ] && [ $$n -ge 2 ] && [ $$o -eq 0 ]; then echo "writer_test: without the truncation it fails on the $$n truncation checks and on nothing else, as required (negative control)"; \
	  else echo "writer_test: the build without truncation gave rc $$rc, $$n truncation failures, $$o other failures: the truncation check cannot fail, or fails for another reason"; cat $(BUILD)/writer_test_notrunc.out; exit 1; fi; }
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -DNO_LEAD -o $(BUILD)/anchor_test_nolead test/anchor_test.c src/anchor.c -lm && { $(BUILD)/anchor_test_nolead >/dev/null && { echo "anchor_test: without the untimestamped lead the test passes: the skipped-span check cannot fail"; exit 1; } || echo "anchor_test: the span without the untimestamped lead fails it, as required (negative control, review R63-13)"; }
	@for control in 'nobound|-DDEMS_PROOF_NO_FRAGMENT_BOUND|SIZE BOUND|review R63-02: without the size bound' 'silentsync|-DDEMS_PROOF_SILENT_SYNC_FALLBACK|SYNC LEVEL|review R63-09: with the silent sync fallback'; do \
	  name=$${control%%|*}; rest=$${control#*|}; flag=$${rest%%|*}; rest=$${rest#*|}; mark=$${rest%%|*}; what=$${rest#*|}; \
	  $(CC) $(CFLAGS) $$flag -o $(BUILD)/writer_test_$$name test/writer_test.c src/sink.c $(LDLIBS) || exit 1; \
	  $(BUILD)/writer_test_$$name $(BUILD)/writer_scratch_$$name > $(BUILD)/writer_test_$$name.out; rc=$$?; \
	  n=$$(grep -c "FAILED: .*$$mark" $(BUILD)/writer_test_$$name.out); o=$$(grep 'FAILED: ' $(BUILD)/writer_test_$$name.out | grep -vc "$$mark"); \
	  if [ $$rc -ne 0 ] && [ $$n -ge 2 ] && [ $$o -eq 0 ]; then echo "writer_test: $$what it fails on the $$n checks of that rule and on nothing else, as required (negative control)"; \
	  else echo "writer_test: the build $$flag gave rc $$rc, $$n failures of its rule, $$o other failures: the check cannot fail, or fails for another reason"; cat $(BUILD)/writer_test_$$name.out; exit 1; fi; done
	@sh test/start_checks.sh $(BUILD) "$(CC) $(CFLAGS)" "$(SRC)" "$(LDLIBS)"
	@$(CC) $(CFLAGS) -o $(BUILD)/log_test test/log_test.c src/ipc.c $(LDLIBS) && $(BUILD)/log_test $(BUILD)/log_test.jsonl
	@$(CC) $(CFLAGS) -DLOG_SHARED_QUOTA -o $(BUILD)/log_test_shared test/log_test.c src/ipc.c $(LDLIBS) && { $(BUILD)/log_test_shared $(BUILD)/log_test_shared.jsonl >/dev/null && { echo "log_test: with one shared quota the test passes: the per-source check cannot fail"; exit 1; } || echo "log_test: with one shared quota it fails, as required (negative control, R-4)"; }

# NM-14 fixture set (blueprint row 60; capture spec A.8): the fake camera, the fake mics and the
# vendored row-111 skeleton that M3-RTSP-BIND-1 must fail on. Sources in test-fixtures/ only.
fixtures: $(FIXTURES)

$(BUILD)/fake_cam: test-fixtures/fake_cam.c Makefile
	@mkdir -p $(BUILD)
	$(CC) -O2 -Wall -Wextra -o $@ $< $(shell $(PKG_CONFIG) --cflags --libs libavformat libavcodec libavutil) -lm

$(BUILD)/fake_mic: test-fixtures/fake_mic.c Makefile
	@mkdir -p $(BUILD)
	$(CC) -std=c11 -D_DEFAULT_SOURCE -O2 -Wall -Wextra -Werror -o $@ $< -lm

# Row 71: the scripted fake microphones of the warning checks (silence, no delivery). Source in test/ (a test tool of m5mic.py).
$(BUILD)/m5_mic: test/m5_mic.c Makefile
	@mkdir -p $(BUILD)
	$(CC) -std=c11 -D_DEFAULT_SOURCE -O2 -Wall -Wextra -Werror -o $@ $< -lm

# Task 4 row N3: the stand-in of a gapped microphone writer (protocol version 5): whole packets of 512 left out in a known
# pattern, a marker signal. Source in test/ (a test tool of n3gapped.py).
$(BUILD)/gapped_mic: test/gapped_mic.c Makefile
	@mkdir -p $(BUILD)
	$(CC) -std=c11 -D_DEFAULT_SOURCE -O2 -Wall -Wextra -Werror -o $@ $< -lm

# Row 59: the bytes of a recorded camera file through the writer again (the chain-equality check of the e2e series).
$(BUILD)/writer_replay: test/writer_replay.c src/sink.c $(HDR) Makefile
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) -o $@ test/writer_replay.c src/sink.c $(LDLIBS)

$(BUILD)/capture-worker-skeleton111: test-fixtures/negative-control/skeleton111.c Makefile
	@mkdir -p $(BUILD)
	$(CC) -std=c11 -D_DEFAULT_SOURCE -O2 -o $@ $< $(shell $(PKG_CONFIG) --cflags --libs libavformat libavcodec libavfilter libavutil) -lm -lpthread

# THE capture end-to-end target: the whole series on the fixtures, every check and every negative
# control twice, ONE aggregate exit code (0 only when every verdict is the expected one). It binds
# two loopback ports of 8554-8564 (sandbox off), takes about 35 minutes on an idle host, and is
# NOT part of `npm test`. Re-run it after any FFmpeg upgrade. See README.md, "How to run the
# capture e2e". Options go through E2E_ARGS, e.g. make e2e E2E_ARGS="--only av1_ --runs 1".
# It takes the shared heavy-host lock (.locks/heavy-host.lock at the repository root, /usr/bin/lockf,
# waits up to 30 minutes, exit 75 if it cannot be had) so that it never overlaps an STT engine run
# or another series. A caller that already holds the lock passes E2E_NO_LOCK=1.
e2e:
	@E2E_NO_LOCK=$(E2E_NO_LOCK) python3 test/e2e.py $(E2E_ARGS)

versions:
	@$(PKG_CONFIG) --modversion $(LIBS_PC)
	@$(PKG_CONFIG) --variable=libdir libavformat

clean:
	rm -rf $(BUILD)
