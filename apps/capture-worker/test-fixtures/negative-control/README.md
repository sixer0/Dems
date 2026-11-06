# Negative-control sources (NM-14, blueprint row 60)

`skeleton111.c` is the capture-worker skeleton of blueprint row 111, byte for byte as it was
committed (`apps/capture-worker/src/capture_worker.c` at commit 101ce62; SHA-256
`bc08286c8b05472dc7d139732d0a6fc42ef8b7f625655f974ebf401dc1fd2894`). It is vendored here so that
the end-to-end target needs neither the docs tree nor git history (pair-58 finding F-14).

It is kept for ONE purpose: `M3-RTSP-BIND-1` must fail on it. When a client asks for RTP over UDP,
this program opens datagram sockets on every interface (`UDP *:5000`, `UDP *:5001`), which the
real worker never does. `make -C apps/capture-worker fixtures` builds it as
`build/capture-worker-skeleton111`; the harness starts it only in `udp --variant skeleton`, for
about 8 seconds, with a loopback client.

Do not edit it, do not copy from it, and do not start it for anything else. The static rules of
`check.sh` cover `src/` only; this file would fail several of them, by design.
