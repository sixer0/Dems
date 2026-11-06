# Row 30: camera relay (HOST-15 relay part)

Date: 2026-10-22, host .73 (D30). `make -C apps/capture-worker relay-check relay-unit build/capture-relay`: exit `0` ("relay-check.sh: build/capture-relay: import net OK"). `ldd` libavformat.so.63 from the prefix `1`; `make versions` lines with 63.1.102: `2` (>=1). All as expected.
