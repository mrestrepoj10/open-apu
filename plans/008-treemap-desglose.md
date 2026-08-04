# Plan 008: Treemap del costo en la página de desglose

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d50cf63..HEAD -- "app/items/[codigo]/[provincia]/page.tsx" components/charts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Comment-only drift from 005 and
> the participación column from plan 004 are expected — proceed.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (recharts Treemap is the least-worn API in the library)
- **Depends on**: 004 (both edit the desglose page — land 004 first to avoid
  rebase churn; no logical dependency)
- **Category**: direction (visual richness)
- **Planned at**: commit `d50cf63`, 2026-08-04 (refreshed after the 16.3
  restructure — see the App Shell note in Current state)

## Why this matters

The desglose page lists every line of an APU across four tables, and the
donut shows the four component shares — but nothing shows the **line-level
cost structure in one picture**: that one material is 40 % of the whole APU,
that equipment is fragmented across eight small lines. A treemap of all lines,
sized by subtotal and colored by component (matching the donut's colors),
is the single most information-dense visual this page can add, and it is the
kind of view no .xlsx gives — exactly the "visually rich" differentiator the
maintainer set on 2026-08-03.

## Current state

- **App Shell structure (16.3 — do not disturb):** the page component is NOT
  async; content renders inside `<LimiteDesglose><Suspense fallback=…>` and
  the cached `ContenidoDesglose` returns a fragment. Your section goes inside
  `ContenidoDesglose`; shell, skeleton, and error boundary stay untouched.

- `app/items/[codigo]/[provincia]/page.tsx` — the desglose page. Data in
  scope inside `ContenidoDesglose` (~line 204): `desglose` (grouped lines),
  `fila` (the province row with `costoDirecto` and `totales`), `item`
  (unidad, vigencia). The donut section (~line 312) renders only when
  `fila.costoDirecto > 0`:

  ```tsx
  {fila.costoDirecto > 0 ? (
    <section aria-label="Participación por componente" className="space-y-2">
      <h2 className="text-lg font-medium">Participación por componente</h2>
      <DesgloseDonutLazy … />
    </section>
  ) : null}
  ```

- `Desglose` shape (`lib/data/desglose.ts`, re-exported from `lib/data`):
  `desglose.componentes: ComponenteDesglose[]` — each
  `{ componente, subtotal, lineas: LineaDesglose[] }`; each `LineaDesglose`
  has `descripcion`, `codigo?`, `unidad`, `cantidad`, `precioUnitario`,
  `subtotal`, `porcentaje?`, … (see the type in `lib/data/desglose.ts`; the
  fields used here are `descripcion` and `subtotal` only).

- Component order and labels: `COMPONENTES` from `lib/schema` (equipo,
  materiales, transporte, manoDeObra); Spanish titles in `CONFIG`
  (`app/items/[codigo]/_components/tabla-desglose.tsx:46-77` — "I. Equipo"…).

- Color mapping to copy exactly (donut config,
  `components/charts/desglose-donut.tsx:40-46`):

  ```ts
  equipo: var(--chart-1) · materiales: var(--chart-2) ·
  transporte: var(--chart-3) · manoDeObra: var(--chart-4)
  ```

- Share semantics (donut doc comment, lines 9–13): percentages are computed
  against the **declared** `costoDirecto`, not the sum of lines, so a
  source-side rounding descuadre stays visible. Same rule here.

- Lazy-island pattern: `components/charts/lazy.tsx` (`dynamic(...,
  { ssr: false, loading: () => <EsqueletoGrafico altura={N} /> })`).

Repo conventions: Spanish-first; Prettier no-semicolons; **costo directo, sin
AIU** labeling; `costoDirecto === 0` ⇒ the section is omitted entirely (same
condition as the donut — a treemap of zeros is FORMATO.md §6.5 territory).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `bun run typecheck` | exit 0              |
| Lint      | `bun run lint`      | exit 0              |
| Tests     | `bun test`          | all pass            |
| Build     | `bun run build`     | exit 0              |

## Scope

**In scope**:
- `components/charts/desglose-treemap.tsx` (create — client component)
- `components/charts/lazy.tsx` (add `DesgloseTreemapLazy`)
- `app/items/[codigo]/[provincia]/page.tsx` (add the section)

**Out of scope** (do NOT touch):
- `components/charts/desglose-donut.tsx` — the donut stays (component-level
  summary; the treemap is line-level).
- `app/items/[codigo]/_components/tabla-desglose.tsx` (plan 004's file).
- `app/items/[codigo]/[provincia]/limite-error.tsx` and
  `app/_ui/esqueleto.tsx` — the route's 16.3 error boundary and skeleton.
- `lib/data/desglose.ts`.

## Git workflow

- Branch: `advisor/008-treemap-desglose`
- Commit per step; short imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `DesgloseTreemap` component

Create `components/charts/desglose-treemap.tsx`, `"use client"`, Spanish doc
comment. Library-agnostic props:

```ts
export type LineaTreemap = {
  descripcion: string
  componente: Componente        // from "@/lib/schema" (type-only import)
  subtotal: number              // > 0 garantizado por el llamador
}

export type DesgloseTreemapProps = {
  lineas: LineaTreemap[]
  /** Costo directo declarado — divisor de los porcentajes (regla del donut). */
  costoDirecto: number
  unidad: string
  titulo?: string
  descripcion?: string
  className?: string
  altura?: number               // default 340
}
```

Implementation with recharts `Treemap` inside shadcn `ChartContainer`:

- `data` = one node per line: `{ name: descripcion, size: subtotal, fill:
  var(--color-<componente>) }` with a `ChartConfig` mirroring the donut's
  component colors and labels (copy the config object shape from
  `desglose-donut.tsx:40-46`).
- Flat treemap (no nesting): recharts' `Treemap` takes `dataKey="size"`.
  Check the installed types (`node_modules/recharts/types/chart/Treemap.d.ts`)
  before coding — the `content` prop takes a custom cell renderer; use it to
  draw `<rect>` + a `<text>` label ONLY when the cell is big enough
  (`width > 60 && height > 24`), truncated with an ellipsis. Small cells stay
  unlabeled — the tooltip covers them.
- `ChartTooltip` with a formatter showing: the line's `descripcion`, the
  component label (Equipo/Materiales/Transporte/Mano de obra),
  `formatearCOP(subtotal)` and `formatearPorcentaje(subtotal / costoDirecto)`.
- `<figure>`/`<figcaption>` wrapper (pattern: `desglose-donut.tsx:67-75`);
  caption slot for the page's description text.
- A compact legend of the four components (reuse `ChartLegend`/`
  ChartLegendContent` if wiring allows on Treemap; otherwise four static
  `<span>` chips with the component colors — chips are acceptable).

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Lazy export

Add to `components/charts/lazy.tsx`:
`DesgloseTreemapLazy` (altura 340), same `dynamic` pattern; re-export types.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Add the section to the desglose page

In `ContenidoDesglose`, directly BEFORE the existing donut section, add
(inside the same `fila.costoDirecto > 0` style of guard):

```tsx
{fila.costoDirecto > 0 ? (
  <section aria-label="Mapa del costo" className="space-y-2">
    <h2 className="text-lg font-medium">Mapa del costo</h2>
    <DesgloseTreemapLazy
      lineas={lineas}
      costoDirecto={fila.costoDirecto}
      unidad={item.unidad}
      descripcion={`Cada rectángulo es una línea del análisis; el área es su
        peso en el costo directo. ${region.provincia}, ${region.departamento}
        · vigencia ${item.vigencia} · costo directo, sin AIU.`}
    />
  </section>
) : null}
```

where `lineas` flattens the grouped desglose, **excluding zero lines**:

```tsx
const lineas = desglose.componentes.flatMap((grupo) =>
  grupo.lineas
    .filter((linea) => linea.subtotal > 0)
    .map((linea) => ({
      descripcion: linea.descripcion,
      componente: grupo.componente,
      subtotal: linea.subtotal,
    }))
)
```

Guard additionally on `lineas.length > 0`. Note the payload: this is the
first time line-level data crosses to the client on this page — it's ~5–40
slim rows, a few kB; do not pass the full `LineaDesglose` objects.

**Verify**: `bun run lint` → exit 0; `bun run typecheck` → exit 0.

### Step 4: Build and manual check

**Verify**: `bun run build` → exit 0. `bun run dev`, open a destacado's
desglose (home → ítem destacado → any provincia → Desglose): treemap renders
with four color families visually consistent with the donut below it; the
biggest rectangle's tooltip percentage matches its row in plan 004's
Participación column (if 004 landed); a "No aplica" desglose (costo 0) shows
NO treemap section. Dark mode: colors flip via CSS vars.

## Test plan

The flatten/filter in Step 3 is inline page logic exercised by the build
(4 200 desglose pages prerender); no test infra exists for DOM. Existing
suite green: `bun test` → all pass. If you extract the flatten into a pure
helper, colocate a small test for the zero-exclusion — optional.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test`, `bun run build` all exit 0
- [ ] `grep -n "DesgloseTreemapLazy" "app/items/[codigo]/[provincia]/page.tsx"` → import + usage inside a `costoDirecto > 0` guard
- [ ] Zero-subtotal lines excluded (the `> 0` filter present)
- [ ] Component colors identical to the donut config (code review)
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Recharts 3.8's `Treemap` `content`/tooltip wiring doesn't behave per its
  types after two real attempts — report what you observed; falling back to a
  CSS-grid "waffle" would be a redesign decision, not yours.
- `Desglose`/`LineaDesglose` shapes differ from Current state.
- The treemap section would render for `costoDirecto === 0` under any path.

## Maintenance notes

- The donut may eventually be redundant next to the treemap + Totales band —
  removing it is a maintainer call, deliberately NOT part of this plan.
- Plan 009's spike may later swap the renderer; the `LineaTreemap` props are
  the stable surface.
- Reviewer scrutiny: percentages divide by declared `costoDirecto` (descuadre
  honesty), and long INVIAS descriptions truncate in cells but appear FULL in
  the tooltip.
