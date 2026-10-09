# DEMS capture worker (blueprint row 111; Q-WORKER answer (a), D24).
# Links the FFmpeg that is already installed; installs nothing. Output goes to build/ (git-ignored).
# Run from the repository root:  make -C apps/capture-worker
CC         := clang
PKG_CONFIG ?= pkg-config
LIBS_PC    := libavformat libavcodec libavfilter libavutil
CFLAGS     ?= -std=c11 -O2 -g -Wall -Wextra -Werror
CFLAGS     += $(shell $(PKG_CONFIG) --cflags $(LIBS_PC))
LDLIBS     := $(shell $(PKG_CONFIG) --libs $(LIBS_PC)) -lm -lpthread

BUILD := build
BIN   := $(BUILD)/capture-worker
SRC   := src/capture_worker.c

.PHONY: all clean check versions

all: check $(BIN)

$(BIN): $(SRC) Makefile
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) -o $@ $(SRC) $(LDLIBS)

# AU2-07 static rule: exactly one call site of avfilter_graph_send_command, and it lives in
# filter_apply_commands(), which aborts when it is not running on the filtering thread.
check:
	@n=$$(grep -c 'avfilter_graph_send_command(' $(SRC)); \
	 if [ "$$n" != "1" ]; then echo "AU2-07: expected 1 avfilter_graph_send_command call site, found $$n"; exit 1; fi
	@grep -q 'pthread_equal(pthread_self(), w->filter_tid)' $(SRC) || { echo "AU2-07: filtering-thread guard missing"; exit 1; }
	@echo "AU2-07 static rule: OK (1 call site, thread guard present)"

versions:
	@$(PKG_CONFIG) --modversion $(LIBS_PC)
	@$(PKG_CONFIG) --variable=libdir libavformat

clean:
	rm -rf $(BUILD)
