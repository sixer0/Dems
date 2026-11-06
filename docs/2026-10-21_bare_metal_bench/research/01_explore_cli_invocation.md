---
task_id: 2026-10-21_bare_metal_bench
row: 4
date: 2026-10-22
agent: explore
scope: Q6 - how a nologin service user runs operator:set-password, evidence:production-key and the attended check
tier: 2
method: direct file reads (no graft calls; paths known); read-only
---

# Q6: running the two CLI commands as a nologin service user

All paths are under `/Users/gsp-budi/Documents/DEMS/`. `apps/core-server` is abbreviated `ACS`.

## 1. The three cited headers (start lines)

| Item | Script entry (package.json) | Header starts | Process entry starts | Source |
|---|---|---|---|---|
| operator:set-password | `ACS/package.json:27` `"operator:set-password": "tsx cli/operator-set.ts"` | `ACS/cli/operator-set.ts:1` (doc block 1-30; usage lines 5-6) | `terminalPorts()` at :42; `if (invoked)` at :72 | read |
| evidence:production-key | `ACS/package.json:24` `"evidence:production-key": "tsx cli/production-key.ts"` | `ACS/cli/production-key.ts:1` (doc block 1-19; usage line 4) | `terminalPorts()` at :25; `if (invoked)` at :49 | read |
| attended check (secret prompt) | none (no npm script). Run by hand: `npx tsx cli/secret-prompt.ts` from `ACS` (`ACS/cli/secret-prompt.ts:43-45`) | `ACS/cli/secret-prompt.ts:1` (doc block 1-50; "THE ATTENDED CHECK" paragraph at :43) | `runAttendedCheck()` at :330; `if (invoked)` at :362 | read |

The command logic lives in `ACS/cli/operator-set-password-command.ts` (`runSetPasswordCommand`, :346 area) and `ACS/cli/production-key-command.ts` (`runProductionKeyCommand`). Both `.ts` files lie outside `src/` (`operator-set.ts:12`, `production-key.ts:9`).

Doc lines (installer note): `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md` section 2.1 table rows 2 and 3 (lines 57-59 of that file) give the exact `npm run ... -w @dems/core-server -- ...` forms; line 74 says "To confirm on the host ... that the two lines start as written when the person at the terminal acts as `<service-user>`. The host profile gives that account no login shell (HOST-04), and on the development Mac the script form of neither command was started by a person at a terminal." Finding F4 in `identification/02_structured.md:54` states the open need (HOME and writable npm cache).

Host profile `scripts/host/HOST-PROFILE-UBUNTU-24.04.md:56` (HOST-04): `sudo useradd --system --home-dir <data-dir> --shell /usr/sbin/nologin <service-user>`. So the service user's HOME is `<data-dir>` (when `-H` is used with sudo, or from passwd).

## 2. The attended check and the terminal rule

- `secret-prompt.ts:330-340`: `runAttendedCheck` first calls `io.isTerminal()`; false -> prints `refused (NOT_A_TERMINAL)` and returns exit 1. Real wiring: `isTerminal: () => isatty(0)` (`secret-prompt.ts:365`; also `standardInputTerminal()` :265). The test is on file descriptor 0 (stdin) only.
- Header states it (`secret-prompt.ts:7-12`): refuses unless stdin is a terminal; no argument, no environment variable lifts it; "a pipe, a file, a here-document, no terminal at all" -> `NOT_A_TERMINAL`. Prompt writes the label to stderr (`:256` comment) and sets raw mode (`process.stdin.setRawMode`, `:267`), so a real PTY is needed.
- Exit status: 0 line read, 1 anything else (`:324`, header :46-48).
- `runAttendedCheck` reads no env var and no argument (`:327-328`).
- **Refusal of root: NOT found in the attended check or the password command.** `grep` for `uid === 0`/root in `secret-prompt.ts` and `operator-set-password-command.ts` finds nothing. The only explicit root refusal is in `production-key-command.ts:91` (`ROOT_REFUSED`) and `:395` (`if (uid === 0) return refuse(R.ROOT_REFUSED, 'Run it as the OS user the Core runs as, never as root.')`). For the password command the indirect protection is the owner check on `pg.env` (section 3). Note this contradicts the task wording "refusal of root" for the attended check: it is a refusal of non-TTY only.
- The password command applies the same TTY rule itself before any read: `operator-set-password-command.ts:370` (`NOT_A_TERMINAL`), via `isatty(0)` at `operator-set.ts:47`. Also refuses (exit 1) when an env variable is named like a password: `operator-set-password-command.ts:190` regex `PASSWORD_VARIABLE_NAME`, checked at :367 (names only).
- The production key command: `production-key.ts:32` `if (process.stdin.isTTY !== true) return settle(null)` -> the prompt gets no line and the command refuses `NOT_A_TERMINAL` (header `production-key.ts:15-17`). Only stdin is tested.

## 3. Runtime needs per command

| Need | operator:set-password | evidence:production-key | attended check | Evidence |
|---|---|---|---|---|
| TTY on stdin | required, refused before any read | required (readline prompts for org, device id, word `PROVISION`) | required (raw mode) | `operator-set-password-command.ts:370`; `production-key.ts:32`; `secret-prompt.ts:337` |
| Under sudo: PTY | needs `ssh -t` (allocated PTY) so `sudo` keeps stdin a tty | same | same | derived from isatty(0); installer note line 59 text says "over ssh -t" in F4 (`02_structured.md:54`) |
| Caller uid | any non-negative uid; owner of `pg.env` must equal caller uid | not 0; must own `<data-dir>`, `signer`, `handover`; ancestors owned by root or caller and not group/other writable | none | `operator-set-password-command.ts:181`; `production-key-command.ts:260-294, 395-396` |
| Env keys read | `Object.keys(process.env)` names only, to refuse password-like names (`operator-set.ts:48`). No env value is used for connection: it reads `<data-dir>/pg.env` | **none**: "The command reads NO environment variable" (`production-key.ts:12`) | none (`secret-prompt.ts:327`) | as cited |
| Args | `--database <name> --data-dir <abs> (--username <u> | --all-demo)`; `--password` is a usage error (exit 2) | `--data-dir <abs>` only; must be absolute and already normalised (`production-key-command.ts:385-388`) | none | `operator-set.ts:5-6`; `production-key-command.ts:383-388` |
| Files read | `<data-dir>/pg.env` (regular file, owned by caller, no group/other access; role `dems_app`, host `127.0.0.1`) | writes `<data-dir>/signer` and the hand-over directory; writes a provisioning record | none | `operator-set-password-command.ts:175-181, 372-380`; `production-key-command.ts:403-404, 518`; `src/config.ts:126` for host |
| Database | connects to 127.0.0.1 as runtime role (Postgres must be up, Core stopped per installer note 2.3) | none | none | `operator-set.ts:63`, `src/plugins/db/index.ts:136-148` |
| cwd | npm resolves the workspace from the repo root (`-w @dems/core-server`); the script runs with cwd = `ACS`. No relative path is read by the commands (data dir must be absolute). A cwd the service user cannot read breaks `npm`/`tsx` startup | same | `npx tsx cli/secret-prompt.ts` is relative to `ACS` | `ACS/package.json:24,27`; installer note 2.1 line 57-59 says "from the repository root" |
| HOME | not read by the CLI code (no `homedir`/`os` use in `ACS/cli/*.ts`: grep empty). Needed by the toolchain: npm writes its cache and logs under `$HOME/.npm`; tsx caches in the temp dir (hypothesis, see section 5) | same | same | grep of `ACS/cli` for `HOME|homedir|tmpdir|TMPDIR` returned no match; npm/tsx behaviour is not in repo: hypothesis |
| Writable dir for the error log | writes `ACS/logs/errors.log` (`createErrorLog(DEFAULT_ERROR_LOG_FILE)`, `operator-set.ts:64`; path `src/plugins/logger/error-log.ts:34-41`), mkdir recursive and mode 0600 (`:192-199`). Under HOST-05 (`HOST-PROFILE...md:57`) the tree is root-owned and not writable by the service user, so the write fails; failures are swallowed (`error-log.ts:205-217`) so the command still runs but log entries are lost | none | none | as cited |
| Install dir readability | all node_modules and `ACS/src` must be readable by the service user (HOST-05 mode 0755) | same | same | `HOST-PROFILE...md:57` |

## 4. Derived suggestion (NOT verified; no run was made, no host touched)

Hypothesis, labelled derived: the installer opens a PTY and types

```
ssh -t gsp-dems@<host>
sudo -u <service-user> -H -- env npm_config_cache=<writable-dir-outside-data-dir> TMPDIR=<same-or-sibling> \
  npm run evidence:production-key -w @dems/core-server -- --data-dir <data-dir>
```
run with `cd <install-dir>` first (a root-owned, world-readable path), and the same shape for `operator:set-password`. Notes:
- `-H` sets HOME to the passwd home, which is `<data-dir>` per HOST-04 (`HOST-PROFILE...md:56`). `<data-dir>` is mode 0700 owned by the service user (HOST-06), so npm would create `<data-dir>/.npm` inside the evidence data directory. `production-key-command.ts:260-294` inspects `<data-dir>`, `signer`, `handover` only, so an extra directory is not refused by the code read, but keeping caches out of the evidence directory is cleaner. Hence the `npm_config_cache` override (hypothesis; a `-n` sudo pattern is not needed).
- `sudo -u` keeps the controlling terminal, so `isatty(0)` stays true if the outer shell has a PTY. `sudo -u ... < file` or a script without `-t` would be refused with `NOT_A_TERMINAL`.
- `sudo -u` rather than `su`: `su` needs a login shell; nologin refuses (`su -s /bin/bash` is the alternative; not needed).
- `env` here carries no password-like names; do not add any (refused, `operator-set-password-command.ts:190,367`).

## 5. Unknowns (for the controller, possible follow-up in a host row)

1. Where the installed tsx writes its cache (hypothesis: `os.tmpdir()/tsx-<uid>`; not in repo). Check on the host by running the attended check as the service user and listing `/tmp`.
2. Whether npm 11 (pinned `.node-version` 26.8.2) fails or only warns without a writable `$HOME/.npm`. Host test needed (INSTALLER-NOTE line 74 says it was never run).
3. Whether the `ACS/logs` write failure is acceptable (swallowed, so yes by code; the lost log lines are the effect). A dedicated writable log path is not offered by the CLI (no argument/env).
4. `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md` section 2.1 is in lines 53-74; 2.4 (attended check wording) was not read in full; only the command header was.
5. The root refusal asked about in the brief exists only in the key command, not in the password command or the attended check.
