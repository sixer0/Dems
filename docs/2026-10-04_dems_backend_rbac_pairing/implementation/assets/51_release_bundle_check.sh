#!/bin/sh
# W51: what a RELEASE bundle of the app holds of the Live layer and of the debug hooks, measured on
# two real bundles (`expo export`, output in a temporary folder, nothing served, nothing installed).
# Run from the repository root:
#   /bin/sh docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/51_release_bundle_check.sh <tmp folder>
# The method is the one of W12 and W15 (`12_release_bundle_check.sh`, `15_release_bundle_check.log`).
set -u
O=${1:?usage: 51_release_bundle_check.sh <tmp folder>}
H=$(dirname "$0")
mkdir -p "$O"
count() { printf '  %-44s %s\n' "$2" "$(grep -c -F -- "$2" "$1")"; }

echo "## W51 release-bundle check ($(date '+%Y-%m-%d %H:%M:%S')); a count is the number of bundle lines that hold the text"
echo
echo "## 1. Metro's release transform of the row's files (node $H/51_release_gate_w51.cjs)"
node "$H/51_release_gate_w51.cjs" | grep -E '^    |required' | cut -c1-420
echo "exit=$?"
echo
echo "## 1b. The earlier rows' transform check, unchanged (node $H/15_release_gate_w15.cjs)"
node "$H/15_release_gate_w15.cjs" | grep -E '^    '
echo

echo "## 2. Release bundle"
echo "\$ EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 CI=1 npm exec -w @dems/mobile -- expo export --platform android --no-bytecode --output-dir <tmp>/release"
EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 CI=1 npm exec -w @dems/mobile -- expo export --platform android --no-bytecode --output-dir "$O/release" >"$O/release.log" 2>&1
echo "release exit=$?"
grep -E "Bundled|entry-|Exported" "$O/release.log" | sed "s#$O#<tmp>#g"
R=$(ls "$O"/release/_expo/static/js/android/*.js)
echo "bundle bytes: $(wc -c <"$R" | tr -d ' ')"
echo "probe and debug text of the earlier rows (must be 0):"
for s in "DEMS-PROBE-W15" "DEMS-PROBE-W12" "dev-probes" "runDevProbe" "devProbeFromUrl" "probe=" "secure-store-wait" "dems.live.probe.v1" "DEMS secure-store probe" "secureStoreDevProbe" "PROBE_W15_"; do count "$R" "$s"; done
echo "the Live layer of this row (must be 0): the Live source, the typed client, the adapters' body, the wrapper"
for s in "createLiveSim" "createCoreClient" "CoreClientUsageError" "createCommandGate" "DEVICE_CLEANUP_GAVE_UP" "DEMS-LIVE" "runtime.live.registration" "runtime.live.credentials" "Bearer " "secure-credentials" "dems.live.device.v1" "ExpoSecureStore" "isUnprotectedBiometricItemAllowed" "Core link source set from a deep link"; do count "$R" "$s"; done
echo "what does ship (texts that must be there, or are there by the shared package's own layout):"
for s in "runtime.sim.hydrated" "scenario=" "runtime.live.unavailable" "limiting requests from this tablet" "LiveTransportError" "CoreRefusalError" "createLiveSocketClient" "core=([^&#]*)"; do count "$R" "$s"; done
echo

echo "## 3. Development bundle (positive control: the same texts are found where they must be)"
echo "\$ EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 CI=1 npm exec -w @dems/mobile -- expo export --dev --platform android --no-bytecode --output-dir <tmp>/dev"
EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 CI=1 npm exec -w @dems/mobile -- expo export --dev --platform android --no-bytecode --output-dir "$O/dev" >"$O/dev.log" 2>&1
echo "dev exit=$?"
grep -E "Bundled|entry-|Exported" "$O/dev.log" | sed "s#$O#<tmp>#g"
D=$(ls "$O"/dev/_expo/static/js/android/*.js)
echo "bundle bytes: $(wc -c <"$D" | tr -d ' ')"
for s in "DEMS-PROBE-W15" "runtime/dev-probes.ts" "createLiveSim" "createCoreClient" "live/source/live-sim.ts" "client/core-client.ts" "DEVICE_CLEANUP_GAVE_UP" "DEMS-LIVE" "runtime.live.registration" "runtime/secure-credentials.ts" "dems.live.device.v1" "Core link source set from a deep link" "runtime.sim.hydrated" "limiting requests from this tablet"; do count "$D" "$s"; done
