# Row 3 progress: input-av records (data-collector)

Status: complete
Date: 2026-10-12

Artifact: `research/02_collection_input_av_records.md`

Milestones:
- Read the db, audit, settings, security, config, recorder, service, playback, export, audio, storage, mediamtx, netalias, commissioning, main modules, scripts and deploy files.
- 11 declared tables (0 literal CREATE TABLE; tables created by SQLAlchemy create_all at nvr/db.py:250).
- 53 audit.log call sites tabled with action name and file:line.
- 13 disk artifact groups with writer file:line; settings keys site, commissioning, net_aliases.

Blockers: none.
Decisions: none.
Compliance: apps/input-av/data/ not opened, listed or stat-ed; no .env read; input-av not started; nothing written outside the task folder.
Gaps: doctor.py, onvif_client.py, media.py, serializers.py only grepped for write patterns (no write found).
