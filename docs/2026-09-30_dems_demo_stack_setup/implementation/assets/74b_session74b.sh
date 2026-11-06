# Step 74b measurement session. Runs INSIDE apps/mobile/scripts/device-session.sh (phone lock held),
# which exports SERIAL, APP_ID, METRO_LOG, ROOT. Method = step 74 (verification/assets/74_cold_start_evidence.txt):
# am force-stop, logcat -c, am start -d 'demsdemo:///stack-check?motion=off', device logcat markers.
# Protocol (review 74 section 2.4): 1 warm-up launch (fresh Metro graph, not counted) + 5 measured cold starts,
# median of START -> Displayed. If the median > 4.5 s: taskpolicy -t 0 -l 0 on both emulator PIDs, 5 more.
set -u
S=/private/tmp/claude-501/-Users-gsp-budi-Documents-DEMS/0d71fd65-4a51-4019-9c48-5c92d11bbdaf/scratchpad/s74b
OUT=$S/run_${SERIAL}_$(date +%H%M%S); mkdir -p "$OUT"; echo "OUT=$OUT"
PP=$(cat "$ROOT/.locks/dems_phone.pid"); TP=$(cat "$ROOT/.locks/dems_tablet.pid")
T="$OUT/timeline.txt"

hist() { ps -M -p "$1" | awk 'NR>1{for(i=1;i<=NF;i++) if($i ~ /^[0-9]+[TRF]$/){print $i; break}}' | sort | uniq -c | sort -rn | tr '\n' ' ' | tr -s ' '; }
secs() { # HH:MM:SS.mmm of the first logcat line matching $2 in file $1 -> seconds of day
  awk -v re="$2" '$0 ~ re { split($2, a, ":"); printf "%.3f\n", a[1]*3600 + a[2]*60 + a[3]; exit }' "$1"
}
d() { if [ -n "$1" ] && [ -n "$2" ]; then awk -v a="$1" -v b="$2" 'BEGIN{printf "%.2f", b-a}'; else echo "?"; fi; }

launch() { # $1 label
  adb -s "$SERIAL" shell am force-stop "$APP_ID"; sleep 2
  echo "== $1 $(date +%H:%M:%S) host loadavg $(sysctl -n vm.loadavg) | qemu phone pri/nice $(ps -o pri=,nice= -p $PP | tr -s ' ')" >> "$T"
  adb -s "$SERIAL" logcat -c
  adb -s "$SERIAL" shell "am start -a android.intent.action.VIEW -d 'demsdemo:///stack-check?motion=off' $APP_ID" >/dev/null
  sleep 3
  echo "  +3s: phone threads $(hist $PP)| qemu %cpu $(ps -o pcpu= -p $PP | tr -d ' ') | guest $(adb -s $SERIAL shell cat /proc/loadavg | tr -d '\r')" >> "$T"
  i=0
  until adb -s "$SERIAL" logcat -d -b system 2>/dev/null | grep -q "ActivityTaskManager: Displayed $APP_ID"; do
    i=$((i + 1)); [ "$i" -gt 54 ] && break; sleep 0.5
  done
  sleep 1.5
  adb -s "$SERIAL" logcat -d -b main,system -v threadtime > "$OUT/$1_logcat.txt" 2>&1
  L="$OUT/$1_logcat.txt"
  s=$(secs "$L" "ActivityTaskManager: START u0"); c=$(secs "$L" "Configuring clns-9"); lb=$(secs "$L" "loadJSBundleFromMetro"); bl=$(secs "$L" "Creating BundleLoader")
  lj=$(secs "$L" "Loading JS Bundle"); rm=$(secs "$L" "Running \"main\""); hy=$(secs "$L" "runtime.sim.hydrated"); di=$(secs "$L" "ActivityTaskManager: Displayed"); sp=$(secs "$L" "remove starting view")
  tot=$(d "$s" "$di")
  echo "  phases: procToClassLoader $(d "$s" "$c") | bundleDownload $(d "$lb" "$bl") | bundleLoad->main $(d "$lj" "$rm") | main->hydrated $(d "$rm" "$hy") | hydrated->Displayed $(d "$hy" "$di") | TOTAL START->Displayed $tot | splashRemoved $(d "$s" "$sp")" >> "$T"
  grep -m1 "ActivityTaskManager: Displayed" "$L" | cut -c1-160 >> "$T"
  echo "$1 $tot" >> "$OUT/totals.txt"
}
median() { # $1 = prefix of labels in totals.txt
  grep "^$1" "$OUT/totals.txt" | awk '{print $2}' | grep -v '?' | sort -n | awk '{a[NR]=$1} END{ if(NR==0){print "?"} else if(NR%2){print a[(NR+1)/2]} else {printf "%.2f\n",(a[NR/2]+a[NR/2+1])/2} }'
}

{
  echo "# session start $(date '+%F %T %Z') serial $SERIAL metro $METRO_PORT phone PID $PP tablet PID $TP"
  echo "app: $(adb -s $SERIAL shell dumpsys package $APP_ID | grep -E 'versionName|lastUpdateTime' | tr -d '\r' | tr -s ' ' | tr '\n' ' ')"
  echo "phone threads at start: $(hist $PP)"
} >> "$T"

launch W0_warmup
for n in 1 2 3 4 5; do launch "M$n"; done
M=$(median M)
echo "MEDIAN_M (taskpolicy -B only) = $M s" >> "$T"

if [ "$M" = "?" ] || awk -v m="$M" 'BEGIN{exit !(m > 4.5)}'; then
  {
    echo "median > 4.5 s (or unknown): applying throughput/latency QoS tier 0 to both emulators $(date +%H:%M:%S)"
    for p in $PP $TP; do echo "\$ taskpolicy -t 0 -l 0 -p $p"; taskpolicy -t 0 -l 0 -p "$p"; echo "exit $?"; done
    echo "phone threads after -t 0 -l 0: $(hist $PP)"
    echo "tablet threads after -t 0 -l 0: $(hist $TP)"
  } >> "$T" 2>&1
  for n in 1 2 3 4 5; do launch "Q$n"; done
  echo "MEDIAN_Q (taskpolicy -B + -t 0 -l 0) = $(median Q) s" >> "$T"
fi

echo "# session end $(date '+%F %T %Z') host loadavg $(sysctl -n vm.loadavg)" >> "$T"
grep Bundled "$METRO_LOG" >> "$T" 2>/dev/null
cat "$T"
