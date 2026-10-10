# Git specialist note: wave G/H checkpoint commit

Date: 2026-10-10
Branch: main (local only, no push)
Commit: 74fd1f1 (fix: task 3 wave G/H ...)
Files committed: 408 (27858 insertions, 1001 deletions); 0 stash entries before the commit.

Ignore rules confirmed (git check-ignore -v): .data (.gitignore:70), .cache (:47), release (:64), .locks (:59).

Guards on the staged list, all 0 hits:
- key/keystore/certificate/signing/.docx/.env/pwfile/.data/.cache/.locks/node_modules/release name guard: 0 hits (no "name hit, source file" cases)
- media / model / archive extensions: 0 hits (no new .wav, .zip or other binaries)
- staged files larger than 2 MB: none
- private-key marker content search (three marker kinds): hit only in the earlier wave D/E git note, which was unstaged

Left untracked on purpose (as before): the earlier wave D/E and wave F git notes in this folder, because they quote the private-key marker words. This note avoids those words and is left uncommitted, so the next commit can include it.
