---
task_id: 2026-10-12_input_av_core_adapter_plan
agent: data-analyst
subject: Amendment 1 of masterplan/01_specs.md (rulings U6, U7, U8)
date: 2026-10-12
status: complete
last_updated: 2026-10-12 18:20
---

# Progress: Amendment 1, network commissioning tools

## Status

complete. One file amended in place by targeted edits, one file created (this one). No source file modified, nothing run, nothing under `apps/input-av/data/` and no `.env` opened, nothing written outside the task folder.

## Inputs

- `decisions/decisions.md:16-19`: U6 (tools required), P7 (controller's reading), U7 (home ruled: the Core), U8 (Core database adapted). U7 and U8 arrived from the controller while the amendment was being written and were read in the file before being applied.
- `research/01_explore_input_av.md` sections 5.1, 5.2, 5.5; `research/03_analysis_record_map.md` sections 6, 8, 10; `research/02_collection_rulings.md` sections 3.1, 7.1.
- Read-only, `apps/input-av/`: `nvr/factory.py`, `nvr/netalias.py`, `scripts/dems-netalias`, `nvr/routers/devices.py`, `nvr/registration.py`, parts of `README.md`, `docs/SERAH-TERIMA.md`, `nvr/settings.py`, `nvr/onvif_client.py`, `nvr/discovery.py`, `nvr/db.py`, `nvr/routers/audio.py`, `nvr/service.py`, `scripts/install.sh`, `deploy/dems-nvr.service`. Full list in section 13 of the design.

## Files

| File | Action |
|---|---|
| `masterplan/01_specs.md` | updated (469 to 619 lines) |
| `delegation_progress/amendment_1_network_tools.md` | created |

## Work packages added or changed (for the plan and the register)

| WP | Change | Size | Depends on | Blocked by | Host |
|---|---|---|---|---|---|
| WP-19 | RE-SCOPED: alias helper and factory-address scan as a Core commissioning function (H-29, H-30; S2-3, S2-4; DR-1 to DR-6). No longer contains set-IP. H-28 is not included | M | WP-23 (contract), WP-14 (build) | No longer Q10. Amendments to D75, D80(1), D80(10); Q7; row 13 on the helper | DEV with a fake helper; LINUX-HW |
| WP-22 | ADDED (split from WP-19): set camera IP, fourth credential-carrying operation, wait by MAC, next free address, web console screens (H-31, H-32 without the registration step; S2-5; DR-6 to DR-10, DR-12) | M | WP-19, WP-23 | Amendments to D75, D81 with D80(7), D76 (3); Q7; row 13 on credential path and role | DEV with the ONVIF stub; LINUX-HW with a factory-new camera |
| WP-23 | ADDED (split from WP-19): audit types of M/G-4 and M/G-3, commissioning permission, persistent data for S2 implemented from `masterplan/03_db_schema_extension.md` (S2-6) | S | the schema design of U8 (contract) | Approval of the schema extension; F-4.3 points 6 and 8 for optional parts | DEV |
| WP-14 | EXTENDED by one clause: helper installation with sudoers line and root-owned interface file, `arping`, the camera activation step | M (unchanged) | - | Q7 | LINUX-HW |

Unchanged in number and scope: WP-01 to WP-13, WP-15 to WP-18, WP-20, WP-21. Total 23. WP-12 is unchanged; its unicast probe is shared with WP-19, and its audit type M/G-3 is defined once, in whichever of WP-12 and WP-23 lands first.

New identifiers: change items S2-3 to S2-6; design rules DR-1 to DR-12; security notes SN-1 to SN-6; impact items I-13 to I-16; experiments E-13 to E-15; hypotheses H-S to H-W.

## Decisions and open points for the controller to record

1. U7 is stated in the design as the user's decision (Core). Options (b) standalone tool and (c) input-av as built are each one "not chosen" note. No interim exception for (c) is recorded or proposed.
2. Rulings of task 3 that must be amended by decision rows before WP-19, WP-22, WP-23 can be built (design fork F-4.3): D75 (clause "no configuration change on any discovered device"), D80(1), D80(10) for commissioning, D81 with D80(7) (a fourth credential-carrying operation; credential typed again for adoption or kept for one job), D76 (3) (a set-network step before adoption), RG-4 with D76 (1) only if discovered devices are stored under U8.
3. Still for the user: whether the passive cable monitor H-28 is also required (U6 names the alias only); which role may commission (proposal: TECHNICIAN only, a permission of its own); Q7 (the function is Linux only).
4. For row 13: the privileged helper (DR-2, SN-1, SN-2), the credential path (DR-8, SN-4), the role (DR-9, SN-3), hypothesis H-V on the lock-out guard.
5. Design departures from input-av as built, proposed inside U7: the helper is bound to one interface, has no packet capture, and its conflict check is mandatory; no `CAP_NET_ADMIN` on the Core; alias expiry by the kernel (H-S, unproven); refusal when another interface holds the factory subnet; the same-address conflict is enforced, not only shown; no automatic follow by MAC; commissioning only while no session is open; the wizard's registration step is not carried.
6. U8: the design lists 20 data items with their input-av source (section 4, last table) and designs no table. `masterplan/03_db_schema_extension.md` did not exist when this was written; the pointers to it are forward references. Three listed items were dropped for a reason other than "no place" and need more than a table: discovered-device rows (RG-4), search constants (D91), capacity limits (Q6).

## Facts worth carrying forward

- Real hardware: only the outcome of the Tiandy move on 2026-10-12 is recorded (`apps/input-av/docs/SERAH-TERIMA.md:80,157-158`). By which path it was done is not recorded (hypothesis H-W). The user can settle it in one sentence.
- The Tiandy factory addresses (192.168.1.10, .11, .12) are not in input-av's default list, and each camera had a different one. The default list alone would not have found them.
- Code fact with a bench symptom: no alias is added when any interface of the host is already in the factory subnet (`apps/input-av/nvr/netalias.py:73-81`); open bench finding 17 fits it (hypothesis H-U).
- The `onvif` 0.8.3 package already in the repository contains the four network calls (presence read in `node_modules/onvif/lib`, nothing run).

## Not done, by limit

- `masterplan/02_plan.md` and the decision register were not edited; they still show WP-19 as blocked by Q10 and as "dropped from the product" (plan lines 109, 125, 156, 355, 366, 414, 466 at the time of reading).
- `research/03_analysis_record_map.md` was not edited; its DROPPED lines affected by U8 are named in the design's data table instead.
