---
task_slug: input_av_core_adapter_plan
row: 65
milestone: M4 / WP-08
date: 2026-10-13
agent: coder-execution (batch 6, agent H)
status: complete
tier: T3
---

# Row 65 - generator of the shared-capture configuration (`dsnoop` plus `plug`) per card

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `AUD` = `CS/src/capture/adapters/audio`, `IAV` = `apps/input-av/nvr` (read only; nothing under `apps/input-av/data/` and no `.env` was opened).

## 1. What was built

| File | State | What it is |
|---|---|---|
| `AUD/alsa-config.ts` | NEW | The generator: `alsaConfigText(cards)`, `sharedPcmName(cardIndex, deviceIndex)`, `sharedCaptureKey(cardIndex, deviceIndex)`, `sharedCaptureOfCard(card, wantedRateHz)`, `alsaConfigPath(runDir)`, `ensureAlsaConfig(writer, runDir, cards)`, the key name `ALSA_CONFIG_ENVIRONMENT_KEY`. Imports `./card-listing` only: no module of the host |
| `AUD/alsa-config-writer.ts` | NEW | The ONE file-system importer of the sound configuration (SR-1, entry 2): `createAlsaConfigWriter(runDir)`. One file, `<runDir>/alsa/dems-alsa.conf`, directory 0700, file 0600, exclusive create of a temporary name, sync, rename |
| `AUD/__tests__/alsa-config.test.ts` | NEW | 52 cases (25 named ones, two of them tables of 18 and 11 refusals) |
| `AUD/__tests__/alsa-config-writer.test.ts` | NEW | 11 cases, on a directory below the system's temporary directory |
| `CS/src/capture/__tests__/static.test.ts` | MOD | section 4 |

Nothing calls the two files yet (row 67 does, at the open). Not touched: `config.ts`, `production-door.ts`, `card-listing.ts`, `card-listing-reader.ts`, `usb-audio.ts`, the barrels.

## 2. The text, and where it comes from

Source: `IAV/audio.py:442-445` (`shared_pcm`), `:463-488` (`ensure_alsa_config`), `:396` (formats), `:430-439` (rate), quoted in `research/01_explore_input_av.md` section TS-7. The template is the source's, line for line:

```
</usr/share/alsa/alsa.conf>
pcm.dems_1_0_shared {
  type dsnoop
  ipc_key 52032
  ipc_perm 0660
  slave { pcm "hw:CARD=1,DEV=0" channels 2 rate 48000 format S24_3LE period_size 1024 buffer_size 8192 }
}
pcm.dems_1_0 { type plug slave.pcm "dems_1_0_shared" }
```

| Rule of the tested scheme | Here |
|---|---|
| One `dsnoop` per card that opens the hardware once, one `plug` above it | same two devices per card and device |
| ALL native channels opened by the shared capture (`audio.py:475`) | `channels <channelCount>`; the generator has no parameter for a selected input |
| One rate per card (`audio.py:448-460, 476`) | one entry per card and device; a card named twice is refused (`DUPLICATE`); the rate is `cardSampleRate` of row 64 |
| The card's native format (`audio.py:396, 477`) | `format` is taken from the closed list `CARD_FORMAT_PREFERENCE`, never from the value handed in |
| `period_size 1024 buffer_size 8192`, `ipc_perm 0660`, the include line | literals, unchanged |
| Written to a temporary name, then replaced (`audio.py:484-486`); `ALSA_CONFIG_PATH` (`:487`) | the writer; the path is handed to the helper as the one key of the production door, never set on the Core's own environment |

### Deviations from the source (each for AD-07 or by rule)

| # | Source | Here | Why |
|---|---|---|---|
| V-1 | name `dems_<card id>_<dev>` | `dems_<card index>_<device index>` | AD-07 (2): the card id is derived by the kernel from the device's own text |
| V-2 | `hw:CARD=<card id>,DEV=<dev>` | `hw:CARD=<card index>,DEV=<device index>` | same; the form of the tested line is kept, with the number where the name stood |
| V-3 | key `52000 + crc32("<id>:<dev>") % 9000` | `52000 + cardIndex * 32 + deviceIndex` (52,000 to 53,023) | no text; and two cards can never share a key (the hash could collide) |
| V-4 | written only when the text differs | replaced at every call | the unit then reads no file; a rename is whole either way |
| V-5 | every listed card | the cards the caller hands in | row 67 decides (the cards of the registered inputs, from the live listing) |

A card index is the number of ONE listing: the text is generated again from the live listing at every open and is never stored.

## 3. AD-07 in this row

The input type `SharedCaptureCard` is four integers and one member of a closed set. Each integer is checked (`Number.isInteger`, range) and written with `String()`; the format is looked up in the closed list. An object that carries other members is read for the five only. The file name is a literal below the run directory; `alsaConfigPath` refuses a relative path, `..`, `.`, an empty segment and any character outside `[A-Za-z0-9._ +:/-]`. The writer is bound to one run directory and refuses any other path.

Tests that fail if device text could reach the output: a card with hostile `cardId`, `product`, `usbId`, `usbPort` and four extra members gives exactly the bytes of the bare integers and none of the eight planted strings; every line of any output matches one of eight fixed line shapes; a source check that neither file names `cardId`, `usbId`, `usbPort` or `product` in code (control: the listing file does, more than four times); a format that carries more text is refused.

## 4. Static rule lists (SR-1, entry 2 - and nothing else of SR-1)

`CS/src/capture/__tests__/static.test.ts`: one constant `ALSA_CONFIG_WRITER`; its entry in the G-R2 allowlist; its entry in the exact list of file-system importers (5 -> 6); one new case "for writing under the run directory only": one import `{ lstat, mkdir, open, rename, rm }`, exactly one `open(temporary, 'wx', OWNER_ONLY_FILE)`, the exact four calls of `mkdir` / `rm` / `rename`, the two mode constants, the three names made from `alsaConfigPath(runDir)` and literals, the path refusal, no reading, linking or mode-changing call, no process and no environment read; the generator imports `./card-listing` only. The list of process importers and G-R8 are unchanged. `adapters/__tests__/static.test.ts` and `test/static/credentials.test.ts`: not edited (no list of theirs counts a file-system importer).

## 5. Evidence

| Check | Command (from `CS`) | Result |
|---|---|---|
| Row's files, first run | `npx vitest run --project unit --maxWorkers=2` on the two new test files and the three static files | `Test Files 1 failed \| 4 passed (5)`, `Tests 1 failed \| 146 passed (147)`; the two new files green |
| The one failure | `static.test.ts` SEC35-41 (c) | `src/modules/capture-audio-cards/statements.ts` of agent I (row 70), in flight; not this row's file or rule; filed in `file_requests.md` |
| Final run of both rows | 7 files (the two above, `mic-helper-args.test.ts`, `mic-static.test.ts`, the three static files) | `Test Files 2 failed \| 5 passed (7)`, `Tests 4 failed \| 204 passed (208)`; the four failures are agent I's in-flight module (section 4 of `066_linux_helper_args.md`) |
| Typecheck | `npm run -s typecheck` | exit 0 (at the end of row 66; at the end of row 65 the only errors were in files of agents D, G, I) |
| Lint | `npx oxlint src/capture/adapters/audio src/capture/__tests__/static.test.ts` | exit 0 |

Verification cell: "the generated text equals the values quoted from the input-av source" - cases "a 2-input card", "a multi-input interface", "two cards", and "equals the template of the input-av generator, line for line" (the source template quoted in the test, filled and compared for four card sets). "the file is written under the run directory only" - `alsaConfigPath` cases, the writer's six refusal cases, the static case. "the rule lists pass in their amended state" - G-R2 green with the entry.

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why the conservative one |
|---|---|---|
| DD-1 | "With its configuration key" is read as the environment key `ALSA_CONFIG_PATH` (exported as `ALSA_CONFIG_ENVIRONMENT_KEY`; a test holds it equal to the one key of `PRODUCTION_ENVIRONMENT_KEYS`, which row 21 left for this row to confirm). NO key was added to `config.ts`, although the profile line names the resource `config`: the run directory is `<dataDir>/run/capture` (no key today) and no document names a new one | Adding an invented key would move the hash pin of a hot file. If a key is wanted (for example the wanted rate), it is a decision |
| DD-2 | Generator and writer are two files; only the writer is in the lists | The pattern of row 64 (DD-1 there); SR-1 admits "the ALSA configuration writer" |
| DD-3 | V-1 to V-3: integers where the source had the card id; the key is positional, not hashed | AD-07 (2) |
| DD-4 | `ipc_perm 0660` is kept as tested | Text equality. With one service account and a run directory of 0700, 0600 would be narrower; changing it is untested. For the security review (row 73 / 86) |
| DD-5 | V-4: always replaced, never read | The writer then has no reading call (SR-1: "for writing ... only") |
| DD-6 | The writer refuses a directory that is a link, another account's, or open to group or others; it removes nothing below a directory that has not passed | The run directory's own rule (`mic-pipe.ts`) |
| DD-7 | No logging here; `AlsaConfigError` and `AlsaConfigWriteError` carry a code and no value or path | The capture folder logs in one place (G-R4); the caller (row 67) logs |
| DD-8 | The rate range 8,000 to 192,000 and the bound of 32 entries are refusals | The range of the source's API model and the listing's bound |

## 7. The double, and what stays unproven

The double: no ALSA exists on this Mac. The generator is held to text; the writer writes below the temporary directory; the injected writer of the generator's tests is a recorder. Nothing opened a sound card.

| Unproven | Proven by |
|---|---|
| That the ALSA library accepts the text, and that `hw:CARD=<index>,DEV=<index>` names the card (the tested line had the card's name) | `9A/H-08` (capture opens), `9A/H-07` (the listing's indexes) |
| That two helpers open one card through the shared capture at the same time (primary and standby on one interface), and the key range is free on the host | `9A/H-08` (both inputs) |
| The card's native format and the one rate against the real interface; `period_size 1024 buffer_size 8192` against the worker's placement by arrival (E-5); the first-second full-scale sample; audible level (the bench recordings of this scheme were practically silent) | `9A/H-08` |
| That a card index is stable between the listing and the open of one session start, and what a re-plug in another order does | `9A/H-07` .5, .6, .8 |
| The file and directory modes on the target's file system under the service account; the path handed to the helper through the production door | `9A/H-08`; row 67 on doubles |
| `ipc_perm 0660` with the service account's group (DD-4) | `9A/H-08`, security review |

## 8. Identifiers

Closed on doubles: WP-08 (generator part); S3-4 (generation and the explicit key; the pipe and the hand-over are row 67); H-15; SR-1 entry 2; AD-07 (2) for the configuration text and its file name; P12-F04 for this entry. Open: `9A/H-07`, `9A/H-08`; E-5.
