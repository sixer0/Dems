#!/bin/sh
# W12: prints the release-gate evidence. $1 = folder with dev/, release/, dev.log, release.log (expo export output).
O=$1
H=$(dirname "$0")
count() { printf '  %-28s %s\n' "$2" "$(grep -c -F -- "$2" "$1")"; }
echo "## 1. Metro's release transform of apps/mobile/src/runtime/debug.ts (node .cache/proof-harness/release_gate_w12.cjs)"
node "$H/release_gate_w12.cjs"
D=$(ls "$O"/dev/_expo/static/js/android/*.js)
R=$(ls "$O"/release/_expo/static/js/android/*.js)
echo
echo "## 2. Development bundle"
echo "\$ EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 CI=1 npm exec -w @dems/mobile -- expo export --dev --platform android --no-bytecode --output-dir <tmp>/dev"
grep -E "entry-|Exported|exit=" "$O/dev.log"
echo "bundle bytes: $(wc -c <"$D") (a count is the number of bundle lines that hold the text)"
for s in "DEMS-PROBE-W12" "runtime/dev-probes.ts" "client/core-client.ts" "CoreClientUsageError" "winter/fetch/fetch.ts"; do count "$D" "$s"; done
echo "positive control:"
count "$D" "runtime.sim.hydrated"
echo
echo "## 3. Release bundle"
echo "\$ EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 CI=1 npm exec -w @dems/mobile -- expo export --platform android --no-bytecode --output-dir <tmp>/release"
grep -E "entry-|Exported|exit=" "$O/release.log"
echo "bundle bytes: $(wc -c <"$R")"
for s in "DEMS-PROBE-W12" "dev-probes" "runDevProbe" "devProbeFromUrl" "probe=" "createCoreClient" "CoreClientUsageError" "CONTRACT_VIOLATION"; do count "$R" "$s"; done
echo "positive controls (text of the same file, debug.ts, and of the runtime that must be there):"
count "$R" "runtime.sim.hydrated"
count "$R" "scenario="
