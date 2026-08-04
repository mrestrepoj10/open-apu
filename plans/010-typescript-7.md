# Plan 010: Actualizar a TypeScript 7 (chequeo nativo, CLI checker de Next 16.3)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d50cf63..HEAD -- package.json bun.lock tsconfig.json next.config.ts`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

> **⛔ BLOCKED (2026-08-04) — do not execute until a revisit trigger fires.**
> Two execution rounds established, with verified evidence:
> 1. TS 7 typecheck works and is fast here (0.29 s vs 1.75 s) once
>    `"types": ["bun", "node"]` is added to tsconfig — that part is proven.
> 2. `typescript-eslint@8.66.0` (via `eslint-config-next`) hard-crashes on
>    TS 7 (upstream support tracked in typescript-eslint#10940; peer range is
>    `>=4.8.4 <6.1.0`, so real TS 6 would satisfy it).
> 3. Microsoft's documented side-by-side remedy (`typescript` →
>    `npm:@typescript/typescript6`, native under `@typescript/native`) is
>    broken under **bun 1.3.3**: the wrapper package's internal
>    `"@typescript/old": "npm:typescript@^6"` alias resolves circularly back
>    to the wrapper itself (verified: `require('typescript').version` →
>    `undefined`; `lib/typescript.js` is a 45-byte stub), so the TS 6 API
>    never materializes and lint still crashes.
>
> **Revisit triggers**: (a) typescript-eslint ships TS 7 support
> (typescript-eslint/typescript-eslint#10940), or (b) bun fixes nested `npm:`
> alias resolution.
>
> **Follow-up experiments (2026-08-04, scratch dirs outside the repo):**
> - Root-pinning `"@typescript/old": "npm:typescript@^6"` does NOT fix bun's
>   resolution — the alias still lands on the wrapper package
>   (`require('typescript').version` → `undefined`). Bun's root alias for
>   the name `typescript` captures every `npm:typescript@…` specifier in the
>   graph regardless of where it's declared.
> - Control test: the identical package.json through **npm** works —
>   `@typescript/old` resolves to real `typescript@6.0.3` and the API loads.
>   Microsoft's side-by-side pattern is sound; this is a **bun 1.3.3 bug**,
>   worth reporting upstream (oven-sh/bun).
>
> The branch `advisor/010-typescript-7` holds the WIP commit (`a9137f8`) with
> the three file edits for whoever resumes this.

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW-MED (toolchain swap; the risk is ecosystem compat — eslint,
  editor — not runtime, since tsc emits nothing here)
- **Depends on**: none
- **Category**: migration / dx
- **Planned at**: commit `d50cf63`, 2026-08-04

## Why this matters

TypeScript 7 is the native (Go) port — ~10× faster type checking. The repo is
already on Next 16.3, whose build **runs the project-local `tsc` CLI by
default** (`experimental.useTypeScriptCli`, default `true`), precisely so
TS 7 works while its JavaScript compiler API doesn't exist. The upgrade is a
devDependency bump plus verification: `bun run typecheck` and the type-check
phase of `next build` (~35 s total today) both get dramatically faster, which
this repo pays on every one of its ~4.9k-page builds.

Key facts from the Next 16.3 docs (fetched 2026-08-04):

- "By default, `next build` runs the project-local `tsc` command … This
  supports TypeScript 6 and enables TypeScript 7 while its JavaScript API is
  unavailable." Install: `bun add -D typescript@^7`.
- **Do NOT set `experimental.useTypeScriptCli: false`** — "If you opt out
  while using TypeScript 7, `next build` exits because the TypeScript
  JavaScript compiler API is unavailable." No `next.config.ts` change is
  needed at all.
- With the CLI checker, diagnostics print raw from `tsc` (no Next code
  frames), and the WHOLE tsconfig project is checked, including test files.

## Current state

- `package.json:49` — `"typescript": "^5"` in devDependencies. Scripts:
  `"typecheck": "tsc --noEmit"`, `"lint": "eslint"`, `"test": "bun test"`,
  `"build": "next build"`. `eslint-config-next` is `16.3.0`.
- `next.config.ts` — `cacheComponents: true`, `partialPrefetching: true`,
  `outputFileTracingIncludes`. No `experimental.useTypeScriptCli` key —
  correct; keep it that way.
- `tsconfig.json` — Next-standard: `strict`, `noEmit`, `moduleResolution:
  "bundler"`, `jsx: "react-jsx"`, `incremental: true`, plugin
  `{ "name": "next" }`, includes `.next/types` + `.next/dev/types`. No exotic
  or long-deprecated flags — a clean TS 7 candidate.
- `bun test` does NOT go through tsc (Bun strips types itself), so tests are
  a regression canary, not a compat risk.

## Commands you will need

| Purpose     | Command                     | Expected on success                    |
|-------------|-----------------------------|----------------------------------------|
| Install     | `bun install`               | exit 0 (fresh worktree)                |
| Upgrade     | `bun add -d typescript@^7`  | exit 0; package.json shows `^7`        |
| Version     | `bunx tsc --version`        | prints `Version 7.x`                   |
| Typecheck   | `bun run typecheck`         | exit 0, no diagnostics                 |
| Lint        | `bun run lint`              | exit 0                                 |
| Tests       | `bun test`                  | all pass                               |
| Build       | `bun run build`             | exit 0; type-check phase present       |

## Scope

**In scope**:
- `package.json` / `bun.lock` (the `typescript` devDependency + the
  `@typescript/native` alias from Step 1)
- `tsconfig.json` — the authorized `"types": ["bun", "node"]` addition
  (Step 2), plus ONLY what a TS 7 diagnostic explicitly requires (record in
  NOTES)
- Source files — ONLY for mechanical fixes to new TS 7 diagnostics, max ~5
  small edits (see STOP conditions)

**Out of scope** (do NOT touch):
- `next.config.ts` — no `useTypeScriptCli` key is needed; adding one either
  way is wrong (default is already `true`; `false` breaks TS 7).
- Every other dependency version.

## Git workflow

- Branch: `advisor/010-typescript-7`
- One commit, e.g. "Upgrade to TypeScript 7".
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install TS 7 side-by-side with the TS 6 API (revised, round 2)

**Finding from execution round 2 (2026-08-04):** a naive `typescript@^7` bump
breaks `bun run lint` — `typescript-eslint@8.66.0` (via
`eslint-config-next@16.3.0`) hard-crashes: "typescript-eslint does not
support TS 7.0" (their TS7 support is months away, tracking issue #10940).
Microsoft's TS 7.0 announcement documents the official remedy — run both
side-by-side, because "some tools like typescript-eslint expect to import
from `typescript` directly": the `typescript` package name stays on the TS 6
API build and the native compiler installs under an alias that provides the
`tsc` binary. Set devDependencies to:

```json
"@typescript/native": "npm:typescript@^7.0.2",
"typescript": "npm:@typescript/typescript6@^6.0.2"
```

(via `bun add -d '@typescript/native@npm:typescript@^7.0.2' 'typescript@npm:@typescript/typescript6@^6.0.2'`
or by editing package.json + `bun install`.) Result: `node_modules/.bin/tsc`
is the TS 7 native binary (the typescript6 package ships its bins as `tsc6`,
no collision) — so `bun run typecheck` and Next's CLI checker run native
TS 7, while typescript-eslint imports the TS 6 API and keeps working.

**Verify**: `bunx tsc --version` → `Version 7.x`; `bunx tsc6 --version` →
`Version 6.x`; `grep '"typescript"' package.json` → the
`npm:@typescript/typescript6` alias; `grep '"@typescript/native"' package.json`
→ present.

### Step 2: Typecheck

`bun run typecheck`.

- Exit 0 → continue.
- New diagnostics → triage: if they are few (≤5) and mechanical (e.g. a
  stricter inference, an option rename suggested by the diagnostic itself),
  fix them minimally and list each in NOTES. Otherwise STOP.

**Known TS 7 finding (first execution round, 2026-08-04):** TS 7 does not
auto-include ambient `@types/*` packages the way TS 5 did. Result: 28 errors
across 12 files (`bun:test` module, `Bun` global, `import.meta.dir/main`) —
one root cause. **Authorized fix**: add to `tsconfig.json` `compilerOptions`:

```json
"types": ["bun", "node"]
```

(`bun` restores the Bun ambient types; `node` preserves the TS 5 behavior of
auto-including `@types/node` — an explicit `types` array disables ALL
auto-inclusion, so both must be listed. React types are unaffected: they
resolve via imports, not ambient inclusion.) These 28 same-root-cause errors
count as ONE mechanical fix, not 28, for the STOP threshold. If errors remain
after this change, apply the normal ≤5 triage rule to the remainder.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Lint and tests

`bun run lint` — `eslint-config-next@16.3.0` ships TS-7-aware
typescript-eslint; a *warning* about the TS version is tolerable, a hard
error is a STOP. `bun test` → all pass (canary only).

**Verify**: both exit 0.

### Step 4: Build

`bun run build` — confirms the CLI checker path end-to-end (Next runs the
project-local `tsc`, now the native binary). Expect the type-checking phase
to be visibly faster; record before/after wall-clock if the baseline is
cheap to obtain (one build on the unmodified worktree first — optional but
appreciated).

**Verify**: exit 0.

### Step 5: Housekeeping check

`git status` — if `tsconfig.tsbuildinfo` shows up dirty: check
`git ls-files tsconfig.tsbuildinfo`. If it is NOT tracked, leave it alone; if
it IS tracked, include the regenerated file in the commit and note in NOTES
that the maintainer may want to gitignore it (TS 7 changes the buildinfo
format — decision is theirs, do not add the ignore yourself).

## Test plan

No new tests — toolchain-only change; `bun test` (unchanged suite) plus the
four gates above are the verification.

## Done criteria

- [ ] `bunx tsc --version` → 7.x (native) and `bunx tsc6 --version` → 6.x
      (API build for typescript-eslint)
- [ ] `bun run typecheck`, `bun run lint`, `bun test`, `bun run build` all exit 0
- [ ] `grep -c "useTypeScriptCli" next.config.ts` → 0
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (with the exact diagnostics/output) if:

- `bun run typecheck` produces more than ~5 errors, or any error that
  requires restructuring code rather than annotating it.
- `bun run lint` hard-fails because typescript-eslint rejects TS 7.
- `bun run build` fails in the type-check phase in a way `bun run typecheck`
  did not (would indicate a Next CLI-checker issue worth reporting upstream,
  not working around).
- Any fix would touch `next.config.ts`.

## Maintenance notes

- Editor: VS Code needs TS-7-capable tooling to match the CLI (built-in in
  current VS Code; otherwise the "TypeScript (Native Preview)" extension).
  Worth a line in the repo README when it gets rewritten (BACKLOG item).
- `experimental.useTypeScriptCli` is experimental — when it stabilizes or
  changes name, revisit; the dependency on it is implicit (no config key),
  so nothing to migrate here.
- Reviewer scrutiny: the diff should be essentially two lines of
  `package.json` + lockfile; anything more needs the NOTES to justify it.
