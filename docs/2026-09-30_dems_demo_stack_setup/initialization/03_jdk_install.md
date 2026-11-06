---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 8
agent: coder-execution
date: 2026-09-30
tier: 3
status: complete
pins: research/03_analysis.md SD-45, Host Impact Register HI-1..HI-3; masterplan/01_specs.md §6.4, AC-01, AC-02; decisions D11, D14, D21
---

# Row 8: JDK 17 install (Homebrew formula `openjdk@17`)

## Result

**PASS.** Homebrew installed `openjdk@17` 17.0.20.1 from a bottle in 38 s, exit 0, with no sudo and no password prompt. `~/.zprofile` was backed up and then marked block A was appended. `~/.zshrc` was not created. In a fresh login shell `java` resolves to the keg, `java -version` prints `17.0.20.1`, `os.arch = aarch64`, and `JAVA_HOME` exists.

## Sandbox handling (D14)

The first read-only `brew info` inside the sandbox failed because it could not write the Homebrew API cache under `~/Library/Caches/Homebrew`:

```
Error: curl: (56) Failure writing output to destination, passed 2916 returned 4294967295
... --output /Users/gsp-budi/Library/Caches/Homebrew/api/internal/packages.arm64_golden_gate.jws.json
```

These commands then ran with the sandbox disabled, one command at a time: `brew info`/`brew deps`, `brew install`, the `~/.zprofile` backup (`cp -p`) and the block append. Everything else (verification, `brew list`, `du`) ran inside the sandbox.

## Baseline (before any change, 2026-09-30 23:53 WIB)

| Item | Value | Command |
|---|---|---|
| `~/.zprofile` | 11 lines, 321 bytes, sha256 `84ff8ea5b3dcf3f570821ec7d1c4f2d1682ba374bbcf897c2ef33bd12b2d75f0` | `wc -l ~/.zprofile; shasum -a 256 ~/.zprofile` |
| `~/.zshrc` | absent | `ls -la ~/.zshrc` → `No such file or directory` |
| Java | none: `/usr/libexec/java_home -V` → `Unable to locate a Java Runtime.`; `which -a java` → `/usr/bin/java` (macOS stub only) | as shown |
| Homebrew | `Homebrew 6.0.22`, prefix `/opt/homebrew`, 29 formulae installed | `brew --version; brew --prefix; brew list --formula -1 \| wc -l` |
| Host | `arm64`, macOS 27.0.1 (26A434), 725 GiB free | `uname -m; sw_vers; df -h ~` |

## Commands and output

### 1. Formula check (sandbox disabled)

```
$ HOMEBREW_NO_ANALYTICS=1 HOMEBREW_NO_AUTO_UPDATE=1 brew info openjdk@17
==> openjdk@17: stable 17.0.20.1 (bottled) [keg-only]
Not installed
==> Dependencies
Required (6): freetype, giflib, harfbuzz, jpeg-turbo, libpng, little-cms2
==> Caveats
For the system Java wrappers to find this JDK, symlink it with
  sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
```

The `sudo ln` caveat was **not** run (SD-45; no `/Library/Java` symlink).

### 2. Install (sandbox disabled, stdin from `/dev/null`)

```
$ HOMEBREW_NO_ANALYTICS=1 HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ENV_HINTS=1 brew install openjdk@17 </dev/null
start 23:53:57
exit=0 duration=38s end 23:54:35
...
==> Installing openjdk@17
==> Pouring openjdk@17--17.0.20.1.arm64_golden_gate.bottle.tar.gz
🍺  /opt/homebrew/Cellar/openjdk@17/17.0.20.1: 635 files, 318.8MB
```

- `grep -i -E "sudo|password|error"` on the full install log finds one line only, the caveat text (`sudo ln -sfn ...`). There was no prompt and no error. The only warning was `Warning: You are using macOS 27.` (informational).
- Bottles poured: 23 (all from bottles, no source builds).
- Bottle download for the JDK itself: `openjdk@17--17.0.20.1.arm64_golden_gate.bottle.tar.gz`, 186,367,943 bytes (`ls -la ~/Library/Caches/Homebrew/downloads`).

### 3. Formula diff (HI-1: the exact list for rollback)

```
$ brew list --formula -1 | sort   (before: 29, after: 52)
added (23): cairo fontconfig freetype giflib glib graphite2 harfbuzz icu4c@78 jpeg-turbo libpng libtiff libx11 libxau libxcb libxdmcp libxext libxrender little-cms2 lzo openjdk@17 pixman webp xorgproto
removed: (none)
```

Disk use: `du -sk` over the 23 added Cellar directories totals **502.6 MiB**, of which `openjdk@17` is 305 MiB (`du -sh /opt/homebrew/Cellar/openjdk@17/17.0.20.1`). That is within the HI-1 hypothesis of 400-500 MB (slightly above it).

Keg path check (SD-45 hypothesis `Contents/Home` confirmed):

```
$ ls -la /opt/homebrew/opt/openjdk@17
/opt/homebrew/opt/openjdk@17 -> ../Cellar/openjdk@17/17.0.20.1
$ ls /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
bin conf demo include jmods legal lib man release
```

### 4. `~/.zprofile` backup (sandbox disabled)

```
$ cp -p ~/.zprofile ~/.zprofile.bak.dems-2026-09-30-235451
84ff8ea5b3dcf3f570821ec7d1c4f2d1682ba374bbcf897c2ef33bd12b2d75f0  /Users/gsp-budi/.zprofile
84ff8ea5b3dcf3f570821ec7d1c4f2d1682ba374bbcf897c2ef33bd12b2d75f0  /Users/gsp-budi/.zprofile.bak.dems-2026-09-30-235451
```

**Backup path:** `/Users/gsp-budi/.zprofile.bak.dems-2026-09-30-235451`. The name adds a time suffix to the register's `~/.zprofile.bak.dems-2026-09-30` because the delegation asked for a timestamped copy. It is the single backup for both rows 8 and 9 and holds the pre-task original.

### 5. Block A appended (sandbox disabled): diff

The marker text follows `research/03_analysis.md` Host Impact Register ("Exact profile lines") exactly.

```diff
--- /Users/gsp-budi/.zprofile.bak.dems-2026-09-30-235451	2026-09-11 23:06:17
+++ /Users/gsp-budi/.zprofile	2026-09-30 23:54:55
@@ -9,3 +9,8 @@
 # User-level global npm binaries (e.g. @nanonets/graft)
 PATH="${HOME}/.npm-global/bin:${PATH}"
 export PATH
+
+# >>> dems-demo: jdk (added 2026-09-30, blueprint row 8) >>>
+export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
+export PATH="$JAVA_HOME/bin:$PATH"
+# <<< dems-demo: jdk <<<
```

The block sits after the `brew shellenv` line (HI-3 ordering).

## Verification (fresh login shell)

Clean environment, so nothing is inherited from the agent session:

```
$ env -i HOME="$HOME" USER="$USER" TERM=dumb /bin/zsh -l -c '...'
--- which -a java
/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/java
/usr/bin/java
--- java -version
openjdk version "17.0.20.1" 2026-08-18
OpenJDK Runtime Environment Homebrew (build 17.0.20.1+0)
OpenJDK 64-Bit Server VM Homebrew (build 17.0.20.1+0, mixed mode, sharing)
--- os.arch
    java.home = /opt/homebrew/Cellar/openjdk@17/17.0.20.1/libexec/openjdk.jdk/Contents/Home
    java.runtime.version = 17.0.20.1+0
    java.vendor = Homebrew
    os.arch = aarch64
--- JAVA_HOME
/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
JAVA_HOME dir exists
java executable ok
--- javac
javac 17.0.20.1
--- ~/.zshrc
zshrc absent
```

Plain `zsh -l -c`, as the delegation specified:

```
$ zsh -l -c 'java -version 2>&1'
Picked up JAVA_TOOL_OPTIONS: -Djava.net.preferIPv4Stack=true
openjdk version "17.0.20.1" 2026-08-18
OpenJDK Runtime Environment Homebrew (build 17.0.20.1+0)
OpenJDK 64-Bit Server VM Homebrew (build 17.0.20.1+0, mixed mode, sharing)
$ zsh -l -c 'java -XshowSettings:properties -version 2>&1 | grep os.arch; echo $JAVA_HOME'
    os.arch = aarch64
/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
```

| Check (AC) | Expected | Observed | Result |
|---|---|---|---|
| AC-01 version | contains `17.0.20.1` | `openjdk version "17.0.20.1" 2026-08-18` | PASS |
| AC-01 `JAVA_HOME` | `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`; `test -x $JAVA_HOME/bin/java` | same path; `java executable ok` | PASS |
| AC-02 arch | `os.arch = aarch64` | `os.arch = aarch64` | PASS |
| Keg `java` takes precedence over the `/usr/bin/java` stub (HI-3 hypothesis) | keg first in `which -a` | keg first | PASS (hypothesis confirmed) |
| `~/.zshrc` not created (D11) | absent | `zshrc absent` | PASS |

**Note for AC-01 (finding):** inside a Claude Code agent session the environment contains `JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true`. It sits alongside the session's `HTTP(S)_PROXY` variables and is **not** set by any user profile file (`grep JAVA_TOOL_OPTIONS ~/.zprofile /etc/zprofile /etc/zshenv ~/.zshenv` → no match). The JVM then prints `Picked up JAVA_TOOL_OPTIONS: ...` as the first stderr line, so AC-01's `java -version 2>&1 | head -1` returns that line instead of the version line when an agent runs it. Suggested AC wording: `java -version 2>&1 | grep 'version'`. It is harmless for Gradle.

## Rollback

```sh
# 1. Restore the profile (either option)
cp -p ~/.zprofile.bak.dems-2026-09-30-235451 ~/.zprofile
#    or remove only the DEMS blocks by marker:
sed -i '' '/^# >>> dems-demo:/,/^# <<< dems-demo:/d' ~/.zprofile

# 2. Uninstall the JDK and exactly the 23 formulae this row added (no bare `brew autoremove`)
HOMEBREW_NO_AUTO_UPDATE=1 brew uninstall openjdk@17
HOMEBREW_NO_AUTO_UPDATE=1 brew uninstall cairo fontconfig freetype giflib glib graphite2 harfbuzz icu4c@78 jpeg-turbo libpng libtiff libx11 libxau libxcb libxdmcp libxext libxrender little-cms2 lzo pixman webp xorgproto

# 3. Optional: targeted bottle-cache cleanup (HI-2)
brew cleanup openjdk@17
```

None of the 23 added formulae were present before (`comm -23` of before/after lists is empty, and `comm -13` lists exactly these 23), so uninstalling them cannot remove anything that pre-dated this task. If a later row installs a formula that depends on one of them, `brew uninstall` refuses and names the dependant.

## Host paths changed by this row

| Path | Change |
|---|---|
| `/opt/homebrew/Cellar/{23 formulae}`, `/opt/homebrew/opt/*` links | added (502.6 MiB) |
| `~/Library/Caches/Homebrew/downloads/*`, `~/Library/Caches/Homebrew/api/*` | bottle and API cache written |
| `~/.zprofile` | block A appended (5 lines including a leading blank line) |
| `~/.zprofile.bak.dems-2026-09-30-235451` | created (backup) |

---
*Generated: 2026-09-30 23:56 WIB*
