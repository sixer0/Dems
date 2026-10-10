# npm production dependency inventory (task 3, row 96, DOC-05)

Tier 3. Generated on 2026-10-10 from the tree at commit `f293221` by a read-only script: no
installer, no `npm` command and no network request was run.

- Source of the package set: `package-lock.json` (lockfileVersion 3, SHA-256
  `83fc059c4cc76720c5ced960abcead6b8339d9030113c51eac205d6c3b5c20cc`, 1,920 entries). For each app
  workspace (`apps/core-server`, `apps/core-web`, `apps/mobile`, `apps/mock-core`,
  `apps/transcriber`) the script starts at the workspace entry and follows `dependencies`,
  `optionalDependencies` and the `peerDependencies` the lockfile holds an entry for, resolving each
  name the way Node does (the nearest `node_modules/<name>` entry going up from the dependent).
  `devDependencies` are not followed. Workspace links (`@dems/shared`, `@dems/capture-protocol`,
  `@dems/transcriber`) are followed into the workspace and are not listed: they are this
  repository's own code.
- Licence: the `license` value of the lockfile entry, compared with the `license` value of the
  installed package's own `package.json` where the package is on this host. The two never
  disagreed (0 conflicts). 70 entries are optional packages for other platforms that are not
  installed here ("not installed on this host"): their licence is the lockfile's value only.
- Result: 1,290 unique `name@version`; unresolved names 0; "licence not established" 0.
  Per app: core-server 138, core-web 390, mobile 865, mock-core 100, transcriber 8.
- What this list is NOT: it is the set `npm install --omit=dev` would resolve for each app, which
  includes build-time and command-line tooling pulled in by `expo` and `react-native`; it is not
  the list of what ends up inside a web bundle or an APK. It holds licence IDENTIFIERS as the
  packages declare them, not licence texts, and it does not look inside a package for third-party
  code bundled there. Maven / Gradle artefacts of the Android build are not in the lockfile and
  are not listed here.
- Full licence texts for a distribution: `node scripts/release/gen-npm-licenses.mjs --workspace
  <name> --out <file> [--title <text>]` (defined in `scripts/release/gen-npm-licenses.mjs`; it
  runs `npm ls --omit=dev` and reads `node_modules`; not run by this row).

| Package | Version | Licence | Apps | Licence read from |
|---|---|---|---|---|
| `@adobe/react-spectrum` | 3.47.5 | Apache-2.0 | core-web | lockfile + package.json |
| `@adobe/react-spectrum-ui` | 1.2.1 | Apache-2.0 | core-web | lockfile + package.json |
| `@adobe/react-spectrum-workflow` | 2.3.5 | Apache-2.0 | core-web | lockfile + package.json |
| `@ai-sdk/gateway` | 3.0.13 | Apache-2.0 | core-web | lockfile + package.json |
| `@ai-sdk/provider` | 3.0.2 | Apache-2.0 | core-web | lockfile + package.json |
| `@ai-sdk/provider-utils` | 4.0.5 | Apache-2.0 | core-web | lockfile + package.json |
| `@ai-sdk/vue` | 3.0.33 | Apache-2.0 | core-web | lockfile + package.json |
| `@babel/code-frame` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/compat-data` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/core` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/generator` | 7.29.8 | MIT | mobile | lockfile + package.json |
| `@babel/helper-annotate-as-pure` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-compilation-targets` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-create-class-features-plugin` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-create-regexp-features-plugin` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-define-polyfill-provider` | 0.6.8 | MIT | mobile | lockfile + package.json |
| `@babel/helper-globals` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-member-expression-to-functions` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-module-imports` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-module-transforms` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-optimise-call-expression` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-plugin-utils` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-remap-async-to-generator` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-replace-supers` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-skip-transparent-expression-wrappers` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-string-parser` | 7.29.7 | MIT | core-web, mobile | lockfile + package.json |
| `@babel/helper-validator-identifier` | 7.29.7 | MIT | core-web, mobile | lockfile + package.json |
| `@babel/helper-validator-option` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helper-wrap-function` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/helpers` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/parser` | 7.29.9 | MIT | core-web, mobile | lockfile + package.json |
| `@babel/plugin-proposal-decorators` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-proposal-export-default-from` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-async-generators` | 7.8.4 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-bigint` | 7.8.3 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-class-properties` | 7.12.13 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-class-static-block` | 7.14.5 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-decorators` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-dynamic-import` | 7.8.3 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-export-default-from` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-flow` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-import-attributes` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-import-meta` | 7.10.4 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-json-strings` | 7.8.3 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-jsx` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-logical-assignment-operators` | 7.10.4 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-nullish-coalescing-operator` | 7.8.3 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-numeric-separator` | 7.10.4 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-object-rest-spread` | 7.8.3 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-optional-catch-binding` | 7.8.3 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-optional-chaining` | 7.8.3 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-private-property-in-object` | 7.14.5 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-top-level-await` | 7.14.5 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-syntax-typescript` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-arrow-functions` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-async-generator-functions` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-async-to-generator` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-block-scoping` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-class-properties` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-class-static-block` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-classes` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-destructuring` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-export-namespace-from` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-flow-strip-types` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-for-of` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-logical-assignment-operators` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-modules-commonjs` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-named-capturing-groups-regex` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-nullish-coalescing-operator` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-object-rest-spread` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-optional-catch-binding` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-optional-chaining` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-parameters` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-private-methods` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-private-property-in-object` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-react-display-name` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-react-jsx` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-react-jsx-development` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-react-jsx-self` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-react-jsx-source` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-react-pure-annotations` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-regenerator` | 7.29.8 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-runtime` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-shorthand-properties` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-template-literals` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-typescript` | 7.29.9 | MIT | mobile | lockfile + package.json |
| `@babel/plugin-transform-unicode-regex` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/preset-typescript` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/runtime` | 7.29.7 | MIT | core-web, mobile | lockfile + package.json |
| `@babel/template` | 7.29.7 | MIT | mobile | lockfile + package.json |
| `@babel/traverse` | 7.29.8 | MIT | mobile | lockfile + package.json |
| `@babel/types` | 7.29.8 | MIT | core-web, mobile | lockfile + package.json |
| `@bcoe/v8-coverage` | 0.2.3 | MIT | mobile | lockfile + package.json |
| `@codemirror/autocomplete` | 6.20.3 | MIT | core-web | lockfile + package.json |
| `@codemirror/commands` | 6.11.1 | MIT | core-web | lockfile + package.json |
| `@codemirror/lang-css` | 6.3.1 | MIT | core-web | lockfile + package.json |
| `@codemirror/lang-html` | 6.4.12 | MIT | core-web | lockfile + package.json |
| `@codemirror/lang-javascript` | 6.2.5 | MIT | core-web | lockfile + package.json |
| `@codemirror/lang-json` | 6.0.2 | MIT | core-web | lockfile + package.json |
| `@codemirror/lang-xml` | 6.1.0 | MIT | core-web | lockfile + package.json |
| `@codemirror/lang-yaml` | 6.1.3 | MIT | core-web | lockfile + package.json |
| `@codemirror/language` | 6.12.4 | MIT | core-web | lockfile + package.json |
| `@codemirror/lint` | 6.9.7 | MIT | core-web | lockfile + package.json |
| `@codemirror/state` | 6.7.6 | MIT | core-web | lockfile + package.json |
| `@codemirror/view` | 6.43.13 | MIT | core-web | lockfile + package.json |
| `@egjs/hammerjs` | 2.0.17 | MIT | mobile | lockfile + package.json |
| `@emnapi/core` | 1.10.0 | MIT | mobile | lockfile only; not installed on this host |
| `@emnapi/runtime` | 1.10.0 | MIT | mobile | lockfile only; not installed on this host |
| `@emnapi/wasi-threads` | 1.2.1 | MIT | mobile | lockfile only; not installed on this host |
| `@esbuild/aix-ppc64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/android-arm` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/android-arm64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/android-x64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/darwin-arm64` | 0.28.2 | MIT | core-server, mock-core | lockfile + package.json |
| `@esbuild/darwin-x64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/freebsd-arm64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/freebsd-x64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/linux-arm` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/linux-arm64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/linux-ia32` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/linux-loong64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/linux-mips64el` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/linux-ppc64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/linux-riscv64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/linux-s390x` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/linux-x64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/netbsd-arm64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/netbsd-x64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/openbsd-arm64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/openbsd-x64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/openharmony-arm64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/sunos-x64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/win32-arm64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/win32-ia32` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@esbuild/win32-x64` | 0.28.2 | MIT | core-server, mock-core | lockfile only; not installed on this host |
| `@expo-google-fonts/inter` | 0.4.2 | MIT AND OFL-1.1 | mobile | lockfile + package.json |
| `@expo-google-fonts/jetbrains-mono` | 0.4.1 | MIT AND OFL-1.1 | mobile | lockfile + package.json |
| `@expo-google-fonts/material-symbols` | 0.4.48 | MIT AND Apache-2.0 | mobile | lockfile + package.json |
| `@expo-google-fonts/orbitron` | 0.4.2 | MIT AND OFL-1.1 | mobile | lockfile + package.json |
| `@expo/cli` | 57.0.27 | MIT | mobile | lockfile + package.json |
| `@expo/code-signing-certificates` | 0.0.6 | MIT | mobile | lockfile + package.json |
| `@expo/config` | 57.0.9 | MIT | mobile | lockfile + package.json |
| `@expo/config-plugins` | 57.0.9 | MIT | mobile | lockfile + package.json |
| `@expo/config-types` | 57.0.2 | MIT | mobile | lockfile + package.json |
| `@expo/devcert` | 1.2.1 | MIT | mobile | lockfile + package.json |
| `@expo/devtools` | 57.0.1 | MIT | mobile | lockfile + package.json |
| `@expo/dom-webview` | 57.0.1 | MIT | mobile | lockfile + package.json |
| `@expo/env` | 2.4.3 | MIT | mobile | lockfile + package.json |
| `@expo/expo-modules-macros-plugin` | 0.6.1 | MIT | mobile | lockfile + package.json |
| `@expo/fingerprint` | 0.20.13 | MIT | mobile | lockfile + package.json |
| `@expo/image-utils` | 0.11.5 | MIT | mobile | lockfile + package.json |
| `@expo/inline-modules` | 0.1.7 | MIT | mobile | lockfile + package.json |
| `@expo/json-file` | 11.0.1 | MIT | mobile | lockfile + package.json |
| `@expo/local-build-cache-provider` | 57.0.8 | MIT | mobile | lockfile + package.json |
| `@expo/log-box` | 57.0.4 | MIT | mobile | lockfile + package.json |
| `@expo/metro` | 56.0.2 | MIT | mobile | lockfile + package.json |
| `@expo/metro-config` | 57.0.12 | MIT | mobile | lockfile + package.json |
| `@expo/metro-file-map` | 57.0.3 | MIT | mobile | lockfile + package.json |
| `@expo/metro-runtime` | 57.0.16 | MIT | mobile | lockfile + package.json |
| `@expo/osascript` | 2.7.1 | MIT | mobile | lockfile + package.json |
| `@expo/package-manager` | 1.13.1 | MIT | mobile | lockfile + package.json |
| `@expo/plist` | 0.8.1 | MIT | mobile | lockfile + package.json |
| `@expo/prebuild-config` | 57.0.16 | MIT | mobile | lockfile + package.json |
| `@expo/require-utils` | 57.0.5 | MIT | mobile | lockfile + package.json |
| `@expo/router-server` | 57.0.11 | MIT | mobile | lockfile + package.json |
| `@expo/schema-utils` | 57.0.2 | MIT | mobile | lockfile + package.json |
| `@expo/sdk-runtime-versions` | 1.0.0 | MIT | mobile | lockfile + package.json |
| `@expo/spawn-async` | 1.8.0 | MIT | mobile | lockfile + package.json |
| `@expo/sudo-prompt` | 9.3.2 | MIT | mobile | lockfile + package.json |
| `@expo/ui` | 57.0.21 | MIT | mobile | lockfile + package.json |
| `@expo/ws-tunnel` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `@expo/xcpretty` | 4.4.5 | BSD-3-Clause | mobile | lockfile + package.json |
| `@fastify/ajv-compiler` | 4.0.6 | MIT | core-server, mock-core | lockfile + package.json |
| `@fastify/cookie` | 11.1.2 | MIT | core-server | lockfile + package.json |
| `@fastify/cors` | 11.3.0 | MIT | mock-core | lockfile + package.json |
| `@fastify/error` | 4.2.0 | MIT | core-server, mock-core | lockfile + package.json |
| `@fastify/fast-json-stringify-compiler` | 5.1.0 | MIT | core-server, mock-core | lockfile + package.json |
| `@fastify/forwarded` | 3.0.2 | MIT | core-server, mock-core | lockfile + package.json |
| `@fastify/helmet` | 13.1.1 | MIT | core-server | lockfile + package.json |
| `@fastify/merge-json-schemas` | 0.2.1 | MIT | core-server, mock-core | lockfile + package.json |
| `@fastify/proxy-addr` | 5.1.1 | MIT | core-server, mock-core | lockfile + package.json |
| `@fastify/rate-limit` | 11.2.0 | MIT | core-server | lockfile + package.json |
| `@fastify/swagger` | 9.9.1 | MIT | core-server | lockfile + package.json |
| `@fastify/websocket` | 11.3.1 | MIT | core-server, mock-core | lockfile + package.json |
| `@floating-ui/core` | 1.8.0 | MIT | core-web | lockfile + package.json |
| `@floating-ui/dom` | 1.8.0 | MIT | core-web | lockfile + package.json |
| `@floating-ui/utils` | 0.2.10 | MIT | core-web | lockfile + package.json |
| `@floating-ui/utils` | 0.2.12 | MIT | core-web | lockfile + package.json |
| `@floating-ui/vue` | 1.1.9 | MIT | core-web | lockfile + package.json |
| `@fontsource-variable/inter` | 5.3.0 | OFL-1.1 | core-web | lockfile + package.json |
| `@fontsource-variable/jetbrains-mono` | 5.3.0 | OFL-1.1 | core-web | lockfile + package.json |
| `@fontsource-variable/orbitron` | 5.3.0 | OFL-1.1 | core-web | lockfile + package.json |
| `@gorhom/bottom-sheet` | 5.2.14 | MIT | mobile | lockfile + package.json |
| `@gorhom/portal` | 1.0.14 | MIT | mobile | lockfile + package.json |
| `@headlessui/tailwindcss` | 0.2.2 | MIT | core-web | lockfile + package.json |
| `@headlessui/vue` | 1.7.23 | MIT | core-web | lockfile + package.json |
| `@heroui/react` | 3.2.6 | MIT | core-web | lockfile + package.json |
| `@heroui/styles` | 3.2.6 | MIT | core-web | lockfile + package.json |
| `@hookform/resolvers` | 5.9.1 | MIT | core-web, mobile | lockfile + package.json |
| `@internationalized/date` | 3.12.4 | Apache-2.0 | core-web | lockfile + package.json |
| `@internationalized/number` | 3.6.8 | Apache-2.0 | core-web | lockfile + package.json |
| `@internationalized/string` | 3.2.10 | Apache-2.0 | core-web | lockfile + package.json |
| `@isaacs/ttlcache` | 1.4.1 | ISC | mobile | lockfile + package.json |
| `@istanbuljs/load-nyc-config` | 1.1.0 | ISC | mobile | lockfile + package.json |
| `@istanbuljs/schema` | 0.1.6 | MIT | mobile | lockfile + package.json |
| `@jest/console` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/core` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/create-cache-key-function` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/diff-sequences` | 30.5.0 | MIT | mobile | lockfile + package.json |
| `@jest/environment` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/expect` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/expect-utils` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/fake-timers` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/get-type` | 30.5.0 | MIT | mobile | lockfile + package.json |
| `@jest/globals` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/react-is-18` | 18.3.1 | MIT | mobile | lockfile + package.json |
| `@jest/react-is-19` | 19.3.0 | MIT | mobile | lockfile + package.json |
| `@jest/reporters` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/schemas` | 29.6.3 | MIT | mobile | lockfile + package.json |
| `@jest/schemas` | 30.5.0 | MIT | mobile | lockfile + package.json |
| `@jest/source-map` | 29.6.3 | MIT | mobile | lockfile + package.json |
| `@jest/test-result` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/test-sequencer` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/transform` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `@jest/types` | 29.6.3 | MIT | mobile | lockfile + package.json |
| `@jridgewell/gen-mapping` | 0.3.13 | MIT | mobile | lockfile + package.json |
| `@jridgewell/remapping` | 2.3.5 | MIT | mobile | lockfile + package.json |
| `@jridgewell/resolve-uri` | 3.1.2 | MIT | mobile | lockfile + package.json |
| `@jridgewell/source-map` | 0.3.11 | MIT | mobile | lockfile + package.json |
| `@jridgewell/sourcemap-codec` | 1.6.0 | MIT | core-web, mobile | lockfile + package.json |
| `@jridgewell/trace-mapping` | 0.3.31 | MIT | mobile | lockfile + package.json |
| `@lezer/common` | 1.5.3 | MIT | core-web | lockfile + package.json |
| `@lezer/css` | 1.3.8 | MIT | core-web | lockfile + package.json |
| `@lezer/highlight` | 1.2.5 | MIT | core-web | lockfile + package.json |
| `@lezer/html` | 1.3.13 | MIT | core-web | lockfile + package.json |
| `@lezer/javascript` | 1.5.5 | MIT | core-web | lockfile + package.json |
| `@lezer/json` | 1.0.3 | MIT | core-web | lockfile + package.json |
| `@lezer/lr` | 1.4.10 | MIT | core-web | lockfile + package.json |
| `@lezer/xml` | 1.0.6 | MIT | core-web | lockfile + package.json |
| `@lezer/yaml` | 1.0.4 | MIT | core-web | lockfile + package.json |
| `@lukeed/ms` | 2.0.2 | MIT | core-server | lockfile + package.json |
| `@marijn/find-cluster-break` | 1.0.4 | MIT | core-web | lockfile + package.json |
| `@napi-rs/wasm-runtime` | 1.2.4 | MIT | mobile | lockfile only; not installed on this host |
| `@noble/hashes` | 2.4.0 | MIT | core-server, core-web, mobile, mock-core, transcriber | lockfile + package.json |
| `@opentelemetry/api` | 1.9.0 | Apache-2.0 | core-server, core-web | lockfile + package.json |
| `@phosphor-icons/core` | 2.1.1 | MIT | core-web | lockfile + package.json |
| `@pinojs/redact` | 0.4.0 | MIT | core-server, mock-core | lockfile + package.json |
| `@radix-ui/primitive` | 1.1.7 | MIT | core-web, mobile | lockfile + package.json |
| `@radix-ui/react-avatar` | 1.2.6 | MIT | core-web | lockfile + package.json |
| `@radix-ui/react-collection` | 1.1.15 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-compose-refs` | 1.1.5 | MIT | core-web, mobile | lockfile + package.json |
| `@radix-ui/react-context` | 1.2.2 | MIT | core-web, mobile | lockfile + package.json |
| `@radix-ui/react-dialog` | 1.1.23 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-direction` | 1.1.4 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-dismissable-layer` | 1.1.19 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-focus-guards` | 1.1.6 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-focus-scope` | 1.1.16 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-id` | 1.1.4 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-portal` | 1.1.17 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-presence` | 1.1.10 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-primitive` | 2.1.10 | MIT | core-web, mobile | lockfile + package.json |
| `@radix-ui/react-roving-focus` | 1.1.19 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-slot` | 1.3.3 | MIT | core-web, mobile | lockfile + package.json |
| `@radix-ui/react-tabs` | 1.1.21 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-use-callback-ref` | 1.1.4 | MIT | core-web, mobile | lockfile + package.json |
| `@radix-ui/react-use-controllable-state` | 1.2.6 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-use-effect-event` | 0.0.5 | MIT | mobile | lockfile + package.json |
| `@radix-ui/react-use-is-hydrated` | 0.1.3 | MIT | core-web, mobile | lockfile + package.json |
| `@radix-ui/react-use-layout-effect` | 1.1.4 | MIT | core-web, mobile | lockfile + package.json |
| `@react-aria/color` | 3.2.1 | Apache-2.0 | core-web | lockfile + package.json |
| `@react-aria/ssr` | 3.10.1 | Apache-2.0 | core-web | lockfile + package.json |
| `@react-aria/utils` | 3.34.1 | Apache-2.0 | core-web | lockfile + package.json |
| `@react-native-async-storage/async-storage` | 2.2.0 | MIT | mobile | lockfile + package.json |
| `@react-native-masked-view/masked-view` | 0.3.2 | MIT | mobile | lockfile + package.json |
| `@react-native/assets-registry` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/babel-plugin-codegen` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/babel-preset` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/codegen` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/community-cli-plugin` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/debugger-frontend` | 0.86.3 | BSD-3-Clause | mobile | lockfile + package.json |
| `@react-native/debugger-shell` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/dev-middleware` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/gradle-plugin` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/jest-preset` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/js-polyfills` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/metro-babel-transformer` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/metro-config` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/normalize-colors` | 0.74.89 | MIT | mobile | lockfile + package.json |
| `@react-native/normalize-colors` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-native/virtualized-lists` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `@react-spectrum/color` | 3.2.1 | Apache-2.0 | core-web | lockfile + package.json |
| `@react-spectrum/provider` | 3.11.1 | Apache-2.0 | core-web | lockfile + package.json |
| `@react-stately/color` | 3.10.1 | Apache-2.0 | core-web | lockfile + package.json |
| `@react-stately/utils` | 3.12.1 | Apache-2.0 | core-web | lockfile + package.json |
| `@react-types/color` | 3.2.0 | Apache-2.0 | core-web | lockfile + package.json |
| `@react-types/shared` | 3.36.1 | Apache-2.0 | core-web | lockfile + package.json |
| `@reduxjs/toolkit` | 2.13.0 | MIT | core-web | lockfile + package.json |
| `@replit/codemirror-css-color-picker` | 6.3.0 | MIT | core-web | lockfile + package.json |
| `@scalar/agent-chat` | 0.12.39 | MIT | core-web | lockfile + package.json |
| `@scalar/api-client` | 3.21.3 | MIT | core-web | lockfile + package.json |
| `@scalar/api-reference` | 1.72.3 | MIT | core-web | lockfile + package.json |
| `@scalar/api-reference-react` | 0.9.76 | MIT | core-web | lockfile + package.json |
| `@scalar/asyncapi-upgrader` | 0.1.14 | MIT | core-web | lockfile + package.json |
| `@scalar/blocks` | 0.4.2 | MIT | core-web | lockfile + package.json |
| `@scalar/code-highlight` | 0.4.7 | MIT | core-web | lockfile + package.json |
| `@scalar/components` | 0.30.5 | MIT | core-web | lockfile + package.json |
| `@scalar/helpers` | 0.16.0 | MIT | core-web | lockfile + package.json |
| `@scalar/icons` | 0.7.6 | MIT | core-web | lockfile + package.json |
| `@scalar/json-magic` | 0.15.3 | MIT | core-web | lockfile + package.json |
| `@scalar/localization` | 0.2.4 | MIT | core-web | lockfile + package.json |
| `@scalar/oas-utils` | 0.20.8 | MIT | core-web | lockfile + package.json |
| `@scalar/openapi-to-markdown` | 1.5.0 | MIT | core-web | lockfile + package.json |
| `@scalar/openapi-types` | 0.9.7 | MIT | core-web | lockfile + package.json |
| `@scalar/openapi-upgrader` | 0.4.1 | MIT | core-web | lockfile + package.json |
| `@scalar/schemas` | 0.12.2 | MIT | core-web | lockfile + package.json |
| `@scalar/sidebar` | 0.11.10 | MIT | core-web | lockfile + package.json |
| `@scalar/snippetz` | 0.10.4 | MIT | core-web | lockfile + package.json |
| `@scalar/themes` | 0.18.1 | MIT | core-web | lockfile + package.json |
| `@scalar/typebox` | 0.1.3 | MIT | core-web | lockfile + package.json |
| `@scalar/types` | 0.22.3 | MIT | core-web | lockfile + package.json |
| `@scalar/use-codemirror` | 0.14.15 | MIT | core-web | lockfile + package.json |
| `@scalar/use-hooks` | 0.4.16 | MIT | core-web | lockfile + package.json |
| `@scalar/use-toasts` | 0.10.5 | MIT | core-web | lockfile + package.json |
| `@scalar/validation` | 0.6.5 | MIT | core-web | lockfile + package.json |
| `@scalar/workspace-store` | 0.67.2 | MIT | core-web | lockfile + package.json |
| `@shopify/flash-list` | 2.0.2 | MIT | mobile | lockfile + package.json |
| `@shopify/react-native-skia` | 2.6.2 | MIT | mobile | lockfile + package.json |
| `@sinclair/typebox` | 0.27.12 | MIT | core-web, mobile | lockfile + package.json |
| `@sinclair/typebox` | 0.34.52 | MIT | mobile | lockfile + package.json |
| `@sinonjs/commons` | 3.0.1 | BSD-3-Clause | mobile | lockfile + package.json |
| `@sinonjs/fake-timers` | 10.3.0 | BSD-3-Clause | mobile | lockfile + package.json |
| `@spectrum-icons/ui` | 3.7.2 | Apache-2.0 | core-web | lockfile + package.json |
| `@spectrum-icons/workflow` | 4.3.2 | Apache-2.0 | core-web | lockfile + package.json |
| `@standard-schema/spec` | 1.1.0 | MIT | core-web, mobile | lockfile + package.json |
| `@standard-schema/utils` | 0.3.0 | MIT | core-web, mobile | lockfile + package.json |
| `@swc/helpers` | 0.5.23 | Apache-2.0 | core-web | lockfile + package.json |
| `@tailwindcss/node` | 4.3.3 | MIT | mobile | lockfile + package.json |
| `@tailwindcss/oxide` | 4.3.3 | MIT | mobile | lockfile + package.json |
| `@tailwindcss/oxide-android-arm64` | 4.3.3 | MIT | mobile | lockfile only; not installed on this host |
| `@tailwindcss/oxide-darwin-arm64` | 4.3.3 | MIT | mobile | lockfile + package.json |
| `@tailwindcss/oxide-darwin-x64` | 4.3.3 | MIT | mobile | lockfile only; not installed on this host |
| `@tailwindcss/oxide-freebsd-x64` | 4.3.3 | MIT | mobile | lockfile only; not installed on this host |
| `@tailwindcss/oxide-linux-arm-gnueabihf` | 4.3.3 | MIT | mobile | lockfile only; not installed on this host |
| `@tailwindcss/oxide-linux-arm64-gnu` | 4.3.3 | MIT | mobile | lockfile only; not installed on this host |
| `@tailwindcss/oxide-linux-arm64-musl` | 4.3.3 | MIT | mobile | lockfile only; not installed on this host |
| `@tailwindcss/oxide-linux-x64-gnu` | 4.3.3 | MIT | mobile | lockfile only; not installed on this host |
| `@tailwindcss/oxide-linux-x64-musl` | 4.3.3 | MIT | mobile | lockfile only; not installed on this host |
| `@tailwindcss/oxide-wasm32-wasi` | 4.3.3 | MIT | mobile | lockfile only; not installed on this host |
| `@tailwindcss/oxide-win32-arm64-msvc` | 4.3.3 | MIT | mobile | lockfile only; not installed on this host |
| `@tailwindcss/oxide-win32-x64-msvc` | 4.3.3 | MIT | mobile | lockfile only; not installed on this host |
| `@tanstack/history` | 1.162.4 | MIT | core-web | lockfile + package.json |
| `@tanstack/query-core` | 5.104.0 | MIT | core-web, mobile | lockfile + package.json |
| `@tanstack/react-query` | 5.104.0 | MIT | core-web, mobile | lockfile + package.json |
| `@tanstack/react-router` | 1.170.40 | MIT | core-web | lockfile + package.json |
| `@tanstack/react-store` | 0.11.2 | MIT | core-web | lockfile + package.json |
| `@tanstack/react-table` | 8.21.3 | MIT | core-web | lockfile + package.json |
| `@tanstack/router-core` | 1.171.33 | MIT | core-web | lockfile + package.json |
| `@tanstack/store` | 0.11.2 | MIT | core-web | lockfile + package.json |
| `@tanstack/table-core` | 8.21.3 | MIT | core-web | lockfile + package.json |
| `@tanstack/virtual-core` | 3.17.11 | MIT | core-web | lockfile + package.json |
| `@tanstack/vue-virtual` | 3.13.39 | MIT | core-web | lockfile + package.json |
| `@testing-library/react-native` | 13.3.3 | MIT | mobile | lockfile + package.json |
| `@tybys/wasm-util` | 0.10.4 | MIT | mobile | lockfile only; not installed on this host |
| `@types/babel__core` | 7.20.5 | MIT | mobile | lockfile + package.json |
| `@types/babel__generator` | 7.27.0 | MIT | mobile | lockfile + package.json |
| `@types/babel__template` | 7.4.4 | MIT | mobile | lockfile + package.json |
| `@types/babel__traverse` | 7.28.0 | MIT | mobile | lockfile + package.json |
| `@types/d3-array` | 3.2.2 | MIT | core-web | lockfile + package.json |
| `@types/d3-color` | 3.1.3 | MIT | core-web | lockfile + package.json |
| `@types/d3-ease` | 3.0.2 | MIT | core-web | lockfile + package.json |
| `@types/d3-interpolate` | 3.0.4 | MIT | core-web | lockfile + package.json |
| `@types/d3-path` | 3.1.1 | MIT | core-web | lockfile + package.json |
| `@types/d3-scale` | 4.0.9 | MIT | core-web | lockfile + package.json |
| `@types/d3-shape` | 3.2.0 | MIT | core-web | lockfile + package.json |
| `@types/d3-time` | 3.0.4 | MIT | core-web | lockfile + package.json |
| `@types/d3-timer` | 3.0.2 | MIT | core-web | lockfile + package.json |
| `@types/debug` | 4.1.13 | MIT | core-web | lockfile + package.json |
| `@types/graceful-fs` | 4.1.9 | MIT | mobile | lockfile + package.json |
| `@types/hammerjs` | 2.0.46 | MIT | mobile | lockfile + package.json |
| `@types/har-format` | 1.2.16 | MIT | core-web | lockfile + package.json |
| `@types/hast` | 3.0.5 | MIT | core-web | lockfile + package.json |
| `@types/istanbul-lib-coverage` | 2.0.6 | MIT | mobile | lockfile + package.json |
| `@types/istanbul-lib-report` | 3.0.3 | MIT | mobile | lockfile + package.json |
| `@types/istanbul-reports` | 3.0.4 | MIT | mobile | lockfile + package.json |
| `@types/mdast` | 4.0.4 | MIT | core-web | lockfile + package.json |
| `@types/ms` | 2.1.0 | MIT | core-web | lockfile + package.json |
| `@types/node` | 24.19.0 | MIT | core-web | lockfile + package.json |
| `@types/node` | 26.6.3 | MIT | core-server, mobile | lockfile + package.json |
| `@types/pg` | 8.23.1 | MIT | core-server | lockfile + package.json |
| `@types/react` | 19.2.18 | MIT | core-server, core-web, mobile, mock-core, transcriber | lockfile + package.json |
| `@types/react-dom` | 19.2.7 | MIT | core-web, mobile | lockfile + package.json |
| `@types/react-reconciler` | 0.28.9 | MIT | mobile | lockfile + package.json |
| `@types/react-test-renderer` | 19.3.0 | MIT | mobile | lockfile + package.json |
| `@types/stack-utils` | 2.0.3 | MIT | mobile | lockfile + package.json |
| `@types/unist` | 3.0.3 | MIT | core-web | lockfile + package.json |
| `@types/use-sync-external-store` | 0.0.6 | MIT | core-web | lockfile + package.json |
| `@types/web-bluetooth` | 0.0.20 | MIT | core-web | lockfile + package.json |
| `@types/web-bluetooth` | 0.0.21 | MIT | core-web | lockfile + package.json |
| `@types/yargs` | 17.0.35 | MIT | mobile | lockfile + package.json |
| `@types/yargs-parser` | 21.0.3 | MIT | mobile | lockfile + package.json |
| `@ungap/structured-clone` | 1.4.0 | ISC | core-web, mobile | lockfile + package.json |
| `@unhead/vue` | 2.1.17 | MIT | core-web | lockfile + package.json |
| `@vercel/oidc` | 3.1.0 | Apache-2.0 | core-web | lockfile + package.json |
| `@vue/compiler-core` | 3.5.43 | MIT | core-web | lockfile + package.json |
| `@vue/compiler-dom` | 3.5.43 | MIT | core-web | lockfile + package.json |
| `@vue/compiler-sfc` | 3.5.43 | MIT | core-web | lockfile + package.json |
| `@vue/compiler-ssr` | 3.5.43 | MIT | core-web | lockfile + package.json |
| `@vue/reactivity` | 3.5.43 | MIT | core-web | lockfile + package.json |
| `@vue/runtime-core` | 3.5.43 | MIT | core-web | lockfile + package.json |
| `@vue/runtime-dom` | 3.5.43 | MIT | core-web | lockfile + package.json |
| `@vue/server-renderer` | 3.5.43 | MIT | core-web | lockfile + package.json |
| `@vue/shared` | 3.5.43 | MIT | core-web | lockfile + package.json |
| `@vueuse/core` | 10.11.1 | MIT | core-web | lockfile + package.json |
| `@vueuse/core` | 13.9.0 | MIT | core-web | lockfile + package.json |
| `@vueuse/integrations` | 13.9.0 | MIT | core-web | lockfile + package.json |
| `@vueuse/metadata` | 10.11.1 | MIT | core-web | lockfile + package.json |
| `@vueuse/metadata` | 13.9.0 | MIT | core-web | lockfile + package.json |
| `@vueuse/shared` | 10.11.1 | MIT | core-web | lockfile + package.json |
| `@vueuse/shared` | 13.9.0 | MIT | core-web | lockfile + package.json |
| `@webgpu/types` | 0.1.21 | BSD-3-Clause | mobile | lockfile + package.json |
| `@xmldom/xmldom` | 0.8.15 | MIT | mobile | lockfile + package.json |
| `@xmldom/xmldom` | 0.9.12 | MIT | mobile | lockfile + package.json |
| `abort-controller` | 3.0.0 | MIT | mobile | lockfile + package.json |
| `abstract-logging` | 2.0.1 | MIT | core-server, mock-core | lockfile + package.json |
| `accepts` | 1.3.8 | MIT | mobile | lockfile + package.json |
| `accepts` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `acorn` | 8.18.0 | MIT | mobile | lockfile + package.json |
| `agent-base` | 7.1.4 | MIT | mobile | lockfile + package.json |
| `agent-cli-detector` | 0.1.7 | MIT | mobile | lockfile + package.json |
| `ai` | 6.0.33 | Apache-2.0 | core-web | lockfile + package.json |
| `ajv` | 8.20.0 | MIT | core-server, core-web, mobile, mock-core | lockfile + package.json |
| `ajv-formats` | 3.0.1 | MIT | core-server, core-web, mobile, mock-core | lockfile + package.json |
| `anser` | 1.4.10 | MIT | mobile | lockfile + package.json |
| `ansi-escapes` | 4.3.2 | MIT | mobile | lockfile + package.json |
| `ansi-regex` | 4.1.1 | MIT | mobile | lockfile + package.json |
| `ansi-regex` | 5.0.1 | MIT | mobile | lockfile + package.json |
| `ansi-styles` | 3.2.1 | MIT | mobile | lockfile + package.json |
| `ansi-styles` | 4.3.0 | MIT | mobile | lockfile + package.json |
| `ansi-styles` | 5.2.0 | MIT | mobile | lockfile + package.json |
| `anymatch` | 3.1.3 | ISC | mobile | lockfile + package.json |
| `arg` | 5.0.2 | MIT | mobile | lockfile + package.json |
| `argparse` | 1.0.10 | MIT | mobile | lockfile + package.json |
| `argparse` | 2.0.1 | Python-2.0 | mobile | lockfile + package.json |
| `aria-hidden` | 1.2.6 | MIT | core-web, mobile | lockfile + package.json |
| `asap` | 2.0.6 | MIT | mobile | lockfile + package.json |
| `atomic-sleep` | 1.0.0 | MIT | core-server, mock-core | lockfile + package.json |
| `avvio` | 9.3.0 | MIT | core-server, mock-core | lockfile + package.json |
| `babel-jest` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `babel-plugin-istanbul` | 6.1.1 | BSD-3-Clause | mobile | lockfile + package.json |
| `babel-plugin-jest-hoist` | 29.6.3 | MIT | mobile | lockfile + package.json |
| `babel-plugin-polyfill-corejs2` | 0.4.17 | MIT | mobile | lockfile + package.json |
| `babel-plugin-polyfill-corejs3` | 0.13.0 | MIT | mobile | lockfile + package.json |
| `babel-plugin-polyfill-regenerator` | 0.6.8 | MIT | mobile | lockfile + package.json |
| `babel-plugin-react-compiler` | 1.0.0 | MIT | mobile | lockfile + package.json |
| `babel-plugin-react-native-web` | 0.21.3 | MIT | mobile | lockfile + package.json |
| `babel-plugin-syntax-hermes-parser` | 0.36.0 | MIT | mobile | lockfile + package.json |
| `babel-plugin-syntax-hermes-parser` | 0.36.1 | MIT | mobile | lockfile + package.json |
| `babel-plugin-transform-flow-enums` | 0.0.2 | MIT | mobile | lockfile + package.json |
| `babel-preset-current-node-syntax` | 1.2.0 | MIT | mobile | lockfile + package.json |
| `babel-preset-expo` | 57.0.13 | MIT | mobile | lockfile + package.json |
| `babel-preset-jest` | 29.6.3 | MIT | mobile | lockfile + package.json |
| `bail` | 2.0.2 | MIT | core-web | lockfile + package.json |
| `balanced-match` | 1.0.2 | MIT | mobile | lockfile + package.json |
| `balanced-match` | 4.0.4 | MIT | mobile | lockfile + package.json |
| `base64-js` | 1.5.1 | MIT | mobile | lockfile + package.json |
| `baseline-browser-mapping` | 2.11.26 | Apache-2.0 | mobile | lockfile + package.json |
| `big-integer` | 1.6.52 | Unlicense | mobile | lockfile + package.json |
| `boolbase` | 1.0.0 | ISC | mobile | lockfile + package.json |
| `bplist-creator` | 0.1.0 | MIT | mobile | lockfile + package.json |
| `bplist-parser` | 0.3.1 | MIT | mobile | lockfile + package.json |
| `bplist-parser` | 0.3.2 | MIT | mobile | lockfile + package.json |
| `brace-expansion` | 1.1.21 | MIT | mobile | lockfile + package.json |
| `brace-expansion` | 5.0.12 | MIT | mobile | lockfile + package.json |
| `braces` | 3.0.3 | MIT | mobile | lockfile + package.json |
| `browserslist` | 4.29.3 | MIT | mobile | lockfile + package.json |
| `bser` | 2.1.1 | Apache-2.0 | mobile | lockfile + package.json |
| `buffer-crc32` | 1.0.0 | MIT | core-server | lockfile + package.json |
| `buffer-from` | 1.1.2 | MIT | mobile | lockfile + package.json |
| `bytes` | 3.1.2 | MIT | mobile | lockfile + package.json |
| `callsites` | 3.1.0 | MIT | mobile | lockfile + package.json |
| `camelcase` | 5.3.1 | MIT | mobile | lockfile + package.json |
| `camelcase` | 6.3.0 | MIT | mobile | lockfile + package.json |
| `caniuse-lite` | 1.0.30001814 | CC-BY-4.0 | mobile | lockfile + package.json |
| `canvaskit-wasm` | 0.41.0 | BSD-3-Clause | mobile | lockfile + package.json |
| `ccount` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `chalk` | 2.4.2 | MIT | mobile | lockfile + package.json |
| `chalk` | 4.1.2 | MIT | mobile | lockfile + package.json |
| `chalk` | 5.6.2 | MIT | core-web | lockfile + package.json |
| `char-regex` | 1.0.2 | MIT | mobile | lockfile + package.json |
| `character-entities` | 2.0.2 | MIT | core-web | lockfile + package.json |
| `character-entities-html4` | 2.1.0 | MIT | core-web | lockfile + package.json |
| `character-entities-legacy` | 3.0.0 | MIT | core-web | lockfile + package.json |
| `chrome-launcher` | 0.15.2 | Apache-2.0 | mobile | lockfile + package.json |
| `chromium-edge-launcher` | 0.3.0 | Apache-2.0 | mobile | lockfile + package.json |
| `ci-info` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `ci-info` | 3.9.0 | MIT | mobile | lockfile + package.json |
| `cjs-module-lexer` | 1.4.3 | MIT | mobile | lockfile + package.json |
| `cli-cursor` | 2.1.0 | MIT | mobile | lockfile + package.json |
| `cli-spinners` | 2.9.2 | MIT | mobile | lockfile + package.json |
| `client-only` | 0.0.1 | MIT | core-web, mobile | lockfile + package.json |
| `cliui` | 8.0.1 | ISC | mobile | lockfile + package.json |
| `clone` | 1.0.4 | MIT | mobile | lockfile + package.json |
| `clsx` | 2.1.1 | MIT | core-web | lockfile + package.json |
| `co` | 4.6.0 | MIT | mobile | lockfile + package.json |
| `collect-v8-coverage` | 1.0.3 | MIT | mobile | lockfile + package.json |
| `color` | 4.2.3 | MIT | mobile | lockfile + package.json |
| `color-convert` | 1.9.3 | MIT | mobile | lockfile + package.json |
| `color-convert` | 2.0.1 | MIT | mobile | lockfile + package.json |
| `color-name` | 1.1.3 | MIT | mobile | lockfile + package.json |
| `color-name` | 1.1.4 | MIT | mobile | lockfile + package.json |
| `color-string` | 1.9.1 | MIT | mobile | lockfile + package.json |
| `comma-separated-tokens` | 2.0.3 | MIT | core-web | lockfile + package.json |
| `commander` | 12.1.0 | MIT | mobile | lockfile + package.json |
| `commander` | 2.20.3 | MIT | mobile | lockfile + package.json |
| `commander` | 7.2.0 | MIT | mobile | lockfile + package.json |
| `compressible` | 2.0.18 | MIT | mobile | lockfile + package.json |
| `compression` | 1.8.2 | MIT | mobile | lockfile + package.json |
| `concat-map` | 0.0.1 | MIT | mobile | lockfile + package.json |
| `connect` | 3.7.0 | MIT | mobile | lockfile + package.json |
| `content-type` | 2.1.0 | MIT | mobile | lockfile + package.json |
| `convert-source-map` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `cookie` | 1.1.1 | MIT | core-server, mock-core | lockfile + package.json |
| `cookie` | 2.0.1 | MIT | core-server | lockfile + package.json |
| `cookie-es` | 3.1.1 | MIT | core-web | lockfile + package.json |
| `core-js-compat` | 3.50.0 | MIT | mobile | lockfile + package.json |
| `create-jest` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `crelt` | 1.0.7 | MIT | core-web | lockfile + package.json |
| `cross-fetch` | 3.2.0 | MIT | mobile | lockfile + package.json |
| `cross-spawn` | 7.0.6 | MIT | mobile | lockfile + package.json |
| `css-in-js-utils` | 3.1.0 | MIT | mobile | lockfile + package.json |
| `css-select` | 5.2.2 | BSD-2-Clause | mobile | lockfile + package.json |
| `css-tree` | 1.1.3 | MIT | mobile | lockfile + package.json |
| `css-what` | 6.2.2 | BSD-2-Clause | mobile | lockfile + package.json |
| `csstype` | 3.2.3 | MIT | core-server, core-web, mobile, mock-core, transcriber | lockfile + package.json |
| `culori` | 4.0.2 | MIT | mobile | lockfile + package.json |
| `cva` | 1.0.0-beta.4 | Apache-2.0 | core-web | lockfile + package.json |
| `d3-array` | 3.2.4 | ISC | core-web, mobile | lockfile + package.json |
| `d3-color` | 3.1.0 | ISC | core-web, mobile | lockfile + package.json |
| `d3-dispatch` | 3.0.1 | ISC | mobile | lockfile + package.json |
| `d3-drag` | 3.0.0 | ISC | mobile | lockfile + package.json |
| `d3-ease` | 3.0.1 | BSD-3-Clause | core-web, mobile | lockfile + package.json |
| `d3-format` | 3.1.2 | ISC | core-web, mobile | lockfile + package.json |
| `d3-interpolate` | 3.0.1 | ISC | core-web, mobile | lockfile + package.json |
| `d3-path` | 3.1.0 | ISC | core-web, mobile | lockfile + package.json |
| `d3-scale` | 4.0.2 | ISC | core-web, mobile | lockfile + package.json |
| `d3-selection` | 3.0.0 | ISC | mobile | lockfile + package.json |
| `d3-shape` | 3.2.0 | ISC | core-web, mobile | lockfile + package.json |
| `d3-time` | 3.1.0 | ISC | core-web, mobile | lockfile + package.json |
| `d3-time-format` | 4.1.0 | ISC | core-web, mobile | lockfile + package.json |
| `d3-timer` | 3.0.1 | ISC | core-web, mobile | lockfile + package.json |
| `d3-transition` | 3.0.1 | ISC | mobile | lockfile + package.json |
| `d3-zoom` | 3.0.0 | ISC | mobile | lockfile + package.json |
| `debug` | 2.6.9 | MIT | mobile | lockfile + package.json |
| `debug` | 3.2.7 | MIT | mobile | lockfile + package.json |
| `debug` | 4.4.3 | MIT | core-server, core-web, mobile | lockfile + package.json |
| `decimal.js-light` | 2.5.1 | MIT | core-web | lockfile + package.json |
| `decode-named-character-reference` | 1.3.0 | MIT | core-web | lockfile + package.json |
| `decode-uri-component` | 0.2.2 | MIT | mobile | lockfile + package.json |
| `dedent` | 1.7.2 | MIT | mobile | lockfile + package.json |
| `deepmerge` | 4.3.1 | MIT | mobile | lockfile + package.json |
| `defaults` | 1.0.4 | MIT | mobile | lockfile + package.json |
| `defu` | 6.1.7 | MIT | core-web | lockfile + package.json |
| `depd` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `dequal` | 2.0.3 | MIT | core-server, core-web, mock-core | lockfile + package.json |
| `destroy` | 1.2.0 | MIT | mobile | lockfile + package.json |
| `detect-libc` | 2.1.2 | Apache-2.0 | mobile | lockfile + package.json |
| `detect-newline` | 3.1.0 | MIT | mobile | lockfile + package.json |
| `detect-node-es` | 1.1.0 | MIT | mobile | lockfile + package.json |
| `devlop` | 1.1.0 | MIT | core-web | lockfile + package.json |
| `diff-sequences` | 29.6.3 | MIT | mobile | lockfile + package.json |
| `dnssd-advertise` | 1.1.6 | MIT | mobile | lockfile + package.json |
| `dom-helpers` | 5.2.1 | MIT | core-web | lockfile + package.json |
| `dom-serializer` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `domelementtype` | 2.3.0 | BSD-2-Clause | mobile | lockfile + package.json |
| `domhandler` | 5.0.3 | BSD-2-Clause | mobile | lockfile + package.json |
| `domutils` | 3.2.2 | BSD-2-Clause | mobile | lockfile + package.json |
| `drizzle-orm` | 0.45.3 | Apache-2.0 | core-server | lockfile + package.json |
| `duplexify` | 4.1.3 | MIT | core-server, mock-core | lockfile + package.json |
| `ee-first` | 1.1.1 | MIT | mobile | lockfile + package.json |
| `electron-to-chromium` | 1.5.443 | ISC | mobile | lockfile + package.json |
| `emittery` | 0.13.1 | MIT | mobile | lockfile + package.json |
| `emoji-regex` | 8.0.0 | MIT | mobile | lockfile + package.json |
| `encodeurl` | 1.0.2 | MIT | mobile | lockfile + package.json |
| `encodeurl` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `end-of-stream` | 1.4.5 | MIT | core-server, mock-core | lockfile + package.json |
| `enhanced-resolve` | 5.26.0 | MIT | mobile | lockfile + package.json |
| `entities` | 4.5.0 | BSD-2-Clause | mobile | lockfile + package.json |
| `entities` | 6.0.1 | BSD-2-Clause | core-web | lockfile + package.json |
| `entities` | 7.0.1 | BSD-2-Clause | core-web | lockfile + package.json |
| `error-ex` | 1.3.4 | MIT | mobile | lockfile + package.json |
| `error-stack-parser` | 2.1.4 | MIT | mobile | lockfile + package.json |
| `es-errors` | 1.3.0 | MIT | mobile | lockfile + package.json |
| `es-toolkit` | 1.52.0 | MIT | core-web | lockfile + package.json |
| `esbuild` | 0.28.2 | MIT | core-server, mock-core | lockfile + package.json |
| `escalade` | 3.2.0 | MIT | mobile | lockfile + package.json |
| `escape-html` | 1.0.3 | MIT | mobile | lockfile + package.json |
| `escape-string-regexp` | 1.0.5 | MIT | mobile | lockfile + package.json |
| `escape-string-regexp` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `escape-string-regexp` | 4.0.0 | MIT | mobile | lockfile + package.json |
| `escape-string-regexp` | 5.0.0 | MIT | core-web | lockfile + package.json |
| `esprima` | 4.0.1 | BSD-2-Clause | mobile | lockfile + package.json |
| `estree-walker` | 2.0.2 | MIT | core-web | lockfile + package.json |
| `etag` | 1.8.1 | MIT | mobile | lockfile + package.json |
| `event-target-shim` | 5.0.1 | MIT | mobile | lockfile + package.json |
| `eventemitter3` | 5.0.4 | MIT | core-web | lockfile + package.json |
| `eventsource-parser` | 3.1.1 | MIT | core-web | lockfile + package.json |
| `execa` | 5.1.1 | MIT | mobile | lockfile + package.json |
| `exit` | 0.1.2 | MIT | mobile | package.json only |
| `expect` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `expo` | 57.0.26 | MIT | mobile | lockfile + package.json |
| `expo-asset` | 57.0.18 | MIT | mobile | lockfile + package.json |
| `expo-blur` | 57.0.3 | MIT | mobile | lockfile + package.json |
| `expo-constants` | 57.0.20 | MIT | mobile | lockfile + package.json |
| `expo-device` | 57.0.2 | MIT | mobile | lockfile + package.json |
| `expo-file-system` | 57.0.7 | MIT | mobile | lockfile + package.json |
| `expo-font` | 57.0.4 | MIT | mobile | lockfile + package.json |
| `expo-glass-effect` | 57.0.4 | MIT | mobile | lockfile + package.json |
| `expo-haptics` | 57.0.3 | MIT | mobile | lockfile + package.json |
| `expo-image` | 57.0.5 | MIT | mobile | lockfile + package.json |
| `expo-keep-awake` | 57.0.2 | MIT | mobile | lockfile + package.json |
| `expo-linear-gradient` | 57.0.2 | MIT | mobile | lockfile + package.json |
| `expo-linking` | 57.0.11 | MIT | mobile | lockfile + package.json |
| `expo-local-authentication` | 57.0.3 | MIT | mobile | lockfile + package.json |
| `expo-modules-autolinking` | 57.0.13 | MIT | mobile | lockfile + package.json |
| `expo-modules-core` | 57.0.20 | MIT | mobile | lockfile + package.json |
| `expo-modules-jsi` | 57.1.1 | MIT | mobile | lockfile + package.json |
| `expo-router` | 57.0.24 | MIT | mobile | lockfile + package.json |
| `expo-secure-store` | 57.0.4 | MIT | mobile | lockfile + package.json |
| `expo-server` | 57.0.3 | MIT | mobile | lockfile + package.json |
| `expo-splash-screen` | 57.0.9 | MIT | mobile | lockfile + package.json |
| `expo-status-bar` | 57.0.1 | MIT | mobile | lockfile + package.json |
| `expo-symbols` | 57.0.3 | MIT | mobile | lockfile + package.json |
| `expo-system-ui` | 57.0.4 | MIT | mobile | lockfile + package.json |
| `expo-video` | 57.0.5 | MIT | mobile | lockfile + package.json |
| `expo-web-browser` | 57.0.3 | MIT | mobile | lockfile + package.json |
| `exponential-backoff` | 3.1.3 | Apache-2.0 | mobile | lockfile + package.json |
| `extend` | 3.0.2 | MIT | core-web | lockfile + package.json |
| `fast-decode-uri-component` | 1.0.1 | MIT | core-server, mock-core | lockfile + package.json |
| `fast-deep-equal` | 3.1.3 | MIT | core-server, core-web, mobile, mock-core | lockfile + package.json |
| `fast-json-stable-stringify` | 2.1.0 | MIT | mobile | lockfile + package.json |
| `fast-json-stringify` | 7.0.1 | MIT | core-server, mock-core | lockfile + package.json |
| `fast-querystring` | 1.1.2 | MIT | core-server, mock-core | lockfile + package.json |
| `fast-uri` | 3.1.8 | BSD-3-Clause | core-server, core-web, mobile, mock-core | lockfile + package.json |
| `fast-uri` | 4.2.1 | BSD-3-Clause | core-server, mock-core | lockfile + package.json |
| `fastify` | 5.12.5 | MIT | core-server, mock-core | lockfile + package.json |
| `fastify-plugin` | 6.0.0 | MIT | core-server, mock-core | lockfile + package.json |
| `fastify-type-provider-zod` | 7.0.0 | MIT | core-server | lockfile + package.json |
| `fastq` | 1.20.3 | ISC | core-server, mock-core | lockfile + package.json |
| `fb-dotslash` | 0.5.8 | (MIT OR Apache-2.0) | mobile | lockfile + package.json |
| `fb-watchman` | 2.0.2 | Apache-2.0 | mobile | lockfile + package.json |
| `fbjs` | 3.0.5 | MIT | mobile | lockfile + package.json |
| `fbjs-css-vars` | 1.0.2 | MIT | mobile | lockfile + package.json |
| `fdir` | 6.5.0 | MIT | mobile | lockfile + package.json |
| `fetch-nodeshim` | 0.4.10 | MIT | mobile | lockfile + package.json |
| `fill-range` | 7.1.1 | MIT | mobile | lockfile + package.json |
| `filter-obj` | 1.1.0 | MIT | mobile | lockfile + package.json |
| `finalhandler` | 1.1.2 | MIT | mobile | lockfile + package.json |
| `find-my-way` | 9.9.0 | MIT | core-server, mock-core | lockfile + package.json |
| `find-up` | 4.1.0 | MIT | mobile | lockfile + package.json |
| `flatted` | 3.4.4 | ISC | core-web | lockfile + package.json |
| `flow-enums-runtime` | 0.0.6 | MIT | mobile | lockfile + package.json |
| `focus-trap` | 7.8.0 | MIT | core-web | lockfile + package.json |
| `fontfaceobserver` | 2.3.0 | BSD-2-Clause | mobile | lockfile + package.json |
| `framer-motion` | 13.4.6 | MIT | core-web | lockfile + package.json |
| `fresh` | 0.5.2 | MIT | mobile | lockfile + package.json |
| `fs.realpath` | 1.0.0 | ISC | mobile | lockfile + package.json |
| `fsevents` | 2.3.3 | MIT | core-server, mobile, mock-core | lockfile + package.json |
| `function-bind` | 1.1.2 | MIT | mobile | lockfile + package.json |
| `fuse.js` | 7.5.0 | Apache-2.0 | core-web | lockfile + package.json |
| `gensync` | 1.0.0-beta.2 | MIT | mobile | lockfile + package.json |
| `get-caller-file` | 2.0.5 | ISC | mobile | lockfile + package.json |
| `get-nonce` | 1.0.1 | MIT | mobile | lockfile + package.json |
| `get-package-type` | 0.1.0 | MIT | mobile | lockfile + package.json |
| `get-stream` | 6.0.1 | MIT | mobile | lockfile + package.json |
| `getenv` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `glob` | 13.0.6 | BlueOak-1.0.0 | mobile | lockfile + package.json |
| `glob` | 7.2.3 | ISC | mobile | lockfile + package.json |
| `graceful-fs` | 4.2.11 | ISC | mobile | lockfile + package.json |
| `guess-json-indent` | 3.0.1 | MIT | core-web | lockfile + package.json |
| `has-flag` | 3.0.0 | MIT | mobile | lockfile + package.json |
| `has-flag` | 4.0.0 | MIT | mobile | lockfile + package.json |
| `hasown` | 2.0.4 | MIT | mobile | lockfile + package.json |
| `hast-util-embedded` | 3.0.0 | MIT | core-web | lockfile + package.json |
| `hast-util-format` | 1.1.0 | MIT | core-web | lockfile + package.json |
| `hast-util-from-html` | 2.0.3 | MIT | core-web | lockfile + package.json |
| `hast-util-from-parse5` | 8.0.3 | MIT | core-web | lockfile + package.json |
| `hast-util-has-property` | 3.0.0 | MIT | core-web | lockfile + package.json |
| `hast-util-is-body-ok-link` | 3.0.1 | MIT | core-web | lockfile + package.json |
| `hast-util-is-element` | 3.0.0 | MIT | core-web | lockfile + package.json |
| `hast-util-minify-whitespace` | 1.0.1 | MIT | core-web | lockfile + package.json |
| `hast-util-parse-selector` | 4.0.0 | MIT | core-web | lockfile + package.json |
| `hast-util-phrasing` | 3.0.1 | MIT | core-web | lockfile + package.json |
| `hast-util-raw` | 9.1.0 | MIT | core-web | lockfile + package.json |
| `hast-util-sanitize` | 5.0.2 | MIT | core-web | lockfile + package.json |
| `hast-util-to-html` | 9.0.5 | MIT | core-web | lockfile + package.json |
| `hast-util-to-mdast` | 10.1.2 | MIT | core-web | lockfile + package.json |
| `hast-util-to-parse5` | 8.0.1 | MIT | core-web | lockfile + package.json |
| `hast-util-to-text` | 4.0.2 | MIT | core-web | lockfile + package.json |
| `hast-util-whitespace` | 3.0.0 | MIT | core-web | lockfile + package.json |
| `hastscript` | 9.0.1 | MIT | core-web | lockfile + package.json |
| `helmet` | 8.3.0 | MIT | core-server | lockfile + package.json |
| `hermes-compiler` | 250829098.0.17 | MIT | mobile | lockfile + package.json |
| `hermes-estree` | 0.35.0 | MIT | mobile | lockfile + package.json |
| `hermes-estree` | 0.36.0 | MIT | mobile | lockfile + package.json |
| `hermes-estree` | 0.36.1 | MIT | mobile | lockfile + package.json |
| `hermes-parser` | 0.35.0 | MIT | mobile | lockfile + package.json |
| `hermes-parser` | 0.36.0 | MIT | mobile | lockfile + package.json |
| `hermes-parser` | 0.36.1 | MIT | mobile | lockfile + package.json |
| `heroui-native` | 1.0.10 | Apache-2.0 | mobile | lockfile + package.json |
| `highlight.js` | 11.11.2 | BSD-3-Clause | core-web | lockfile + package.json |
| `highlight.js` | 11.12.0 | BSD-3-Clause | core-web | lockfile + package.json |
| `hoist-non-react-statics` | 3.3.2 | BSD-3-Clause | mobile | lockfile + package.json |
| `hookable` | 6.1.2 | MIT | core-web | lockfile + package.json |
| `hosted-git-info` | 7.0.2 | ISC | mobile | lockfile + package.json |
| `html-escaper` | 2.0.2 | MIT | mobile | lockfile + package.json |
| `html-parse-stringify` | 4.0.1 | MIT | core-web, mobile | lockfile + package.json |
| `html-void-elements` | 3.0.0 | MIT | core-web | lockfile + package.json |
| `html-whitespace-sensitive-tag-names` | 3.0.1 | MIT | core-web | lockfile + package.json |
| `http-errors` | 2.0.1 | MIT | mobile | lockfile + package.json |
| `https-proxy-agent` | 7.0.6 | MIT | mobile | lockfile + package.json |
| `human-signals` | 2.1.0 | Apache-2.0 | mobile | lockfile + package.json |
| `hyphenate-style-name` | 1.1.0 | BSD-3-Clause | mobile | lockfile + package.json |
| `i18next` | 26.4.2 | MIT | core-web, mobile | lockfile + package.json |
| `ignore` | 5.3.2 | MIT | mobile | lockfile + package.json |
| `immer` | 11.1.18 | MIT | core-server, core-web, mobile, mock-core, transcriber | lockfile + package.json |
| `import-local` | 3.2.0 | MIT | mobile | lockfile + package.json |
| `imurmurhash` | 0.1.4 | MIT | mobile | lockfile + package.json |
| `indent-string` | 4.0.0 | MIT | mobile | lockfile + package.json |
| `inflight` | 1.0.6 | ISC | mobile | lockfile + package.json |
| `inherits` | 2.0.4 | ISC | core-server, mobile, mock-core | lockfile + package.json |
| `inline-style-prefixer` | 7.0.1 | MIT | mobile | lockfile + package.json |
| `input-otp` | 1.5.0 | MIT | core-web | lockfile + package.json |
| `internmap` | 2.0.3 | ISC | core-web, mobile | lockfile + package.json |
| `invariant` | 2.2.4 | MIT | mobile | lockfile + package.json |
| `ip-address` | 10.7.3 | MIT | core-server | lockfile + package.json |
| `ipaddr.js` | 2.5.0 | MIT | core-server, mock-core | lockfile + package.json |
| `is-absolute-url` | 4.0.1 | MIT | core-web | lockfile + package.json |
| `is-arrayish` | 0.2.1 | MIT | mobile | lockfile + package.json |
| `is-arrayish` | 0.3.4 | MIT | mobile | lockfile + package.json |
| `is-core-module` | 2.17.0 | MIT | mobile | lockfile + package.json |
| `is-docker` | 2.2.1 | MIT | mobile | lockfile + package.json |
| `is-fullwidth-code-point` | 3.0.0 | MIT | mobile | lockfile + package.json |
| `is-generator-fn` | 2.1.0 | MIT | mobile | lockfile + package.json |
| `is-number` | 7.0.0 | MIT | mobile | lockfile + package.json |
| `is-plain-obj` | 2.1.0 | MIT | mobile | lockfile + package.json |
| `is-plain-obj` | 4.1.0 | MIT | core-web | lockfile + package.json |
| `is-stream` | 2.0.1 | MIT | mobile | lockfile + package.json |
| `is-wsl` | 2.2.0 | MIT | mobile | lockfile + package.json |
| `isbot` | 5.2.2 | Unlicense | core-web | lockfile + package.json |
| `isexe` | 2.0.0 | ISC | mobile | lockfile + package.json |
| `istanbul-lib-coverage` | 3.2.2 | BSD-3-Clause | mobile | lockfile + package.json |
| `istanbul-lib-instrument` | 5.2.1 | BSD-3-Clause | mobile | lockfile + package.json |
| `istanbul-lib-instrument` | 6.0.3 | BSD-3-Clause | mobile | lockfile + package.json |
| `istanbul-lib-report` | 3.0.1 | BSD-3-Clause | mobile | lockfile + package.json |
| `istanbul-lib-source-maps` | 4.0.1 | BSD-3-Clause | mobile | lockfile + package.json |
| `istanbul-reports` | 3.2.0 | BSD-3-Clause | mobile | lockfile + package.json |
| `its-fine` | 1.2.5 | MIT | mobile | lockfile + package.json |
| `jest` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-changed-files` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-circus` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-cli` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-config` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-diff` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-diff` | 30.5.2 | MIT | mobile | lockfile + package.json |
| `jest-docblock` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-each` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-environment-node` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-get-type` | 29.6.3 | MIT | mobile | lockfile + package.json |
| `jest-haste-map` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-leak-detector` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-matcher-utils` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-matcher-utils` | 30.5.2 | MIT | mobile | lockfile + package.json |
| `jest-message-util` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-mock` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-pnp-resolver` | 1.2.3 | MIT | mobile | lockfile + package.json |
| `jest-regex-util` | 29.6.3 | MIT | mobile | lockfile + package.json |
| `jest-resolve` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-resolve-dependencies` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-runner` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-runtime` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-snapshot` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-util` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-validate` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-watcher` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jest-worker` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `jimp-compact` | 0.16.1 | MIT | mobile | lockfile + package.json |
| `jiti` | 2.7.0 | MIT | mobile | lockfile + package.json |
| `js-base64` | 3.9.4 | BSD-3-Clause | core-web | lockfile + package.json |
| `js-tokens` | 4.0.0 | MIT | core-web, mobile | lockfile + package.json |
| `js-yaml` | 3.15.2 | MIT | mobile | lockfile + package.json |
| `js-yaml` | 4.3.2 | MIT | mobile | lockfile + package.json |
| `jsc-safe-url` | 0.2.4 | 0BSD | mobile | lockfile + package.json |
| `jsesc` | 3.1.0 | MIT | mobile | lockfile + package.json |
| `json-parse-even-better-errors` | 2.3.1 | MIT | mobile | lockfile + package.json |
| `json-schema` | 0.4.0 | (AFL-2.1 OR BSD-3-Clause) | core-web | lockfile + package.json |
| `json-schema-ref-resolver` | 3.0.0 | MIT | core-server, mock-core | lockfile + package.json |
| `json-schema-resolver` | 3.0.0 | MIT | core-server | lockfile + package.json |
| `json-schema-traverse` | 1.0.0 | MIT | core-server, core-web, mobile, mock-core | lockfile + package.json |
| `json5` | 2.2.3 | MIT | mobile | lockfile + package.json |
| `jsonc-parser` | 3.3.1 | MIT | core-web | lockfile + package.json |
| `kleur` | 3.0.3 | MIT | mobile | lockfile + package.json |
| `lan-network` | 0.2.1 | MIT | mobile | lockfile + package.json |
| `leven` | 3.1.0 | MIT | mobile | lockfile + package.json |
| `light-my-request` | 6.6.0 | BSD-3-Clause | core-server, mock-core | lockfile + package.json |
| `lighthouse-logger` | 1.4.2 | Apache-2.0 | mobile | lockfile + package.json |
| `lightningcss` | 1.30.1 | MPL-2.0 | mobile | lockfile + package.json |
| `lightningcss` | 1.32.0 | MPL-2.0 | mobile | lockfile + package.json |
| `lightningcss` | 1.33.0 | MPL-2.0 | mobile | lockfile + package.json |
| `lightningcss-android-arm64` | 1.32.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-android-arm64` | 1.33.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-darwin-arm64` | 1.30.1 | MPL-2.0 | mobile | lockfile + package.json |
| `lightningcss-darwin-arm64` | 1.32.0 | MPL-2.0 | mobile | lockfile + package.json |
| `lightningcss-darwin-arm64` | 1.33.0 | MPL-2.0 | mobile | lockfile + package.json |
| `lightningcss-darwin-x64` | 1.30.1 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-darwin-x64` | 1.32.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-darwin-x64` | 1.33.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-freebsd-x64` | 1.30.1 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-freebsd-x64` | 1.32.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-freebsd-x64` | 1.33.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-arm-gnueabihf` | 1.30.1 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-arm-gnueabihf` | 1.32.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-arm-gnueabihf` | 1.33.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-arm64-gnu` | 1.30.1 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-arm64-gnu` | 1.32.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-arm64-gnu` | 1.33.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-arm64-musl` | 1.30.1 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-arm64-musl` | 1.32.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-arm64-musl` | 1.33.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-x64-gnu` | 1.30.1 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-x64-gnu` | 1.32.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-x64-gnu` | 1.33.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-x64-musl` | 1.30.1 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-x64-musl` | 1.32.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-linux-x64-musl` | 1.33.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-win32-arm64-msvc` | 1.30.1 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-win32-arm64-msvc` | 1.32.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-win32-arm64-msvc` | 1.33.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-win32-x64-msvc` | 1.30.1 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-win32-x64-msvc` | 1.32.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lightningcss-win32-x64-msvc` | 1.33.0 | MPL-2.0 | mobile | lockfile only; not installed on this host |
| `lines-and-columns` | 1.2.4 | MIT | mobile | lockfile + package.json |
| `locate-path` | 5.0.0 | MIT | mobile | lockfile + package.json |
| `lodash.debounce` | 4.0.8 | MIT | mobile | lockfile + package.json |
| `lodash.throttle` | 4.1.1 | MIT | mobile | lockfile + package.json |
| `log-symbols` | 2.2.0 | MIT | mobile | lockfile + package.json |
| `longest-streak` | 3.1.0 | MIT | core-web | lockfile + package.json |
| `loose-envify` | 1.4.0 | MIT | core-web, mobile | lockfile + package.json |
| `lowlight` | 3.3.0 | MIT | core-web | lockfile + package.json |
| `lru-cache` | 10.4.3 | ISC | mobile | lockfile + package.json |
| `lru-cache` | 11.5.3 | BlueOak-1.0.0 | mobile | lockfile + package.json |
| `lru-cache` | 5.1.1 | ISC | mobile | lockfile + package.json |
| `lucide-react` | 1.49.0 | ISC | core-web | lockfile + package.json |
| `lucide-react-native` | 1.49.0 | ISC | mobile | lockfile + package.json |
| `magic-string` | 0.30.21 | MIT | core-web, mobile | lockfile + package.json |
| `make-dir` | 4.0.0 | MIT | mobile | lockfile + package.json |
| `makeerror` | 1.0.12 | BSD-3-Clause | mobile | lockfile + package.json |
| `markdown-table` | 3.0.4 | MIT | core-web | lockfile + package.json |
| `marky` | 1.3.0 | Apache-2.0 | mobile | lockfile + package.json |
| `mdast-util-find-and-replace` | 3.0.2 | MIT | core-web | lockfile + package.json |
| `mdast-util-from-markdown` | 2.0.3 | MIT | core-web | lockfile + package.json |
| `mdast-util-gfm` | 3.1.0 | MIT | core-web | lockfile + package.json |
| `mdast-util-gfm-autolink-literal` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `mdast-util-gfm-footnote` | 2.1.0 | MIT | core-web | lockfile + package.json |
| `mdast-util-gfm-strikethrough` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `mdast-util-gfm-table` | 2.0.0 | MIT | core-web | lockfile + package.json |
| `mdast-util-gfm-task-list-item` | 2.0.0 | MIT | core-web | lockfile + package.json |
| `mdast-util-phrasing` | 4.1.0 | MIT | core-web | lockfile + package.json |
| `mdast-util-to-hast` | 13.2.1 | MIT | core-web | lockfile + package.json |
| `mdast-util-to-markdown` | 2.1.3 | MIT | core-web | lockfile + package.json |
| `mdast-util-to-string` | 4.0.0 | MIT | core-web | lockfile + package.json |
| `mdn-data` | 2.0.14 | CC0-1.0 | mobile | lockfile + package.json |
| `memoize-one` | 5.2.1 | MIT | mobile | lockfile + package.json |
| `memoize-one` | 6.0.0 | MIT | mobile | lockfile + package.json |
| `merge-options` | 3.0.4 | MIT | mobile | lockfile + package.json |
| `merge-stream` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `metro` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-babel-transformer` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-babel-transformer` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-cache` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-cache` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-cache-key` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-cache-key` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-config` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-config` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-core` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-core` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-file-map` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-file-map` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-minify-terser` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-minify-terser` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-resolver` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-resolver` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-runtime` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-runtime` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-source-map` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-source-map` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-symbolicate` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-symbolicate` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-transform-plugins` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-transform-plugins` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `metro-transform-worker` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `metro-transform-worker` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `microdiff` | 1.6.0 | MIT | core-web | lockfile + package.json |
| `micromark` | 4.0.3 | MIT | core-web | lockfile + package.json |
| `micromark-core-commonmark` | 2.0.4 | MIT | core-web | lockfile + package.json |
| `micromark-extension-gfm` | 3.0.0 | MIT | core-web | lockfile + package.json |
| `micromark-extension-gfm-autolink-literal` | 2.1.0 | MIT | core-web | lockfile + package.json |
| `micromark-extension-gfm-footnote` | 2.1.0 | MIT | core-web | lockfile + package.json |
| `micromark-extension-gfm-strikethrough` | 2.1.0 | MIT | core-web | lockfile + package.json |
| `micromark-extension-gfm-table` | 2.1.2 | MIT | core-web | lockfile + package.json |
| `micromark-extension-gfm-tagfilter` | 2.0.0 | MIT | core-web | lockfile + package.json |
| `micromark-extension-gfm-task-list-item` | 2.1.0 | MIT | core-web | lockfile + package.json |
| `micromark-factory-destination` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-factory-label` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-factory-space` | 2.1.0 | MIT | core-web | lockfile + package.json |
| `micromark-factory-title` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-factory-whitespace` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-character` | 2.1.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-chunked` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-classify-character` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-combine-extensions` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-decode-numeric-character-reference` | 2.0.2 | MIT | core-web | lockfile + package.json |
| `micromark-util-decode-string` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-edit-map` | 1.0.0 | MIT | core-web | lockfile + package.json |
| `micromark-util-encode` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-html-tag-name` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-normalize-identifier` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-resolve-all` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-sanitize-uri` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-subtokenize` | 2.1.0 | MIT | core-web | lockfile + package.json |
| `micromark-util-symbol` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `micromark-util-types` | 2.0.3 | MIT | core-web | lockfile + package.json |
| `micromatch` | 4.0.8 | MIT | mobile | lockfile + package.json |
| `mime` | 1.6.0 | MIT | mobile | lockfile + package.json |
| `mime-db` | 1.52.0 | MIT | mobile | lockfile + package.json |
| `mime-db` | 1.54.0 | MIT | mobile | lockfile + package.json |
| `mime-types` | 2.1.35 | MIT | mobile | lockfile + package.json |
| `mime-types` | 3.0.2 | MIT | mobile | lockfile + package.json |
| `mimic-fn` | 1.2.0 | MIT | mobile | lockfile + package.json |
| `mimic-fn` | 2.1.0 | MIT | mobile | lockfile + package.json |
| `min-indent` | 1.0.1 | MIT | mobile | lockfile + package.json |
| `minimatch` | 10.2.6 | BlueOak-1.0.0 | mobile | lockfile + package.json |
| `minimatch` | 3.1.5 | ISC | mobile | lockfile + package.json |
| `minipass` | 7.1.3 | BlueOak-1.0.0 | mobile | lockfile + package.json |
| `mkdirp` | 1.0.4 | MIT | mobile | lockfile + package.json |
| `motion` | 13.4.6 | MIT | core-web | lockfile + package.json |
| `motion-dom` | 13.4.5 | MIT | core-web | lockfile + package.json |
| `motion-utils` | 13.3.0 | MIT | core-web | lockfile + package.json |
| `ms` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `ms` | 2.1.3 | MIT | core-server, core-web, mobile | lockfile + package.json |
| `multitars` | 1.0.2 | MIT | mobile | lockfile + package.json |
| `nanoid` | 3.3.19 | MIT | core-web, mobile | lockfile + package.json |
| `nanoid` | 5.1.16 | MIT | core-web | lockfile + package.json |
| `natural-compare` | 1.4.0 | MIT | mobile | lockfile + package.json |
| `negotiator` | 0.6.3 | MIT | mobile | lockfile + package.json |
| `negotiator` | 0.6.4 | MIT | mobile | lockfile + package.json |
| `negotiator` | 1.1.0 | MIT | mobile | lockfile + package.json |
| `neverpanic` | 0.0.8 | MIT | core-web | lockfile + package.json |
| `node-fetch` | 2.7.0 | MIT | mobile | lockfile + package.json |
| `node-forge` | 1.4.0 | (BSD-3-Clause OR GPL-2.0) | mobile | lockfile + package.json |
| `node-int64` | 0.4.0 | MIT | mobile | lockfile + package.json |
| `node-releases` | 2.0.57 | MIT | mobile | lockfile + package.json |
| `normalize-path` | 3.0.0 | MIT | mobile | lockfile + package.json |
| `npm-package-arg` | 11.0.3 | ISC | mobile | lockfile + package.json |
| `npm-run-path` | 4.0.1 | MIT | mobile | lockfile + package.json |
| `nth-check` | 2.1.1 | BSD-2-Clause | mobile | lockfile + package.json |
| `nullthrows` | 1.1.1 | MIT | mobile | lockfile + package.json |
| `ob1` | 0.84.5 | MIT | mobile | lockfile + package.json |
| `ob1` | 0.84.6 | MIT | mobile | lockfile + package.json |
| `object-assign` | 4.1.1 | MIT | core-web, mobile | lockfile + package.json |
| `on-exit-leak-free` | 2.1.2 | MIT | core-server, mock-core | lockfile + package.json |
| `on-finished` | 2.3.0 | MIT | mobile | lockfile + package.json |
| `on-finished` | 2.4.1 | MIT | mobile | lockfile + package.json |
| `on-headers` | 1.1.0 | MIT | mobile | lockfile + package.json |
| `once` | 1.4.0 | ISC | core-server, mobile, mock-core | lockfile + package.json |
| `onetime` | 2.0.1 | MIT | mobile | lockfile + package.json |
| `onetime` | 5.1.2 | MIT | mobile | lockfile + package.json |
| `onvif` | 0.8.3 | MIT | core-server | lockfile + package.json |
| `open` | 7.4.2 | MIT | mobile | lockfile + package.json |
| `openapi-types` | 12.1.3 | MIT | core-server | lockfile + package.json |
| `ora` | 3.4.0 | MIT | mobile | lockfile + package.json |
| `p-limit` | 2.3.0 | MIT | mobile | lockfile + package.json |
| `p-limit` | 3.1.0 | MIT | mobile | lockfile + package.json |
| `p-locate` | 4.1.0 | MIT | mobile | lockfile + package.json |
| `p-try` | 2.2.0 | MIT | mobile | lockfile + package.json |
| `parse-json` | 5.2.0 | MIT | mobile | lockfile + package.json |
| `parse-ms` | 4.0.0 | MIT | core-web | lockfile + package.json |
| `parse-png` | 2.1.0 | MIT | mobile | lockfile + package.json |
| `parse5` | 7.3.0 | MIT | core-web | lockfile + package.json |
| `parseurl` | 1.3.3 | MIT | mobile | lockfile + package.json |
| `path-exists` | 4.0.0 | MIT | mobile | lockfile + package.json |
| `path-is-absolute` | 1.0.1 | MIT | mobile | lockfile + package.json |
| `path-key` | 3.1.1 | MIT | mobile | lockfile + package.json |
| `path-parse` | 1.0.7 | MIT | mobile | lockfile + package.json |
| `path-scurry` | 2.0.2 | BlueOak-1.0.0 | mobile | lockfile + package.json |
| `pathe` | 2.0.3 | MIT | core-web | lockfile + package.json |
| `pg` | 8.23.1 | MIT | core-server | lockfile + package.json |
| `pg-cloudflare` | 1.4.1 | MIT | core-server | lockfile + package.json |
| `pg-connection-string` | 2.14.1 | MIT | core-server | lockfile + package.json |
| `pg-int8` | 1.0.1 | ISC | core-server | lockfile + package.json |
| `pg-pool` | 3.14.0 | MIT | core-server | lockfile + package.json |
| `pg-protocol` | 1.16.1 | MIT | core-server | lockfile + package.json |
| `pg-types` | 2.2.0 | MIT | core-server | lockfile + package.json |
| `pgpass` | 1.0.5 | MIT | core-server | lockfile + package.json |
| `picocolors` | 1.1.1 | ISC | core-web, mobile | lockfile + package.json |
| `picomatch` | 2.3.2 | MIT | mobile | lockfile + package.json |
| `picomatch` | 4.0.7 | MIT | mobile | lockfile + package.json |
| `pino` | 10.3.1 | MIT | core-server, mock-core | lockfile + package.json |
| `pino-abstract-transport` | 3.0.0 | MIT | core-server, mock-core | lockfile + package.json |
| `pino-std-serializers` | 7.1.0 | MIT | core-server, mock-core | lockfile + package.json |
| `pirates` | 4.0.7 | MIT | mobile | lockfile + package.json |
| `pkg-dir` | 4.2.0 | MIT | mobile | lockfile + package.json |
| `plist` | 3.1.1 | MIT | mobile | lockfile + package.json |
| `pngjs` | 3.4.0 | MIT | mobile | lockfile + package.json |
| `postcss` | 8.5.28 | MIT | core-web, mobile | lockfile + package.json |
| `postcss-value-parser` | 4.2.0 | MIT | mobile | lockfile + package.json |
| `postgres-array` | 2.0.0 | MIT | core-server | lockfile + package.json |
| `postgres-bytea` | 1.0.1 | MIT | core-server | lockfile + package.json |
| `postgres-date` | 1.0.7 | MIT | core-server | lockfile + package.json |
| `postgres-interval` | 1.2.0 | MIT | core-server | lockfile + package.json |
| `pretty-format` | 29.7.0 | MIT | mobile | lockfile + package.json |
| `pretty-format` | 30.5.1 | MIT | mobile | lockfile + package.json |
| `pretty-ms` | 9.3.1 | MIT | core-web | lockfile + package.json |
| `proc-log` | 4.2.0 | ISC | mobile | lockfile + package.json |
| `process-warning` | 4.0.1 | MIT | core-server, mock-core | lockfile + package.json |
| `process-warning` | 5.1.0 | MIT | core-server, mock-core | lockfile + package.json |
| `progress` | 2.0.3 | MIT | mobile | lockfile + package.json |
| `promise` | 7.3.1 | MIT | mobile | lockfile + package.json |
| `promise` | 8.3.0 | MIT | mobile | lockfile + package.json |
| `prompts` | 2.4.2 | MIT | mobile | lockfile + package.json |
| `prop-types` | 15.8.1 | MIT | core-web | lockfile + package.json |
| `property-information` | 7.2.0 | MIT | core-web | lockfile + package.json |
| `pure-rand` | 6.1.0 | MIT | mobile | lockfile + package.json |
| `qrcode.react` | 4.2.0 | ISC | core-web | lockfile + package.json |
| `query-string` | 7.1.3 | MIT | mobile | lockfile + package.json |
| `quick-format-unescaped` | 4.0.4 | MIT | core-server, mock-core | lockfile + package.json |
| `radix-vue` | 1.9.17 | MIT | core-web | lockfile + package.json |
| `range-parser` | 1.2.1 | MIT | mobile | lockfile + package.json |
| `rate-limiter-flexible` | 11.2.1 | ISC | core-server | lockfile + package.json |
| `react` | 19.2.3 | MIT | core-server, core-web, mobile, mock-core, transcriber | lockfile + package.json |
| `react-aria` | 3.52.1 | Apache-2.0 | core-web | lockfile + package.json |
| `react-aria-components` | 1.21.1 | Apache-2.0 | core-web | lockfile + package.json |
| `react-devtools-core` | 6.1.5 | MIT | mobile | lockfile + package.json |
| `react-dom` | 19.2.3 | MIT | core-web, mobile | lockfile + package.json |
| `react-fast-compare` | 3.2.2 | MIT | mobile | lockfile + package.json |
| `react-freeze` | 1.0.4 | MIT | mobile | lockfile + package.json |
| `react-hook-form` | 7.89.0 | MIT | core-web, mobile | lockfile + package.json |
| `react-i18next` | 17.0.15 | MIT | core-web, mobile | lockfile + package.json |
| `react-is` | 16.13.1 | MIT | core-web, mobile | lockfile + package.json |
| `react-is` | 18.3.1 | MIT | mobile | lockfile + package.json |
| `react-is` | 19.2.3 | MIT | core-web, mobile | lockfile + package.json |
| `react-native` | 0.86.3 | MIT | mobile | lockfile + package.json |
| `react-native-drawer-layout` | 4.2.11 | MIT | mobile | lockfile + package.json |
| `react-native-gesture-handler` | 2.32.0 | MIT | mobile | lockfile + package.json |
| `react-native-is-edge-to-edge` | 1.3.1 | MIT | mobile | lockfile + package.json |
| `react-native-keyboard-controller` | 1.21.9 | MIT | mobile | lockfile + package.json |
| `react-native-reanimated` | 4.5.1 | MIT | mobile | lockfile + package.json |
| `react-native-safe-area-context` | 5.7.0 | MIT | mobile | lockfile + package.json |
| `react-native-screens` | 4.26.2 | MIT | mobile | lockfile + package.json |
| `react-native-skia-android` | 147.1.0 | MIT | mobile | lockfile + package.json |
| `react-native-skia-apple-ios` | 147.1.0 | MIT | mobile | lockfile + package.json |
| `react-native-skia-apple-macos` | 147.1.0 | MIT | mobile | lockfile + package.json |
| `react-native-skia-apple-tvos` | 147.1.0 | MIT | mobile | lockfile + package.json |
| `react-native-svg` | 15.15.4 | MIT | mobile | lockfile + package.json |
| `react-native-web` | 0.21.3 | MIT | mobile | lockfile + package.json |
| `react-native-worklets` | 0.10.1 | MIT | mobile | lockfile + package.json |
| `react-reconciler` | 0.31.0 | MIT | mobile | lockfile + package.json |
| `react-redux` | 9.3.0 | MIT | core-web | lockfile + package.json |
| `react-refresh` | 0.14.2 | MIT | mobile | lockfile + package.json |
| `react-remove-scroll` | 2.7.2 | MIT | mobile | lockfile + package.json |
| `react-remove-scroll-bar` | 2.3.8 | MIT | mobile | lockfile + package.json |
| `react-stately` | 3.50.0 | Apache-2.0 | core-web | lockfile + package.json |
| `react-style-singleton` | 2.2.3 | MIT | mobile | lockfile + package.json |
| `react-test-renderer` | 19.2.3 | MIT | mobile | lockfile + package.json |
| `react-transition-group` | 4.4.5 | BSD-3-Clause | core-web | lockfile + package.json |
| `react-use-measure` | 2.1.7 | MIT | core-web | lockfile + package.json |
| `readable-stream` | 3.6.2 | MIT | core-server, mock-core | lockfile + package.json |
| `real-require` | 0.2.0 | MIT | core-server, mock-core | lockfile + package.json |
| `real-require` | 1.0.0 | MIT | core-server, mock-core | lockfile + package.json |
| `recharts` | 3.10.1 | MIT | core-web | lockfile + package.json |
| `redent` | 3.0.0 | MIT | mobile | lockfile + package.json |
| `redux` | 5.0.1 | MIT | core-web | lockfile + package.json |
| `redux-thunk` | 3.1.0 | MIT | core-web | lockfile + package.json |
| `regenerate` | 1.4.2 | MIT | mobile | lockfile + package.json |
| `regenerate-unicode-properties` | 10.3.0 | MIT | mobile | lockfile + package.json |
| `regenerator-runtime` | 0.13.11 | MIT | mobile | lockfile + package.json |
| `regexpu-core` | 6.5.2 | MIT | mobile | lockfile + package.json |
| `regjsgen` | 0.8.0 | MIT | mobile | lockfile + package.json |
| `regjsparser` | 0.13.3 | BSD-2-Clause | mobile | lockfile + package.json |
| `rehype-external-links` | 3.0.0 | MIT | core-web | lockfile + package.json |
| `rehype-format` | 5.0.1 | MIT | core-web | lockfile + package.json |
| `rehype-minify-whitespace` | 6.0.2 | MIT | core-web | lockfile + package.json |
| `rehype-parse` | 9.0.1 | MIT | core-web | lockfile + package.json |
| `rehype-raw` | 7.0.0 | MIT | core-web | lockfile + package.json |
| `rehype-remark` | 10.0.1 | MIT | core-web | lockfile + package.json |
| `rehype-sanitize` | 6.0.0 | MIT | core-web | lockfile + package.json |
| `rehype-stringify` | 10.0.1 | MIT | core-web | lockfile + package.json |
| `remark-gfm` | 4.0.1 | MIT | core-web | lockfile + package.json |
| `remark-parse` | 11.0.0 | MIT | core-web | lockfile + package.json |
| `remark-rehype` | 11.1.2 | MIT | core-web | lockfile + package.json |
| `remark-stringify` | 11.0.0 | MIT | core-web | lockfile + package.json |
| `require-directory` | 2.1.1 | MIT | mobile | lockfile + package.json |
| `require-from-string` | 2.0.2 | MIT | core-server, core-web, mobile, mock-core | lockfile + package.json |
| `reselect` | 5.2.0 | MIT | core-web | lockfile + package.json |
| `resolve` | 1.22.12 | MIT | mobile | lockfile + package.json |
| `resolve-cwd` | 3.0.0 | MIT | mobile | lockfile + package.json |
| `resolve-from` | 5.0.0 | MIT | mobile | lockfile + package.json |
| `resolve-workspace-root` | 2.0.1 | MIT | mobile | lockfile + package.json |
| `resolve.exports` | 2.0.3 | MIT | mobile | lockfile + package.json |
| `restore-cursor` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `ret` | 0.5.0 | MIT | core-server, mock-core | lockfile + package.json |
| `reusify` | 1.1.0 | MIT | core-server, mock-core | lockfile + package.json |
| `rfdc` | 1.4.1 | MIT | core-server, mock-core | lockfile + package.json |
| `safe-buffer` | 5.2.1 | MIT | core-server, mobile, mock-core | lockfile + package.json |
| `safe-regex2` | 5.1.1 | MIT | core-server, mock-core | lockfile + package.json |
| `safe-stable-stringify` | 2.5.0 | MIT | core-server, mock-core | lockfile + package.json |
| `sandbox-cli-detector` | 0.2.0 | MIT | mobile | lockfile + package.json |
| `sax` | 1.6.1 | BlueOak-1.0.0 | core-server, mobile | lockfile + package.json |
| `scheduler` | 0.25.0 | MIT | mobile | lockfile + package.json |
| `scheduler` | 0.27.0 | MIT | core-web, mobile | lockfile + package.json |
| `secure-json-parse` | 4.1.0 | BSD-3-Clause | core-server, mock-core | lockfile + package.json |
| `semver` | 6.3.1 | ISC | mobile | lockfile + package.json |
| `semver` | 7.8.5 | ISC | core-server, mobile, mock-core | lockfile + package.json |
| `send` | 0.19.2 | MIT | mobile | lockfile + package.json |
| `serialize-error` | 2.1.0 | MIT | mobile | lockfile + package.json |
| `seroval` | 1.6.8 | MIT | core-web | lockfile + package.json |
| `seroval-plugins` | 1.6.8 | MIT | core-web | lockfile + package.json |
| `serve-static` | 1.16.3 | MIT | mobile | lockfile + package.json |
| `server-only` | 0.0.1 | MIT | mobile | lockfile + package.json |
| `set-cookie-parser` | 2.7.2 | MIT | core-server, mock-core | lockfile + package.json |
| `set-cookie-parser` | 3.1.0 | MIT | core-web | lockfile + package.json |
| `setimmediate` | 1.0.5 | MIT | mobile | lockfile + package.json |
| `setprototypeof` | 1.2.0 | ISC | mobile | lockfile + package.json |
| `sf-symbols-typescript` | 2.2.0 | MIT | mobile | lockfile + package.json |
| `shallowequal` | 1.1.0 | MIT | mobile | lockfile + package.json |
| `shebang-command` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `shebang-regex` | 3.0.0 | MIT | mobile | lockfile + package.json |
| `shell-quote` | 1.11.0 | MIT | mobile | lockfile + package.json |
| `signal-exit` | 3.0.7 | ISC | mobile | lockfile + package.json |
| `simple-plist` | 1.3.1 | MIT | mobile | lockfile + package.json |
| `simple-swizzle` | 0.2.4 | MIT | mobile | lockfile + package.json |
| `sisteransi` | 1.0.5 | MIT | mobile | lockfile + package.json |
| `slash` | 3.0.0 | MIT | mobile | lockfile + package.json |
| `slugify` | 1.6.9 | MIT | mobile | lockfile + package.json |
| `sonic-boom` | 4.2.1 | MIT | core-server, mock-core | lockfile + package.json |
| `source-map` | 0.5.7 | BSD-3-Clause | mobile | lockfile + package.json |
| `source-map` | 0.6.1 | BSD-3-Clause | mobile | lockfile + package.json |
| `source-map-js` | 1.2.2 | BSD-3-Clause | core-web, mobile | lockfile + package.json |
| `source-map-support` | 0.5.13 | MIT | mobile | lockfile + package.json |
| `source-map-support` | 0.5.21 | MIT | mobile | lockfile + package.json |
| `space-separated-tokens` | 2.0.2 | MIT | core-web | lockfile + package.json |
| `split-on-first` | 1.1.0 | MIT | mobile | lockfile + package.json |
| `split2` | 4.2.0 | ISC | core-server, mock-core | lockfile + package.json |
| `sprintf-js` | 1.0.3 | BSD-3-Clause | mobile | lockfile + package.json |
| `stack-utils` | 2.0.6 | MIT | mobile | lockfile + package.json |
| `stackframe` | 1.3.4 | MIT | mobile | lockfile + package.json |
| `stacktrace-parser` | 0.1.11 | MIT | mobile | lockfile + package.json |
| `standard-navigation` | 0.0.5 | MIT | mobile | lockfile + package.json |
| `statuses` | 1.5.0 | MIT | mobile | lockfile + package.json |
| `statuses` | 2.0.2 | MIT | mobile | lockfile + package.json |
| `stream-buffers` | 2.2.0 | Unlicense | mobile | lockfile + package.json |
| `stream-shift` | 1.0.3 | MIT | core-server, mock-core | lockfile + package.json |
| `strict-uri-encode` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `string-byte-length` | 3.0.1 | MIT | core-web | lockfile + package.json |
| `string-byte-slice` | 3.0.1 | MIT | core-web | lockfile + package.json |
| `string-length` | 4.0.2 | MIT | mobile | lockfile + package.json |
| `string-width` | 4.2.3 | MIT | mobile | lockfile + package.json |
| `string_decoder` | 1.3.0 | MIT | core-server, mock-core | lockfile + package.json |
| `stringify-entities` | 4.0.4 | MIT | core-web | lockfile + package.json |
| `strip-ansi` | 5.2.0 | MIT | mobile | lockfile + package.json |
| `strip-ansi` | 6.0.1 | MIT | mobile | lockfile + package.json |
| `strip-bom` | 4.0.0 | MIT | mobile | lockfile + package.json |
| `strip-final-newline` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `strip-indent` | 3.0.0 | MIT | mobile | lockfile + package.json |
| `strip-json-comments` | 3.1.1 | MIT | mobile | lockfile + package.json |
| `structured-headers` | 0.4.1 | MIT | mobile | lockfile + package.json |
| `style-mod` | 4.1.4 | MIT | core-web | lockfile + package.json |
| `styleq` | 0.1.3 | MIT | mobile | lockfile + package.json |
| `supports-color` | 5.5.0 | MIT | mobile | lockfile + package.json |
| `supports-color` | 7.2.0 | MIT | mobile | lockfile + package.json |
| `supports-color` | 8.1.1 | MIT | mobile | lockfile + package.json |
| `supports-hyperlinks` | 2.3.0 | MIT | mobile | lockfile + package.json |
| `supports-preserve-symlinks-flag` | 1.0.0 | MIT | mobile | lockfile + package.json |
| `swrv` | 1.3.0 | Apache-2.0 | core-web | lockfile + package.json |
| `tabbable` | 6.5.0 | MIT | core-web | lockfile + package.json |
| `tagged-tag` | 1.0.0 | MIT | core-web | lockfile + package.json |
| `tailwind-merge` | 3.5.0 | MIT | core-web | lockfile + package.json |
| `tailwind-merge` | 3.7.0 | MIT | core-web, mobile | lockfile + package.json |
| `tailwind-variants` | 3.3.1 | MIT | core-web, mobile | lockfile + package.json |
| `tailwindcss` | 4.3.3 | MIT | core-web, mobile | lockfile + package.json |
| `tapable` | 2.3.3 | MIT | mobile | lockfile + package.json |
| `terminal-link` | 2.1.1 | MIT | mobile | lockfile + package.json |
| `terser` | 5.51.2 | BSD-2-Clause | mobile | lockfile + package.json |
| `test-exclude` | 6.0.0 | ISC | mobile | lockfile + package.json |
| `thread-stream` | 4.2.0 | MIT | core-server, mock-core | lockfile + package.json |
| `throat` | 5.0.0 | MIT | mobile | lockfile + package.json |
| `tiny-invariant` | 1.3.3 | MIT | core-web | lockfile + package.json |
| `tinyglobby` | 0.2.17 | MIT | mobile | lockfile + package.json |
| `tmpl` | 1.0.5 | BSD-3-Clause | mobile | lockfile + package.json |
| `to-regex-range` | 5.0.1 | MIT | mobile | lockfile + package.json |
| `toad-cache` | 3.7.4 | MIT | core-server, mock-core | lockfile + package.json |
| `toidentifier` | 1.0.1 | MIT | mobile | lockfile + package.json |
| `toqr` | 0.1.1 | MIT | mobile | lockfile + package.json |
| `tr46` | 0.0.3 | MIT | mobile | lockfile + package.json |
| `trim-lines` | 3.0.1 | MIT | core-web | lockfile + package.json |
| `trim-trailing-lines` | 2.1.0 | MIT | core-web | lockfile + package.json |
| `trough` | 2.2.0 | MIT | core-web | lockfile + package.json |
| `truncate-json` | 3.0.1 | MIT | core-web | lockfile + package.json |
| `tslib` | 2.8.1 | 0BSD | core-web, mobile | lockfile + package.json |
| `tsx` | 4.23.15 | MIT | core-server, mock-core | lockfile + package.json |
| `tw-animate-css` | 1.4.0 | MIT | core-web | lockfile + package.json |
| `type-detect` | 4.0.8 | MIT | mobile | lockfile + package.json |
| `type-fest` | 0.21.3 | (MIT OR CC0-1.0) | mobile | lockfile + package.json |
| `type-fest` | 0.7.1 | (MIT OR CC0-1.0) | mobile | lockfile + package.json |
| `type-fest` | 5.10.0 | (MIT OR CC0-1.0) | core-web | lockfile + package.json |
| `typescript` | 6.0.3 | Apache-2.0 | core-web, mobile | lockfile + package.json |
| `ua-parser-js` | 0.7.41 | MIT | mobile | lockfile + package.json |
| `ua-parser-js` | 1.0.41 | MIT | mobile | lockfile + package.json |
| `undici` | 7.29.1 | MIT | core-web | lockfile + package.json |
| `undici-types` | 7.24.6 | MIT | core-web | lockfile + package.json |
| `undici-types` | 8.9.0 | MIT | core-server, mobile | lockfile + package.json |
| `unhead` | 2.1.17 | MIT | core-web | lockfile + package.json |
| `unicode-canonical-property-names-ecmascript` | 2.0.1 | MIT | mobile | lockfile + package.json |
| `unicode-match-property-ecmascript` | 2.0.0 | MIT | mobile | lockfile + package.json |
| `unicode-match-property-value-ecmascript` | 2.2.1 | MIT | mobile | lockfile + package.json |
| `unicode-property-aliases-ecmascript` | 2.2.0 | MIT | mobile | lockfile + package.json |
| `unified` | 11.0.5 | MIT | core-web | lockfile + package.json |
| `unist-util-find-after` | 5.0.0 | MIT | core-web | lockfile + package.json |
| `unist-util-is` | 6.0.1 | MIT | core-web | lockfile + package.json |
| `unist-util-position` | 5.0.0 | MIT | core-web | lockfile + package.json |
| `unist-util-stringify-position` | 4.0.0 | MIT | core-web | lockfile + package.json |
| `unist-util-visit` | 5.1.0 | MIT | core-web | lockfile + package.json |
| `unist-util-visit-parents` | 6.0.2 | MIT | core-web | lockfile + package.json |
| `uniwind` | 1.12.0 | MIT | mobile | lockfile + package.json |
| `unpipe` | 1.0.0 | MIT | mobile | lockfile + package.json |
| `update-browserslist-db` | 1.3.3 | MIT | mobile | lockfile + package.json |
| `use-callback-ref` | 1.3.3 | MIT | mobile | lockfile + package.json |
| `use-latest-callback` | 0.2.6 | MIT | mobile | lockfile + package.json |
| `use-sidecar` | 1.1.3 | MIT | mobile | lockfile + package.json |
| `use-sync-external-store` | 1.7.0 | MIT | core-server, core-web, mobile, mock-core, transcriber | lockfile + package.json |
| `util-deprecate` | 1.0.2 | MIT | core-server, mock-core | lockfile + package.json |
| `utils-merge` | 1.0.1 | MIT | mobile | lockfile + package.json |
| `uuid` | 7.0.3 | MIT | mobile | lockfile + package.json |
| `v8-to-istanbul` | 9.3.0 | ISC | mobile | lockfile + package.json |
| `validate-npm-package-name` | 5.0.1 | ISC | mobile | lockfile + package.json |
| `vary` | 1.1.2 | MIT | mobile | lockfile + package.json |
| `vaul` | 1.1.2 | MIT | mobile | lockfile + package.json |
| `vfile` | 6.0.3 | MIT | core-web | lockfile + package.json |
| `vfile-location` | 5.0.3 | MIT | core-web | lockfile + package.json |
| `vfile-message` | 4.0.3 | MIT | core-web | lockfile + package.json |
| `victory-native` | 42.0.1 | MIT | mobile | lockfile + package.json |
| `victory-vendor` | 37.3.6 | MIT AND ISC | core-web | lockfile + package.json |
| `vlq` | 1.0.1 | MIT | mobile | lockfile + package.json |
| `vue` | 3.5.43 | MIT | core-web | lockfile + package.json |
| `vue-component-type-helpers` | 3.3.11 | MIT | core-web | lockfile + package.json |
| `vue-demi` | 0.14.10 | MIT | core-web | lockfile + package.json |
| `vue-sonner` | 1.3.2 | MIT | core-web | lockfile + package.json |
| `w3c-keyname` | 2.2.8 | MIT | core-web | lockfile + package.json |
| `walker` | 1.0.8 | Apache-2.0 | mobile | lockfile + package.json |
| `warn-once` | 0.1.1 | MIT | mobile | lockfile + package.json |
| `wcwidth` | 1.0.1 | MIT | mobile | lockfile + package.json |
| `web-namespaces` | 2.0.1 | MIT | core-web | lockfile + package.json |
| `webidl-conversions` | 3.0.1 | BSD-2-Clause | mobile | lockfile + package.json |
| `whatwg-fetch` | 3.6.20 | MIT | mobile | lockfile + package.json |
| `whatwg-url` | 5.0.0 | MIT | mobile | lockfile + package.json |
| `whatwg-url-minimum` | 0.1.2 | MIT | mobile | lockfile + package.json |
| `which` | 2.0.2 | ISC | mobile | lockfile + package.json |
| `wrap-ansi` | 7.0.0 | MIT | mobile | lockfile + package.json |
| `wrappy` | 1.0.2 | ISC | core-server, mobile, mock-core | lockfile + package.json |
| `write-file-atomic` | 4.0.2 | ISC | mobile | lockfile + package.json |
| `ws` | 7.5.13 | MIT | mobile | lockfile + package.json |
| `ws` | 8.22.0 | MIT | core-server, mobile, mock-core | lockfile + package.json |
| `xcode` | 3.0.1 | Apache-2.0 | mobile | lockfile + package.json |
| `xml2js` | 0.6.0 | MIT | mobile | lockfile + package.json |
| `xml2js` | 0.6.2 | MIT | core-server | lockfile + package.json |
| `xmlbuilder` | 11.0.1 | MIT | core-server, mobile | lockfile + package.json |
| `xmlbuilder` | 15.1.1 | MIT | mobile | lockfile + package.json |
| `xtend` | 4.0.2 | MIT | core-server | lockfile + package.json |
| `y18n` | 5.0.8 | ISC | mobile | lockfile + package.json |
| `yallist` | 3.1.1 | ISC | mobile | lockfile + package.json |
| `yaml` | 2.9.1 | ISC | core-server, core-web, mobile | lockfile + package.json |
| `yargs` | 17.7.3 | MIT | mobile | lockfile + package.json |
| `yargs-parser` | 21.1.1 | ISC | mobile | lockfile + package.json |
| `yazl` | 3.3.1 | MIT | core-server | lockfile + package.json |
| `yocto-queue` | 0.1.0 | MIT | mobile | lockfile + package.json |
| `zod` | 3.25.76 | MIT | mobile | lockfile + package.json |
| `zod` | 4.6.5 | MIT | core-server, core-web, mobile, mock-core, transcriber | lockfile + package.json |
| `zustand` | 5.0.15 | MIT | core-server, core-web, mobile, mock-core, transcriber | lockfile + package.json |
| `zwitch` | 2.0.4 | MIT | core-web | lockfile + package.json |
