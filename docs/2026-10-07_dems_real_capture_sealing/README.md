# DEMS — real capture, sealing v2 and transcript (task 3)

Started 2026-10-07. Predecessor: `docs/2026-10-04_dems_backend_rbac_pairing/` (closed; commits 0a9e317, c2c983b, 85c0fb5).

Inputs: decisions D219-D230 and D260 of the predecessor's `decisions/decisions.md`; impact map `research/10_next_phase_impact_map.md` and drift check `research/11_next_phase_drift_check.md` of the predecessor; backlog B2-B17 / A1-A6 of its `report/01_report_inputs.md`.

## Index of this folder

Rewritten on 2026-10-11 (row 97) from the directory listing: every file and folder that is here today
(hidden entries left out: an empty, git-ignored session scratch folder `.claude/`).
Progress is in `status_tasks.md`; the accountability trail in `delegation_progress_report.md`; rulings in `decisions/decisions.md`.

Top level: `README.md` (this file), `status_tasks.md`, `delegation_progress_report.md`.

| Folder | Entries | Content |
|---|---|---|
| `identification/` | 4 | the request as given and as translated, and the blueprint (`02_structured.md`: the task table) |
| `research/` | 12 | exploration, collection, analysis and the spikes |
| `masterplan/` | 11 | specifications, the plan, the contracts (API, database), the test strategy, the audit errata |
| `initialization/` | 11 | environment checks, installs, and the gate environment of each wave |
| `implementation/` | 165 | one note per row or fix pass, numbered in the order written |
| `gateway_check/` | 41 | milestone gates, re-checks, code and security reviews, and their evidence folders |
| `test/` | 20 | checkpoint and pre-commit suite runs, the suite audit and consolidation, the row 95 full regression |
| `verification/` | 3 | the independent audits (code and tests, spikes and STT, docs and decisions) |
| `decisions/` | 1 | the decision log |
| `report/` | 1 | the handoff report |
| `delegation_progress/` | 249 | one status file per agent run, the driver rules, the fix briefs and the wave contracts |

### identification/ (4 files)

- `01_original.md`
- `01_translated.md`
- `01_translated_resume_2026_10_09.md`
- `02_structured.md`

### research/ (12 files)

- `01_explore.md`
- `02_collection.md`
- `03_analysis.md`
- `04_collection_stt.md`
- `05_b2_dependency_triage.md`
- `06_spike_s1_fmp4_running_hash.md`
- `07_spike_s2_mic_switch_timeline.md`
- `08_spike_s4_av_sync_fixture.md`
- `09_spike_stt_model_conversion.md`
- `10_spike_stt_functional_check.md`
- `12_spike_s3_media_engine_pick.md`
- `13_stt_cpu_functional_check.md`

### masterplan/ (11 files)

- `01_specs.md`
- `02_plan.md`
- `03_api_contract.md`
- `04_database_contract.md`
- `05_capture_architecture_spec.md`
- `06_evidence_package_spec.md`
- `07_transcript_spec.md`
- `08_client_ux_spec.md`
- `09_security_design_review.md`
- `10_test_strategy.md`
- `11_audit_errata.md`

### initialization/ (11 files)

- `01_env_check.md`
- `02_stt_runtime_install.md`
- `03_gstreamer_install.md`
- `04_gate_environment_wave_f.md`
- `04_whisper_cpp_cpu_build.md`
- `05_gate_environment_up.md`
- `06_gate_environment_regate.md`
- `07_gate_environment_wave_i.md`
- `08_gate_environment_wave_k.md`
- `09_gate_environment_wave_l.md`
- `10_gate_environment_wave_m.md`

### implementation/ (164 files, 1 folders)

Folders: `evidence/` (63 files).

- `01_b10a_live_gap_read_only_dialog.md`
- `02_b10b_live_settings_boundary.md`
- `03_b10c_live_session_live_link.md`
- `04_b10e_rc8_redundant_timeouts.md`
- `05_b10d_live_paired_devices_issue.md`
- `06_b10f_chrome_lost_updates.md`
- `07_rc1_recording_elapsed_monotonic.md`
- `08_b2_dependency_refresh.md`
- `09_m2_lane_recreation.md`
- `09_rv_code_audit_fixes.md`
- `100_integration_pass_d6.md`
- `101_integration_pass_d7.md`
- `102_integration_pass_d8.md`
- `103_integration_pass_d9.md`
- `104_integration_pass_d10.md`
- `105_integration_pass_d11.md`
- `106_integration_pass_e1.md`
- `107_migration_0013.md`
- `108_integration_pass_e2.md`
- `109_integration_pass_e3.md`
- `10_m2_schema_check.md`
- `110_integration_pass_e4.md`
- `111_fix_m6_review.md`
- `112_fix_m5_review.md`
- `113_fix_m7_review.md`
- `113b_fix_m7_review_rest.md`
- `113c_fix_m7_review_last.md`
- `114_fix_m8_review.md`
- `115_fix_m4_review.md`
- `116_fix_m3_review.md`
- `117_closing_pass_fx.md`
- `118_tidy_pass_fy.md`
- `119_pass_fz.md`
- `11_m2_migrations.md`
- `120_fix_wave_h_a.md`
- `121_fix_wave_h_b.md`
- `122_fix_wave_h_c1.md`
- `123_fix_wave_h_c2.md`
- `124_fix_wave_h_d.md`
- `125_fix_wave_h_e.md`
- `126_fix_wave_h_f.md`
- `127_fix_wave_h_r.md`
- `128_fix_wave_h_z1.md`
- `129_fix_wave_h_z2.md`
- `12_m2_seed_fixture.md`
- `130_pass_hy.md`
- `131_fix_wave_i_a1.md`
- `132_fix_wave_i_a2.md`
- `133_fix_wave_i_b.md`
- `134_fix_wave_i_c.md`
- `135_fix_wave_i_pass_j.md`
- `136_docs_errata_wave_h_i.md`
- `137_docs_errata_followup.md`
- `138_pin_moves_wave_i.md`
- `139_fix_wave_k_s1.md`
- `13_m2_reset_guard.md`
- `140_fix_wave_k_s2.md`
- `141_fix_wave_k_w.md`
- `142_fix_wave_k_m1.md`
- `143_fix_wave_k_m2.md`
- `144_fix_wave_k_kr.md`
- `145_fix_wave_k_z1.md`
- `146_fix_wave_k_z2.md`
- `147_docs_errata_wave_k.md`
- `148_docs_errata_wave_k_touchup.md`
- `149_fix_wave_k_final_small.md`
- `14_m2_shared_contract.md`
- `150_flaky_export_test.md`
- `151_fix_manifest_profile_declared.md`
- `152_docs_erratum_fix_151.md`
- `153_fix_wave_l_s.md`
- `154_fix_wave_l_w.md`
- `155_fix_wave_l_m.md`
- `156_fix_wave_l_z.md`
- `157_fix_audio_pair_in_force.md`
- `158_fix_wave_m_s.md`
- `159_fix_wave_m_w.md`
- `15_m2_api_contract.md`
- `160_fix_wave_m_m.md`
- `161_fix_wave_m_s2.md`
- `162_row97_hygiene.md`
- `163_row97_blueprint_list.md`
- `16_m2_openapi_pins.md`
- `17_m2_simulated_parity.md`
- `18_m2_config_demo.md`
- `19_m3_supervisor_ipc.md`
- `20_m3_worker_engine.md`
- `21_m3_fmp4_writer.md`
- `22_m3_fixtures.md`
- `23_m3_static_boot.md`
- `24_m3_b11_instrumentation.md`
- `25_m4_adapters.md`
- `26_m4_selector.md`
- `27_m4_web_selector.md`
- `28_m4_mobile_selector.md`
- `30_m5_mic_switch.md`
- `30b_m5_session_wiring.md`
- `30c_m5_real_session_stt_wiring.md`
- `31_m5_web_mic.md`
- `32_m5_mobile_mic.md`
- `33_m6_transcriber_adapter.md`
- `34_m6_vad_stt.md`
- `35_m6_diarization.md`
- `36_m6_transcript_seal.md`
- `37_m7_sealing_pipeline.md`
- `37b_m7_seal_composition.md`
- `37c_m7_seal_fixes_demo_seed.md`
- `38_m7_package_signer.md`
- `39_m7_encryption.md`
- `40_m7_verify_v2.md`
- `41_m7_kill_matrix.md`
- `42_m7_clients_verify.md`
- `43_m8_media_stream.md`
- `44_m8_export_composite.md`
- `45_m8_playback_ui.md`
- `47_m9_docs.md`
- `50_m2_lane_v2_completion.md`
- `51_m2_stt_config_schema.md`
- `52_m6_stt_config_api.md`
- `53_m2_stt_config_seed_kept.md`
- `54_m6_stt_config_runtime.md`
- `55_m6_stt_disabled_seal.md`
- `56_m6_stt_config_web.md`
- `57_m6_stt_status_mobile.md`
- `58_m7_stt_disabled_verify.md`
- `59_m3_worker_proofs.md`
- `60_m2_meter_forwardfix.md`
- `60_r9_migration_0008.md`
- `60a_r9_migration_credential_replace.md`
- `60b_m6_snapshot_column_and_mapping.md`
- `61_m2_sim_capture_routes.md`
- `61_r9_lane_migration.md`
- `62_r9_onvif_discovery.md`
- `62_recon_clients.md`
- `63_r9_search_api.md`
- `63_recon_shared.md`
- `64_r10_no_device_alerts.md`
- `64_recon_core_server.md`
- `65_r11_local_camera_helper.md`
- `65_recon_core_wiring.md`
- `66_r11_local_mic_helper.md`
- `66_recon_core_tests.md`
- `67_r11_local_device_kind.md`
- `67_recon_cs20_pins.md`
- `68_r9_web_devices.md`
- `68_recon_snapshot_code.md`
- `69_r9_mobile_devices.md`
- `69a_recon_media_code.md`
- `69b_recon_snapshot_code.md`
- `69c_recon_snapshot_live.md`
- `70_r10_session_start_situation_c.md`
- `70_recon_mobile_snapshot_pin.md`
- `71_r11_local_sources_in_sessions.md`
- `72_r11_manifest_dev_mark.md`
- `73_r9_connect_flow.md`
- `90_integration_pass_a.md`
- `91_integration_pass_b.md`
- `92_integration_pass_c1.md`
- `93_integration_pass_c2.md`
- `94_integration_pass_d1a.md`
- `95_integration_pass_d1b.md`
- `96_integration_pass_d2.md`
- `97_integration_pass_d3.md`
- `98_integration_pass_d4.md`
- `99_integration_pass_d5.md`

### gateway_check/ (40 files, 1 folders)

Folders: `evidence_08/` (2 files).

- `01_b2_dependency_review.md`
- `02_b10_test_hygiene_review.md`
- `03_rc1_review.md`
- `04_m1_spike_gate.md`
- `05_m0_spec_gate.md`
- `06_security_remediation.md`
- `07_m2_gate.md`
- `08_m2_gate_device.md`
- `08_m3_gate.md`
- `09_m4_gate.md`
- `09b_m4_regate.md`
- `09c_m4_recheck.md`
- `09d_m4_final.md`
- `10_m5_gate.md`
- `10b_m5_regate.md`
- `10c_m5_regate.md`
- `10d_m5_m6_recheck.md`
- `10e_m5_final.md`
- `11_m6_gate.md`
- `11b_m6_regate.md`
- `12_m7_gate.md`
- `12b_m7_regate.md`
- `12c_m7_recheck.md`
- `12d_m7_final.md`
- `13_m8_gate.md`
- `13b_m8_regate.md`
- `13c_m8_recheck.md`
- `13d_m8_final.md`
- `14_wave_m_confirmation.md`
- `15_m2_code_review.md`
- `16_m3_code_review.md`
- `17_m4_code_review.md`
- `18_m5_code_review.md`
- `19_m6_code_review.md`
- `20_m7_code_review.md`
- `21_m8_code_review.md`
- `25_rv_spec_reconciliation.md`
- `26_m1_cpu_stt_addendum.md`
- `27_m2_claude_audit.md`
- `27_r9_r11_spec_gate.md`

### test/ (20 files)

- `01_wave_a_regression.md`
- `02_checkpoint_wave_c_suites.md`
- `03_worker_e2e_wave_e.md`
- `04_kill_matrix_seal_e2e_wave_e.md`
- `05_checkpoint_wave_de_suites.md`
- `06_checkpoint_wave_f.md`
- `07_checkpoint_wave_h.md`
- `08_precommit_wave_h.md`
- `09_precommit_wave_i.md`
- `10_precommit_wave_k.md`
- `11_precommit_wave_l.md`
- `12_precommit_wave_m.md`
- `13_suite_consolidation_audit.md`
- `14_consolidation_core_server_db.md`
- `14_consolidation_core_server_unit.md`
- `14_consolidation_core_web.md`
- `14_consolidation_mobile.md`
- `14_consolidation_shared_and_small.md`
- `15_consolidation_closing.md`
- `16_row95_full_regression.md`

### verification/ (3 files)

- `20_audit_code_tests.md`
- `21_audit_spikes_stt.md`
- `22_audit_docs_decisions.md`

### decisions/ (1 files)

- `decisions.md`

### report/ (1 files)

- `report.md`

### delegation_progress/ (249 files)

- `au1_code_tests.md`
- `au2_spikes_stt.md`
- `au3_docs_decisions.md`
- `coder-execution-local__reconA.md`
- `coder-execution-local__reconB.md`
- `coder-execution-local__reconC.md`
- `coder-execution-local__reconF1.md`
- `coder-execution-local__reconF2a.md`
- `coder-execution-local__reconF2b.md`
- `coder-execution-local__reconG.md`
- `coder-execution-local__row107.md`
- `coder-execution-local__row108.md`
- `coder-execution-local__row109.md`
- `coder-execution-local__row114.md`
- `coder-execution-local__row44.md`
- `coder-execution-local__row47.md`
- `coder-execution-local__row47a.md`
- `coder-execution-local__row48.md`
- `coder-execution-local__row49.md`
- `coder-execution-local__row50.md`
- `coder-execution-local__row51.md`
- `coder-execution-local__row51a.md`
- `coder-execution-local__row52.md`
- `coder-execution-local__row54.md`
- `coder-execution__reconB2a.md`
- `coder-execution__reconD.md`
- `coder-execution__reconE.md`
- `coder-execution__row10.md`
- `coder-execution__row12.md`
- `coder-execution__row13.md`
- `coder-execution__row16.md`
- `coder-execution__row17.md`
- `coder-execution__row18.md`
- `coder-execution__row19.md`
- `coder-execution__row20.md`
- `coder-execution__row21.md`
- `coder-execution__row22.md`
- `coder-execution__row22_followup.md`
- `coder-execution__row23.md`
- `coder-execution__row53.md`
- `coder-execution__row7.md`
- `coder-execution__row8.md`
- `coder-execution__row9.md`
- `coder_execution_closing_fx.md`
- `coder_execution_env_prep_f.md`
- `coder_execution_env_regate.md`
- `coder_execution_env_up.md`
- `coder_execution_fix_151.md`
- `coder_execution_fix_m3.md`
- `coder_execution_fix_m4.md`
- `coder_execution_fix_m5.md`
- `coder_execution_fix_m6.md`
- `coder_execution_fix_m7.md`
- `coder_execution_fix_m7b.md`
- `coder_execution_fix_m7c.md`
- `coder_execution_fix_m8.md`
- `coder_execution_fix_wave_l_m.md`
- `coder_execution_fix_wave_l_z.md`
- `coder_execution_fix_wave_m_m.md`
- `coder_execution_integration_a.md`
- `coder_execution_integration_b.md`
- `coder_execution_integration_c1.md`
- `coder_execution_integration_c2.md`
- `coder_execution_integration_d10.md`
- `coder_execution_integration_d11.md`
- `coder_execution_integration_d1a.md`
- `coder_execution_integration_d1b.md`
- `coder_execution_integration_d2.md`
- `coder_execution_integration_d3.md`
- `coder_execution_integration_d4.md`
- `coder_execution_integration_d5.md`
- `coder_execution_integration_d6.md`
- `coder_execution_integration_d7.md`
- `coder_execution_integration_d8.md`
- `coder_execution_integration_d9.md`
- `coder_execution_integration_e1.md`
- `coder_execution_integration_e2.md`
- `coder_execution_integration_e3.md`
- `coder_execution_integration_e4.md`
- `coder_execution_pass_fz.md`
- `coder_execution_pass_hy.md`
- `coder_execution_row111.md`
- `coder_execution_row113.md`
- `coder_execution_row115.md`
- `coder_execution_row116.md`
- `coder_execution_row117.md`
- `coder_execution_row118.md`
- `coder_execution_row119.md`
- `coder_execution_row130.md`
- `coder_execution_row131.md`
- `coder_execution_row132.md`
- `coder_execution_row133.md`
- `coder_execution_row134.md`
- `coder_execution_row135.md`
- `coder_execution_row136.md`
- `coder_execution_row137.md`
- `coder_execution_row138.md`
- `coder_execution_row139.md`
- `coder_execution_row140.md`
- `coder_execution_row141.md`
- `coder_execution_row142.md`
- `coder_execution_row57.md`
- `coder_execution_row58.md`
- `coder_execution_row58_p5_actions.md`
- `coder_execution_row59.md`
- `coder_execution_row60.md`
- `coder_execution_row61.md`
- `coder_execution_row62.md`
- `coder_execution_row65.md`
- `coder_execution_row66.md`
- `coder_execution_row67.md`
- `coder_execution_row68.md`
- `coder_execution_row71a.md`
- `coder_execution_row71b.md`
- `coder_execution_row71c.md`
- `coder_execution_row72.md`
- `coder_execution_row73.md`
- `coder_execution_row76.md`
- `coder_execution_row77.md`
- `coder_execution_row78.md`
- `coder_execution_row79.md`
- `coder_execution_row82.md`
- `coder_execution_row82b.md`
- `coder_execution_row82c.md`
- `coder_execution_row83.md`
- `coder_execution_row84.md`
- `coder_execution_row85.md`
- `coder_execution_row86.md`
- `coder_execution_row87.md`
- `coder_execution_row90.md`
- `coder_execution_row91.md`
- `coder_execution_row92.md`
- `coder_execution_row97.md`
- `coder_execution_tidy_fy.md`
- `coder_execution_wave_h_a.md`
- `coder_execution_wave_h_b.md`
- `coder_execution_wave_h_c1.md`
- `coder_execution_wave_h_c2.md`
- `coder_execution_wave_h_d.md`
- `coder_execution_wave_h_e.md`
- `coder_execution_wave_h_f.md`
- `coder_execution_wave_h_r.md`
- `coder_execution_wave_h_z1.md`
- `coder_execution_wave_h_z2.md`
- `coder_execution_wave_i_a1.md`
- `coder_execution_wave_i_a2.md`
- `coder_execution_wave_i_b.md`
- `coder_execution_wave_i_c.md`
- `coder_execution_wave_k_m2.md`
- `coder_execution_wave_k_s1.md`
- `coder_execution_wave_l_s.md`
- `coder_execution_wave_l_w.md`
- `consolidation_brief.md`
- `contract_71a_protocol_landed.md`
- `contract_93_97_landed.md`
- `contract_wave_i.md`
- `contract_wave_i_a2.md`
- `contract_wave_k.md`
- `contract_wave_l.md`
- `contract_wave_m.md`
- `data-analyst-local__c3sec6_erratum.md`
- `data-analyst-local__row43.md`
- `data-analyst__gate_gap_fix.md`
- `data-analyst__row15.md`
- `data-analyst__row28.md`
- `data-analyst__row29.md`
- `data-analyst__row31.md`
- `data-analyst__row32.md`
- `data-analyst__row33.md`
- `data-analyst__row34.md`
- `data-analyst__row35_remediation.md`
- `data-analyst__row37.md`
- `data-analyst__row6.md`
- `data-analyst__row6_errata.md`
- `data-collector-local__row3.md`
- `data-collector-local__row4.md`
- `data_analyst_pair_errata_2026_10_09.md`
- `data_analyst_pickups_g2_g6.md`
- `data_analyst_r8_status_sweep.md`
- `data_analyst_row120.md`
- `data_analyst_row121.md`
- `data_analyst_row123.md`
- `data_analyst_row124.md`
- `data_analyst_row125.md`
- `data_analyst_row96.md`
- `data_analyst_spec_gate_fix_pass.md`
- `database-specialist-local__row112.md`
- `database-specialist-local__row45.md`
- `database-specialist-local__row46.md`
- `database-specialist__row30.md`
- `database_specialist_migration_0013.md`
- `database_specialist_row122.md`
- `database_specialist_row129.md`
- `database_specialist_row129a.md`
- `database_specialist_row129b.md`
- `driver_rules_d94.md`
- `explore__row1.md`
- `explore__row2.md`
- `file_claims.md`
- `file_ownership_d95.md`
- `file_requests.md`
- `fix_brief_wave_h.md`
- `fix_brief_wave_k.md`
- `fix_brief_wave_l.md`
- `fix_brief_wave_m.md`
- `gate_brief_wave_g.md`
- `git_specialist_consolidation_checkpoint.md`
- `git_specialist_wave_c_checkpoint.md`
- `git_specialist_wave_de_checkpoint.md`
- `git_specialist_wave_f_checkpoint.md`
- `git_specialist_wave_h_checkpoint.md`
- `git_specialist_wave_i_checkpoint.md`
- `git_specialist_wave_k_checkpoint.md`
- `git_specialist_wave_l_checkpoint.md`
- `git_specialist_wave_m_checkpoint.md`
- `pair_111_navigator.md`
- `pair_113_navigator.md`
- `pair_57_navigator.md`
- `pair_58_navigator_a.md`
- `pair_58_navigator_b.md`
- `pair_76_navigator.md`
- `pair_77_navigator.md`
- `request-translator__resume_phaseC.md`
- `review_brief_wave_f.md`
- `rv_bp_blueprint.md`
- `rv_code_fixes.md`
- `rv_spec_errata.md`
- `security-review-local__row5.md`
- `security-review__row24.md`
- `security-review__row35.md`
- `security_review_row126.md`
- `senior-code-reviewer__row25.md`
- `senior-code-reviewer__row26.md`
- `senior-code-reviewer__row55.md`
- `task-architect__row40.md`
- `task_architect_rev_2_2.md`
- `task_architect_rev_2_3.md`
- `task_architect_rev_2_4.md`
- `test-expert-local__row41.md`
- `test-expert__row27.md`
- `test-expert__row36.md`
- `test_expert_pair_catalogue_t1_t10.md`
- `test_expert_pickups_g1_g3_g4_g5.md`
- `test_expert_row127.md`
- `verifier-local__row106.md`
- `verifier-local__row110.md`
- `verifier-local__row56a.md`
- `verifier__row38.md`
- `verifier__row39.md`

**Status 2026-10-07:** blueprint approved with all defaults (D4); execution handed to Kilo — start with `report/report.md` (handoff).

**Status 2026-10-11:** see `status_tasks.md`. This index was written at commit `951c80e` plus the uncommitted work of row 97 (`implementation/162_row97_hygiene.md`, second pass `implementation/163_row97_blueprint_list.md`).
