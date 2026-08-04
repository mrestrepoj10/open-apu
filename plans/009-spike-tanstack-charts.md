# Plan 009: Spike — evaluar TanStack Charts como sustituto de recharts

> **Executor instructions**: This is a SPIKE — the deliverable is a
> **written report**, not merged code. Work on a throwaway branch; nothing
> from this plan ships. Follow the steps, honor the STOP conditions, and when
> done: write the report into the "Resultado" section at the bottom of THIS
> file, update the plan's row in `plans/README.md`, and leave the branch
> unmerged.
>
> **Drift check (run first)**: `git diff --stat 3a29f98..HEAD -- components/charts package.json`
> Expected drift: plans 006–008 may have added chart components — that is
> fine and even useful (more real charts to port). Only stop if
> `components/charts/curva-precios.tsx` doesn't exist yet AND plan 006 is not
> DONE — in that case benchmark against `precio-bar.tsx` instead.

## Status

- **Priority**: P3
- **Effort**: S (timebox: half a day; stop when the questions are answered)
- **Risk**: LOW (throwaway branch)
- **Depends on**: ideally after 006 (richer benchmark), not required
- **Category**: direction (spike / dependency evaluation)
- **Planned at**: commit `3a29f98`, 2026-08-03

## Why this matters

The maintainer wants a visually rich explorer and is open to TanStack Charts
even pre-1.0. The trade is concrete: recharts costs ~349 kB of lazy chunk
(BACKLOG.md) vs TanStack Charts' claimed ~27–32 KiB cold — a ~5× cut on the
heaviest JavaScript in the site — but as of 2026-08-03 its own docs
(v0.6.4) say **"pre-alpha release. Its API may change between releases"**,
publish no SSR/Next.js guidance, and don't state React 19 support. Opinions
don't settle this; a half-day spike with measurements does. All repo chart
components already keep the library out of their props ("Recharts es un
detalle de implementación", `precio-bar.tsx:5-8`), so if the spike is
positive the migration is per-component and cheap.

## Questions the report must answer

1. **Install/compat**: does `@tanstack/react-charts` install and typecheck
   against React 19.2 + Next 16 (Turbopack)? Exact version pinned?
2. **Bundle**: measured route-chunk delta for the ported chart — `bun run
   build` output size for the item page before vs after (record both numbers).
3. **SSR/hydration**: does it render inside the existing lazy-island pattern
   (`ssr: false`)? Does it ALSO work server-rendered (no `"use client"`)? Any
   hydration warnings in dev console?
4. **Feature parity**: tooltip with custom formatter, reference line,
   per-point click navigation, CSS-variable theming mapped to the site's
   `--chart-N` amber ramp (their mechanism: `--ts-chart-*` vars +
   `currentColor`). What's missing vs the recharts version?
5. **API ergonomics**: lines of code for the same chart; how much of the API
   feels settled vs churn-prone (note anything undocumented you had to read
   source for).
6. **Verdict**: adopt now / adopt at beta / drop — one paragraph, grounded in
   1–5.

## Commands you will need

| Purpose        | Command                                  | Expected |
|----------------|------------------------------------------|----------|
| Add dep (spike)| `bun add @tanstack/react-charts`         | exit 0   |
| Typecheck      | `bun run typecheck`                      | exit 0   |
| Build (measure)| `bun run build`                          | exit 0; note route sizes table |
| Baseline build | run BEFORE adding the dep, save the output | —      |

## Scope

**In scope** (throwaway branch only):
- `package.json` / `bun.lock` (the spike dep)
- ONE new file `components/charts/curva-precios.tanstack.tsx` (the port)
- ONE temporary wiring change to preview it (any single page) — reverted
  before finishing
- This plan file's "Resultado" section + the plan's README row

**Out of scope**:
- Merging anything. Migrating any existing chart. Touching `BACKLOG.md`
  (the executor reports; the maintainer decides and updates BACKLOG).

## Git workflow

- Branch: `spike/009-tanstack-charts` — never merged. Commit freely.
- The report (this file + README row) is written on the MAIN working branch
  or delivered in your final message if you cannot switch back — do not lose
  it with the branch.

## Steps

### Step 1: Baseline

`bun run build` on the clean branch; save the route-size table (at minimum
the `/items/[codigo]` row and shared chunks).

### Step 2: Install and port

`bun add @tanstack/react-charts` (pin the exact version in the report). Port
the item-page dispersion chart (`components/charts/curva-precios.tsx` if
plan 006 landed; else `precio-bar.tsx`) to
`components/charts/curva-precios.tanstack.tsx` with the SAME props. Consult
https://tanstack.com/charts/latest/docs — expect `defineChart()` + a React
`<Chart>` adapter. Map theming onto the site tokens (`--chart-1..5` in
`app/globals.css:27-31`).

### Step 3: Preview and probe

Temporarily render the port on the item page (swap the lazy import). Probe
questions 3–4 in dev: tooltips, reference line, click-through, dark mode.
Try removing `"use client"`/`ssr: false` to test server rendering; note the
result either way.

### Step 4: Measure

`bun run build` again; diff the route sizes against Step 1. Revert the
temporary wiring.

### Step 5: Report

Fill "Resultado" below: the six answers, the two build tables, the pinned
version, and the verdict paragraph. Update the README row to DONE (spikes are
DONE when the report exists, regardless of verdict).

## Done criteria

- [ ] "Resultado" section below is filled with answers to all six questions,
      including both build-size tables
- [ ] The spike branch exists and is NOT merged; the main branch's only
      changes are this file and the README row
- [ ] `plans/README.md` row updated to DONE with a one-line verdict

## STOP conditions

- Install or typecheck fails against React 19 → that IS the report: record
  the error verbatim under Resultado, verdict "not now", done.
- The timebox (half a day) expires → report what you have; unanswered
  questions listed as unanswered.

## Maintenance notes

- If the verdict is "adopt at beta": add a BACKLOG reminder with the version
  to watch (maintainer does this).
- If "adopt now": migration is one plan per chart component (props stay;
  internals swap), donut and treemap last (least-standard APIs).

## Resultado

**Ejecutado 2026-08-04** en la rama `spike/009-tanstack-charts` (worktree
`agent-a34e8da911627cb92`, commit `2e1b185`, sin fusionar). Puerto de
`precio-bar.tsx` (006 no estaba en el árbol; se usó el fallback del plan).

1. **Install/compat**: `@tanstack/react-charts@0.6.4` (+ `@tanstack/charts@0.6.4`,
   `d3-scale@4.0.2`, `@types/d3-scale@4.0.9` — D3 scale es dependencia declarada
   del consumidor). Peers `react`/`react-dom` `^19.0.0` — **sí declara React 19**
   (corrige la premisa del plan). `tsc --noEmit` limpio.
2. **Bundle** (chunk perezoso aislado, misma gráfica):
   recharts **340,5 KiB / 100,7 KiB gz** → TanStack **62,3 KiB / 22,6 KiB gz**
   — **~5,5×**. First Load JS de `/items/[codigo]` sin cambio (486,9 → 487,3 KiB;
   la gráfica es perezosa en ambos). Caveat abierto: ambigüedad de chunks
   compartidos con `/theme` y `components/ui/chart.tsx` — re-medir con
   `bun run analyze` + traza de red antes de decidir una migración.
3. **SSR/hydration**: ambos modos funcionan. Con SSR completo el HTML inicial
   trae el `<svg class="ts-chart">` entero, determinista, sin errores de
   hidratación en el log del servidor — capacidad que el patrón perezoso de
   recharts ni intenta. El paquete npm **sí trae guía SSR**
   (`node_modules/@tanstack/charts/docs/guides/ssr-and-hydration.md`) — la
   web pública (pre-alpha) es la que no la muestra; corrige la premisa del plan.
4. **Paridad**: tooltip con formatter ✓, línea de referencia ✓ (`ruleX`),
   clic por punto ✓ (`onSelect` con el dato), theming por variables CSS ✓
   (`--ts-chart-N` mapeadas a `--chart-N`, el SVG serializa `fill="var(…)"`).
   Falta: el envoltorio shadcn (`ChartContainer`/`ChartTooltipContent`) no
   aplica; el tooltip nativo no está restilizado a los tokens `--popover`.
5. **Ergonomía**: 142 líneas vs 127 (y el puerto añade 2 capacidades). Docs
   dentro del paquete sorprendentemente completas; tres opciones requirieron
   leer `.d.ts`. Gramática tipo Observable Plot (marcas + escalas D3), salto
   conceptual mayor que un swap típico.
6. **Veredicto: adoptar en beta.** El recorte ~5,5× es real y el SSR es un
   plus genuino, pero es pre-alpha declarado ("API may change between
   releases") y la medición de bundle tiene el caveat de los chunks
   compartidos. Migrar cuando corten una etiqueta beta/pre-1.0 con compromiso
   de estabilidad; entonces re-medir limpio y decidir. Compatible con el no
   negociable 5 («boring tech»): esperar la beta ES la opción aburrida.
