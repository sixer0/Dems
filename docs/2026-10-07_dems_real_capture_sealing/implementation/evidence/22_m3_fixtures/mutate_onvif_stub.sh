#!/bin/zsh
# Blueprint row 60: the tests of the fake ONVIF stub must be able to fail. Eight mutations of
# apps/core-server/test/support/fake-onvif-stub.ts, one at a time; each must turn at least one test
# red. The file is restored from a copy and its SHA-256 compared at the end.
# Run from the repository root, sandbox off (the tests bind 127.0.0.1):  zsh <this file>
F=apps/core-server/test/support/fake-onvif-stub.ts
S=$(mktemp -d); cp $F $S/stub.orig; before=$(shasum -a 256 $F | cut -d' ' -f1)
mut() { name=$1; shift; cp $S/stub.orig $F; python3 - "$F" "$@" <<'PY'
import sys
p, a, b = sys.argv[1:4]; s = open(p).read(); assert s.count(a) >= 1, (a, s.count(a)); open(p, 'w').write(s.replace(a, b))
PY
  out=$(npx vitest run --root apps/core-server --project unit test/support/fake-onvif-stub.test.ts </dev/null 2>&1)
  echo "=== $name: $(echo "$out" | grep -E '^\s+Tests ' | tr -s ' ')"; }
mut "M1 NORMAL answers with a foreign RelatesTo" "return deviceList.map((device) => probeMatches(messageId, probeMatch(device, deviceServiceUrl)));
      case 'WRONG_RELATES_TO':" "return deviceList.map((device) => probeMatches('urn:uuid:other', probeMatch(device, deviceServiceUrl)));
      case 'WRONG_RELATES_TO':"
mut "M2 password in clear not recorded" "if (clear) violationList.push({ code: 'PASSWORD_IN_CLEAR', channel: 'device', operation });" "void clear;"
mut "M3 TCP listeners on every interface" "server.listen({ host: FAKE_ONVIF_HOST, port, exclusive: true }" "server.listen({ host: '::', port, exclusive: true }"
mut "M4 SETUP allowed" "const RTSP_ALLOWED_METHODS: readonly string[] = ['OPTIONS', 'DESCRIBE'];" "const RTSP_ALLOWED_METHODS: readonly string[] = ['OPTIONS', 'DESCRIBE', 'SETUP'];"
mut "M5 token digest not compared" "if (expected !== (passwordTag[2] ?? '').trim()) return 'INVALID';" "void expected;"
mut "M6 operation outside the list answered" "if (!(FAKE_ONVIF_ALLOWED_OPERATIONS as readonly string[]).includes(operation)) {" "if (operation === 'never') {"
mut "M7 a port outside the range accepted" "port < FAKE_ONVIF_PORT_MIN || port > FAKE_ONVIF_PORT_MAX" "port < 1 || port > 65535"
mut "M8 UDP on every interface" "socket.bind({ address: FAKE_ONVIF_HOST, port: ports.discovery, exclusive: true }" "socket.bind({ port: ports.discovery, exclusive: true }"
cp $S/stub.orig $F; after=$(shasum -a 256 $F | cut -d' ' -f1)
[ "$before" = "$after" ] && echo "=== RESTORED (sha256 equal): $(npx vitest run --root apps/core-server --project unit test/support/fake-onvif-stub.test.ts </dev/null 2>&1 | grep -E '^\s+Tests ' | tr -s ' ')" || echo "=== RESTORE FAILED"
