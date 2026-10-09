#!/bin/zsh
# Negative controls by mutation for the supervisor and forwarder rules of row 58 (incl. fix round 1).
# Usage (repository root):  .cache/row58/mutate.sh     Each mutation is applied, src/capture is run, the file is restored.
mkdir -p .cache/row58
S=apps/core-server/src/capture/supervisor.ts; W=apps/core-server/src/capture/forwarder.ts
cp $S .cache/row58/supervisor.ts.orig; cp $W .cache/row58/forwarder.ts.orig
run() { npx vitest run --root apps/core-server --project unit src/capture </dev/null 2>&1 | grep -E "^ +(Test Files|Tests)" | tr -s ' ' | tr '\n' ';' ; echo }
mut() { # name, file, 'old=>new'
  cp .cache/row58/supervisor.ts.orig $S; cp .cache/row58/forwarder.ts.orig $W
  python3 - "$2" "$3" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read(); a,b=sys.argv[2].split('=>',1)
assert s.count(a)==1,(a,s.count(a)); open(p,'w').write(s.replace(a,b))
PY
  echo -n "MUTATION $1 :: "; run
}
mut "M1 option C term removed" $S "cause.retryable === false || current.durable || current.restarts=>cause.retryable === false || current.restarts"
mut "M2 record through the lossy queue" $S "    emit({ name: 'record', sessionId: current.id, correlationId: current.correlationId, attempt: from.attempt, seq: message.seq, record });=>    emitFromWorker({ name: 'record', sessionId: current.id, correlationId: current.correlationId, attempt: from.attempt, seq: message.seq, record } as never);"
mut "M3 sequence not checked" $S "    if (message.seq !== current.recordSeq + 1) return refuse('RECORD_SEQUENCE_GAP');=>"
mut "M4 own events handed out mid-step" $S "    outbox.push(event);
    if (depth === 0) handOut();=>    deliverOwn(event);"
mut "M5 queue not cleared at session end" $S "      session = null;
      dropQueued(ended);=>      session = null;"
mut "M6 warning subject not checked" $S "if (message.subject !== null && !current.subjects.has(message.subject)) {=>if (false as boolean) {"
mut "M7 OUTPUT_EXISTS does not mark durable" $S "if (result.ack.code === OUTPUT_EXISTS) current.durable = true;=>"
mut "M8 (A-8) a retired worker's message is processed" $S "      onLateMessage(from, message);
      return;
    }=>      onLateMessage(from, message);
    }"
mut "M9 (A-5) record rate not limited" $S "if (from.recordTimes.length >= limits.recordBurstLimit) return refuse('RECORD_RATE_EXCEEDED');=>"
mut "M10 (A-7) no refusal is final" $S "const final = result.ack.code !== undefined && FINAL_START_REFUSALS.includes(result.ack.code);=>const final = false as boolean;"
mut "M11 (A-10) repeated once-only record accepted" $S "if (from.reported.has(once)) return refuse('RECORD_REPEATED');=>"
mut "M12 (A-10) record after seal accepted" $S "if (from.sealed) return refuse('RECORD_AFTER_SEAL');=>"
mut "M13 (A-8) late durable record ignored" $S "    if (message.type !== WorkerMessageType.RECORD || !DURABLE_RECORD_KINDS.includes(message.record.kind)) return;
    current.durable = true;=>    if (message.type !== WorkerMessageType.RECORD || message.type === WorkerMessageType.RECORD) return;
    current.durable = true;"
mut "M14 (A-2) the supervisor's own fault is never cleared" $S "if (ownFault !== null && ownFault.correlationId !== current.correlationId) {=>if (false as boolean && ownFault !== null) {"
mut "M15 (A-6) record without its attempt" $S "attempt: from.attempt, seq: message.seq, record });
  }=>attempt: 0, seq: message.seq, record });
  }"
mut "M16 (D72k) final crash code retried" $S "...(FINAL_CRASH_CODES.includes(message.code) ? { retryable: false } : {})=>"
mut "F1 (A-2) clear without the hold" $W "at - entry.clearedAt >= CAPTURE_WARNING_CLEAR_HOLD_MS=>at - entry.clearedAt >= 0"
mut "F2 (A-2) a re-raise inside the hold raises again" $W "    if (known !== undefined) {
      // Still raised=>    if (known !== undefined && (false as boolean)) {
      // Still raised"
mut "F3 (A-2) no clear when a later session records" $W "if (entry.correlationId !== event.correlationId) clear(host, entry);=>if (entry.correlationId !== event.correlationId && (false as boolean)) clear(host, entry);"
mut "F4 (A-13) report not guarded" $W "    try {
      options.report(entry);
    } catch {
      // Nowhere left to say it.
    }=>    options.report(entry);"
cp .cache/row58/supervisor.ts.orig $S; cp .cache/row58/forwarder.ts.orig $W
echo -n "RESTORED :: "; run
