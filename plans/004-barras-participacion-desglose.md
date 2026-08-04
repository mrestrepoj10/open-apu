# Plan 004: Barras de participación por línea en las tablas del desglose

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d50cf63..HEAD -- "app/items/[codigo]/_components/tabla-desglose.tsx" "app/items/[codigo]/[provincia]/page.tsx"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction (visual)
- **Planned at**: commit `d50cf63`, 2026-08-04 (refreshed after the 16.3
  restructure: the desglose page now wraps its content in
  `LimiteDesglose` + `Suspense` — see Current state)

## Why this matters

The desglose page answers "what does this APU cost", but not the follow-up an
estimator actually asks: **which lines drive it**. The donut at the bottom
shows the four component shares, but within "II. Materiales" (often 60–80 % of
the cost and 10–30 lines) every line looks the same. Adding a "% del costo
directo" column with a subtle inline bar to each line — server-rendered HTML,
zero JavaScript — makes the cost structure legible at a glance while keeping
every number in the server HTML (the repo's rule: charts are enhancement,
never the source of the figure).

## Current state

- `app/items/[codigo]/_components/tabla-desglose.tsx` — renders one section
  (I. Equipo … IV. Mano de obra) per call. Current signature:

  ```tsx
  // tabla-desglose.tsx:85-93
  export function TablaDesglose({
    componente,
    lineas,
    subtotal,
  }: {
    componente: Componente
    lineas: LineaDesglose[]
    subtotal: number
  }) {
  ```

  Column headers (lines 106–114): insumo, Unidad, cantidad/rendimiento,
  [Distancia (km)], precio, Subtotal. `columnas = config.distancia ? 6 : 5`
  (line 95) — used for the empty row and tfoot `colSpan`.

- The caller lives in `ContenidoDesglose` in
  `app/items/[codigo]/[provincia]/page.tsx` (~line 286 after the 16.3
  restructure; the page component is no longer async — content renders inside
  `<LimiteDesglose><Suspense>` and `ContenidoDesglose` returns a fragment.
  None of that structure changes in this plan):

  ```tsx
  {COMPONENTES.map((componente) => {
    const grupo = desglose.componentes.find(
      (c) => c.componente === componente
    )
    return (
      <TablaDesglose
        key={componente}
        componente={componente}
        lineas={grupo?.lineas ?? []}
        subtotal={grupo?.subtotal ?? 0}
      />
    )
  })}
  ```

  The declared direct cost is in scope there as `fila.costoDirecto` (line
  157–163). **`fila.costoDirecto === 0` means the item does not apply in the
  region** — the page still renders the desglose tables (the zero lines are
  the evidence), and in that case percentages are meaningless.

- Precedent for percentage semantics: the donut
  (`components/charts/desglose-donut.tsx:9-13`) computes shares against the
  **declared** `costoDirecto`, not the sum of lines, so a source-side rounding
  descuadre stays visible instead of being normalized away. Follow the same
  rule here.

- `lib/format.ts:78` — `formatearPorcentaje(fraccion, decimales = 1)`.

- RSC-payload convention (from the same file's sibling `tabla.tsx` and the
  page comments): shared cell styles go on the `<table>` class via
  `[&_td:nth-child(n)]` selectors, not per-cell `className`; per-row inline
  `style` is acceptable only where the value truly varies per row (the bar
  width does). Desglose tables are small (typically 3–40 lines), so this is
  cheap.

Repo conventions: Spanish-first names/copy, Prettier no-semicolons, server
components only (this file has no `"use client"` — keep it that way).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `bun run typecheck` | exit 0              |
| Lint      | `bun run lint`      | exit 0              |
| Tests     | `bun test`          | all pass            |
| Build     | `bun run build`     | exit 0              |

## Scope

**In scope**:
- `app/items/[codigo]/_components/tabla-desglose.tsx`
- `app/items/[codigo]/[provincia]/page.tsx` (pass the new prop only)

**Out of scope** (do NOT touch):
- `components/charts/desglose-donut.tsx` — stays as the component-level view.
- `app/items/[codigo]/_components/tabla-provincias.tsx` and `tabla.tsx`.
- `app/items/[codigo]/[provincia]/limite-error.tsx` and
  `app/_ui/esqueleto.tsx` — the route's error boundary and skeleton (new with
  16.3); unrelated to this change.
- `lib/format.ts`.

## Git workflow

- Branch: `advisor/004-barras-participacion-desglose`
- Single commit; short imperative message.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extend `TablaDesglose` with `costoDirecto`

Add a required prop `costoDirecto: number` (the declared direct cost of the
item in this region; the divisor for shares). Derive:

```ts
const conParticipacion = costoDirecto > 0
const columnas = (config.distancia ? 6 : 5) + (conParticipacion ? 1 : 0)
```

When `conParticipacion` is false (item "No aplica" in the region), the table
renders **exactly as today** — no new column, no bars, no "0 %".

### Step 2: Add the "Participación" column

When `conParticipacion`:

- New last `<th scope="col">Participación</th>` after "Subtotal".
- Per data row, a new last `<td>` rendering share = `linea.subtotal / costoDirecto`:
  - The number first, in text: `formatearPorcentaje(share)` — the figure must
    be selectable/copyable HTML, the bar is decoration.
  - Below/beside it the bar: a track `<div>` (e.g.
    `h-1.5 w-full max-w-24 rounded-full bg-muted`) containing a fill `<div>`
    with `aria-hidden="true"` and
    `style={{ width: `${Math.min(100, share * 100)}%` }}`, amber fill
    (`bg-amber-500 dark:bg-amber-600` — literal Tailwind classes so the
    scanner picks them up; matches the site's amber ramp).
  - Clamp: shares can legitimately exceed 100 % only on corrupt data; clamp
    the bar width at 100 but print the true percentage.
  - Lines with `subtotal === 0` print "—" (muted) and no bar.
- In the `<tfoot>` subtotal row, extend to print the component's share:
  keep the label cell at `colSpan={columnas - 2}`, then the subtotal cell,
  then a final cell with `formatearPorcentaje(subtotal / costoDirecto)` (no
  bar in the tfoot). Check the resulting cell count equals `columnas` in both
  branches (`config.distancia` true/false).
- Column alignment: the existing table class right-aligns `n+3` columns
  (`tabla-desglose.tsx:79-83`) — the new column inherits that; add
  `whitespace-nowrap` on the percentage text if needed.
- Mobile: append to the `CLASES` array visibility rules that hide the new
  column on narrow screens ONLY if the row becomes cramped in your manual
  check; otherwise leave it visible (it is the most interesting column).

### Step 3: Pass the prop from the page

In `app/items/[codigo]/[provincia]/page.tsx`, add
`costoDirecto={fila.costoDirecto}` to the `<TablaDesglose …>` call. No other
page change.

**Verify** (after steps 1–3): `bun run typecheck` → exit 0; `bun run lint` →
exit 0.

### Step 4: Build and manual check

**Verify**: `bun run build` → exit 0. `bun run dev`, then check:

- A normal desglose (pick any destacado from the home page, e.g. a 630-family
  concrete, in any province): every line shows a percentage + bar; the four
  tfoot percentages roughly match the donut/Totales band shares.
- A "No aplica" desglose (a province where the item's cost is 0 — find one
  via an item page whose table shows "No aplica" rows): tables render with NO
  participación column and no percentage anywhere.

## Test plan

The component is a server-rendered table without extracted logic; the repo has
no DOM-testing infra and this plan must not introduce one. The share math is
`linea.subtotal / costoDirecto` inline — no new pure module is warranted.
Gates: typecheck + build + the two manual checks in Step 4. Existing suite
stays green: `bun test` → all pass.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test`, `bun run build` all exit 0
- [ ] `grep -n "costoDirecto" "app/items/[codigo]/_components/tabla-desglose.tsx"` → prop declared and used
- [ ] `grep -n "Participación" "app/items/[codigo]/_components/tabla-desglose.tsx"` → header present
- [ ] No `"use client"` added (`grep -c "use client" "app/items/[codigo]/_components/tabla-desglose.tsx"` → 0)
- [ ] "No aplica" pages show no percentages (manual check, Step 4)
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `TablaDesglose`'s signature or the caller no longer match the excerpts.
- The tfoot/colSpan arithmetic can't be made to line up in both the
  with-distancia and without-distancia branches after two attempts.
- You're tempted to compute shares against the **sum of lines** instead of
  the declared `costoDirecto` to make columns add to 100 % — that violates
  the descuadre-honesty rule documented in the donut; stop and report.

## Maintenance notes

- If a future vigencia introduces a real descuadre (sum ≠ declared cost), the
  per-line percentages will not total 100 % — that is by design; the page
  already renders a descuadre warning (`TotalDesglose`,
  `app/items/[codigo]/[provincia]/page.tsx:458-469`).
- Reviewer scrutiny: colSpan counts in the empty-state row and tfoot for both
  column layouts, and that the "No aplica" branch is truly unchanged output.
- Deferred: same treatment for the item page's provincia table (140 rows,
  payload-sensitive — needs its own payload measurement before adding
  anything per-row).
