# Linux Docker installer including LCD — 2026-10-19

User explicitly selected Linux Docker + LCD on the active task4 branch. Deliver an offline-installable Linux bundle, not only separate LCD source or documentation. Preserve the existing WIP label and the production-container limitations.

Acceptance:
1. The shipped Core image contains the current Core/LCD integration, Python runtime and serial dependency. Separate LCD service uses the same image, non-root, loopback only, read-only media and explicit USB device/group. No manual pip or separate LCD package installation.
2. Bundle contains the Core image, pinned PostgreSQL image, Compose, startup template, installer, checksums and build provenance. Architecture is checked before installation. Untracked authorized LCD sources must not be silently omitted.
3. Installer defaults to LCD, accepts an explicit serial path, derives its group id and sets Core's LCD URL. Missing USB requires an explicit --without-lcd. No replacement of an existing deployment, secrets, data volumes, or deletion of volumes. Install/start/stop/status are distinct operations.
4. Verify shell/Compose and failure paths, image contents, isolated SIMULATED Docker smoke (Core+DB+console+LCD without USB; no hardware claim), archive checksums and required files. Do not run the installer against the user's host.
5. Final package in release/, docs here. No commit/push, camera access, production recording, provider/config changes or scheduling.

Build host: Colima initially stopped, existing default profile 4 CPUs/8 GiB. Started without changing settings for image build; restore stopped state after completion. Docker context initially colima, preserve it. Inspect other automatically restarted containers before teardown; do not delete them.

Status: COMPLETE for software packaging. Two verified offline archives delivered in release/installers; hardware/production acceptance remains NOT RUN. See verification.md.
