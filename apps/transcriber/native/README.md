# dems-speaker-embed

One C file, `speaker-embed.c`: a thin caller of the sherpa-onnx C API that prints one speaker
embedding per span of a raw PCM file. It is the engine behind the speaker labelling of
`apps/transcriber/src/pipeline/diarization.ts` (blueprint row 78; transcript spec §A.4). It holds
no rule: clustering, thresholds and labels are TypeScript and are tested without a model.

Nothing built from it is in git. sherpa-onnx (Apache-2.0) and its bundled ONNX Runtime (MIT) are
the official release archive `sherpa-onnx-v1.13.8-<platform>-shared-no-tts.tar.bz2`, unpacked
under the git-ignored `.cache/stt/sherpa-onnx/` (see `THIRD_PARTY_NOTICES.md`). No Homebrew, no
npm package, no Python.

Build on this Mac (from the repository root):

```
S=.cache/stt/sherpa-onnx/sherpa-onnx-v1.13.8-osx-arm64-shared-no-tts
/usr/bin/clang -O2 -Wall -Wextra -Werror -I "$S/include" apps/transcriber/native/speaker-embed.c \
  -L "$S/lib" -lsherpa-onnx-c-api -Wl,-rpath,@loader_path/../lib -o "$S/bin/dems-speaker-embed"
```

On the x86-64 Linux Core the same file builds against the `linux-x64-shared-no-tts` archive with
`cc … -Wl,-rpath,'$ORIGIN/../lib'` (class C: not built or run in this task).

Remove: `rm -rf .cache/stt/sherpa-onnx`.
