---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 32
agent: data-analyst-local
milestone: M0
status: complete
output: masterplan/06_evidence_package_spec.md
last_updated: 2026-10-07 10:20
---

# Row 32 — evidence-package spec (delegation progress)

## Output

| File | Content |
|---|---|
| `masterplan/06_evidence_package_spec.md` | §0 decisions + v1 baseline; A package layout (on-disk tree, naming, encrypted-vs-plaintext at rest per OD-03, export contents); B manifest v2 schema — 120 fields each with type + source, plus the self-hash rule and an example shape and the derived export block; C `Signer` interface (OD-04), software Ed25519 on this Mac, TPM/PKCS#11 class C-8 with entry criteria, key storage and rotation; D 14 verify-v2 checks with failure classification incl. the one-fragment tamper expectation (V-08); E sealing pipeline v2 (6 normal steps + 2 OD-21 fallback steps, each checkpoint/resume/progress/failure) plus forward-only progress, the OD-08 crash path and the D223 transcript-wait; F tamper demo re-script on one fragment (OD-02) + dataset/regeneration; G export (OD-16) + composite + E-31 blanking; H deferred/known limits (OD-21 legal, SP-4 fragment quantum, SP-2 fsync, class C); I self-gate |
| `delegation_progress/data-analyst__row32.md` | this file |

## Gate results (stated in §I)

| Gate item | Result |
|---|---|
| Every manifest v2 field has type + source | **120/120** (mechanically counted: 120 field rows, numbered 1..120, distinct) |
| Every sealing step has checkpoint + resume rule + progress source | **8/8** (6 normal + 2 fallback) |
| Verify checks enumerated incl. the one-fragment tamper expectation | **14 checks** (V-01..V-14; tamper = V-08, quoted in §D) |
| OD-02/03/04/08/15/16/21 cited by decision ID | **7/7** |
| Row-33 open point resolved with a stated choice | **PASS — D-EV-1** (§E.5) |

## Row-33 open point (decision taken as the sealing owner)

`delegation_progress/data-analyst__row33.md:69-73` flagged: what happens when STT hard-fails (all chunk
retries exhausted). **Decision D-EV-1 (confirmed + refined):** the package **still seals**; the
transcript step is `DONE` with an explicit `transcript.state='PARTIAL'` and `transcript.failedChunks`
count; the machine transcript is assembled from committed chunks only and **no text is fabricated** for
a failed chunk; `state='ASSEMBLED'` means all chunks `DONE`. This keeps sealed evidence integrity
independent of transcript completeness and makes the incompleteness explicit.

## Alignment cross-references (quoted)

- Row 30 `recording_fragments` columns `session_id,track_id,seq,byte_offset,byte_length,media_start_ms,media_duration_ms,sha256,chain_hash,durable_at` -> §B.6 fields 62-68,70,78; `sealing_jobs` -> §B.8/§E.1; `transcripts`/`transcript_revisions` -> §B.7/§D V-11; `evidence_items` (`:335` hashes / `:336` signature / `:338` tamper) -> §B.1/§B.9/§F.2; `evidence_tracks` (`sha256` = stored, `sha256_plain`) -> §B.4.
- Row 31 writer facts: keyframe-aligned SP-4 -> §B.4 field 50/§B.6 field 72/§H.2; flush != fsync SP-2 -> §B.6 field 78/§H.3; running SHA-256 chain S1 §3.1 -> §B.6/§D V-06; drop-fragment after truncation -> §E.4; per-fragment GCM outside the muxer (F-47/F-52) -> §A.3; restart-per-session supervisor -> §E.4; storage path `media/sessions/<sessionId>/` -> §A.1.

## Register rows cited

SH-06, SH-07, SH-09, SH-11, SH-14, SH-24; CS-08, CS-13, CS-21; NM-04, NM-05, NM-07, NM-08, NM-11,
NM-12 (sections A-G).

## Notes / issues

- The v1 tamper demo (whole `AUDIO-02` track) is replaced by a one-fragment tamper of one camera file;
  the DB keeps `tampered_track_id` permissive (`D-DB-05`) and the **fragment location lives in the
  manifest/verify report** (no v2 fragment column, `dbc-3 §C.6`).
- OD-21 legal confirmation is carried as **unresolved** (no external authority found, coll3 F-102;
  W1-C8); the segments + one lossless concatenation fallback is designed (`CONCATENATE_SEGMENTS`).
- No file outside the task folder touched; no DB connection, no code change, no external service.
- No blocker.
