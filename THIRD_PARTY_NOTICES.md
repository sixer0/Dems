# Third-Party Notices

Source files copied into this repository from third-party registries (copy-in model; `shadcn init` is never run, 03 SD-27, F4). Each item keeps its original licence. npm dependencies carry their own licence files inside `node_modules` and are not listed here.

| Item | Collection | Licence | Source URL | Retrieved | Copied to |
|---|---|---|---|---|---|
| BorderBeam | Magic UI | MIT | `https://magicui.design/r/border-beam.json` | 2026-10-01 | `apps/core-web/src/components/ui/border-beam.tsx` |
| SlidingNumber | Motion Primitives | MIT | `https://motion-primitives.com/c/sliding-number.json` | 2026-10-01 | `apps/core-web/src/components/ui/sliding-number.tsx` (one local change: `as const` on `TRANSITION` for TypeScript 6 literal typing) |

Licence texts below were retrieved on 2026-10-01 from the upstream repositories: Magic UI `https://raw.githubusercontent.com/magicuidesign/magicui/main/LICENSE.md`; Motion Primitives `https://raw.githubusercontent.com/ibelick/motion-primitives/main/LICENCE.md`.

---

## Magic UI

```
MIT License

Copyright (c) Magic UI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Motion Primitives

```
MIT License

Copyright (c) 2024 ibelick

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
app/page.tsx
```
