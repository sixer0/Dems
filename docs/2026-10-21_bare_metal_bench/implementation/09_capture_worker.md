# Row 29: capture worker (HOST-14)

Date: 2026-10-22, host .73 (D30). `make -C apps/capture-worker check selftest unit build/capture-worker` in unit `dems-host-build-row29`: exit `0` (log /var/log/dems-host-build-row29.log: static rules, self-tests incl. negative controls, unit checks, e.g. "writer_test: all checks hold", "start_checks: all checks hold", "sink_kill_test: 200 kills ... violations 0").
`ldd`: libavformat.so.63 from /opt/dems/ffmpeg-9.0.2/lib `1`; `not found` `0`; `namei` every component root, no group/other w. All as expected.
