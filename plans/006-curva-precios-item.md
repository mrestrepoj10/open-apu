# Plan 006: Curva de precios interactiva de las 140 provincias en la página de ítem

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d50cf63..HEAD -- "app/items/[codigo]/page.tsx" components/charts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Exception: comment-only changes
> from plan 005 are expected — proceed.)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (140-element recharts chart; interaction + navigation)
- **Depends on**: 005 (comment updates touch the same file; land 005 first)
- **Category**: direction (visual richness)
- **Planned at**: commit `d50cf63`, 2026-08-04 (refreshed after the 16.3
  restructure — see the App Shell note in Current state)

## Why this matters

The item page is the site's main SEO surface (526 prerendered pages) and its
only chart today shows a **21-province cut** (top 15, bottom 5, the median
one) of the 140 available values. Under the "visually rich" direction
(AGENTS.md Goal, once plan 005 lands) this is the flagship upgrade: one
interactive chart showing the **whole national price curve** — all provinces
with data, sorted — with hover tooltips naming each province and click-through
to that province's desglose. The full table below remains the exhaustive/no-JS
record; the chart becomes the fast way to *see* the dispersion.

## Current state

- **App Shell structure (16.3 — do not disturb):** the page component is NOT
  async; it renders `<main>` + `<Suspense fallback={<EsqueletoItem />}>` +
  `<ItemDeParams params={params} />`, and all content lives in the cached
  `ContenidoItem` (returns a fragment). Your change stays entirely inside
  `GraficoRegional`, which `ContenidoItem` renders — the shell, skeleton, and
  Suspense cut are untouched.

- `GraficoRegional` in `app/items/[codigo]/page.tsx` (~line 345 after the
  restructure) — the component to rework. Today it filters `item.regiones` to
  `costoDirecto > 0`, sorts descending, selects the 21-element cut, and
  renders:

  ```tsx
  // page.tsx:326-340
  <section aria-label="Dispersión regional" className="space-y-2">
    <h2 className="text-lg font-medium">Dispersión regional</h2>
    <PrecioBarLazy
      datos={datos}
      unidad={item.unidad}
      descripcion={ /* … "Se omiten N provincias intermedias" … */ }
    />
  </section>
  ```

- `components/charts/precio-bar.tsx` — the existing horizontal bar chart. Its
  height grows 28 px per bar (`ALTO_POR_BARRA`, line 51), which is exactly why
  it can't take 140 rows (≈ 4 000 px tall). Leave this component alone — the
  hub or other surfaces may still use it; the new chart is a separate file.

- `components/charts/lazy.tsx` — the lazy-island pattern every chart follows:
  a `"use client"` module exporting `dynamic(() => import(...), { ssr: false,
  loading: () => <EsqueletoGrafico altura={N} /> })`. Add the new chart here
  the same way (`CurvaPreciosLazy`).

- `components/charts/desglose-donut.tsx:4-13` — the API convention to copy:
  "la API no expone recharts … se puede cambiar sin tocar las páginas".
  Props take plain data; recharts is an implementation detail.

- `components/ui/chart.tsx` — shadcn `ChartContainer` / `ChartTooltip` /
  `ChartTooltipContent`; config colors via `var(--chart-N)` (amber ramp
  defined in `app/globals.css:27-31`).

- Each `ItemRegion` (`lib/schema/artefactos.ts:118-122`) carries
  `region: { slug, provincia, departamento, … }`, `totales`, `costoDirecto` —
  so the chart rows can carry the slug needed for click-navigation.

Repo conventions: Spanish-first names/copy; Prettier no-semicolons; every
price surface labeled **costo directo, sin AIU**; `costoDirecto === 0` rows
("No aplica") are excluded from charts, never drawn as zero-height bars.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `bun run typecheck` | exit 0              |
| Lint      | `bun run lint`      | exit 0              |
| Tests     | `bun test`          | all pass            |
| Build     | `bun run build`     | exit 0              |

## Suggested executor toolkit

- `vercel:shadcn` skill for ChartContainer composition details;
  `vercel-react-best-practices` for the client component.
- Recharts 3.8 is installed — check `node_modules/recharts` types if an API
  seems off; do not upgrade it.

## Scope

**In scope**:
- `components/charts/curva-precios.tsx` (create — client component)
- `components/charts/lazy.tsx` (add `CurvaPreciosLazy` export)
- `app/items/[codigo]/page.tsx` (rework `GraficoRegional` only)

**Out of scope** (do NOT touch):
- `components/charts/precio-bar.tsx` and `desglose-donut.tsx`
- `app/items/[codigo]/_components/tabla-provincias.tsx` — the table stays the
  exhaustive record
- `components/map/colombia-tile-map.tsx`
- `app/_ui/esqueleto.tsx` and the page's `EsqueletoItem`/`ItemDeParams`/
  `Page` shell structure — 16.3 App Shell machinery, unrelated

## Git workflow

- Branch: `advisor/006-curva-precios-item`
- Commit per step; short imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `CurvaPrecios` component

Create `components/charts/curva-precios.tsx`, `"use client"`, doc comment in
Spanish. Library-agnostic props:

```ts
export type PuntoCurva = {
  slug: string
  provincia: string
  departamento: string
  valor: number        // costo directo en COP; siempre > 0
}

export type CurvaPreciosProps = {
  /** Provincias con dato, YA ordenadas ascendente por valor. */
  datos: PuntoCurva[]
  unidad: string
  /** Mediana nacional — se dibuja como línea de referencia. */
  mediana: number
  /** Al hacer clic en una barra se navega aquí. */
  href?: (punto: PuntoCurva) => string
  titulo?: string
  descripcion?: string
  className?: string
  altura?: number      // default 300
}
```

Rendering (recharts inside shadcn `ChartContainer`, fixed height ≈ 300 px):

- **Vertical** `BarChart` (default layout), one thin bar per province,
  `datos.length` ≤ 140. No gap styling needed beyond recharts defaults;
  `radius={2}`.
- `XAxis`: category by `provincia`, **ticks hidden** (140 labels can't fit) —
  the axis line only. `YAxis`: numeric, tick formatter `formatearCOP`
  compacted (use `formatearNumero(valor / 1e6)` + " M" style ONLY if labels
  collide; start with plain `formatearCOP` and small font).
- `ReferenceLine y={mediana}` with a right-aligned label "mediana nacional"
  (`className="text-xs"`, stroke `var(--chart-4)`, dashed).
- Fill `var(--color-valor)` via config `{ valor: { label: "Costo directo",
  color: "var(--chart-1)" } }`; highest and lowest bar MAY use `var(--chart-4)`
  via `<Cell>` to anchor the eye (optional, cheap).
- `ChartTooltip` with `ChartTooltipContent` formatter showing:
  `{provincia} ({departamento})` and `{formatearCOP(valor)}/{unidad}` —
  follow the formatter pattern in `precio-bar.tsx:96-110`.
- Click-through: when `href` is set, `onClick` on the `<Bar>` (recharts passes
  the datum) calls `router.push(href(punto))` (`useRouter` from
  `next/navigation`) and the chart root gets `cursor-pointer` on bars
  (recharts `cursor` prop or CSS). Also set `role="img"` +
  `aria-label={titulo}` on the figure; note in the doc comment that keyboard
  users have the table below (the chart is a duplicate view, not the only
  path — this is why bar-level tab stops are not required).
- `<figure>`/`<figcaption>` wrapper like `precio-bar.tsx:66-74`.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Lazy export

In `components/charts/lazy.tsx` add, following the existing pattern exactly:

```tsx
export const CurvaPreciosLazy = dynamic(
  () => import("./curva-precios").then((mod) => mod.CurvaPrecios),
  { ssr: false, loading: () => <EsqueletoGrafico altura={300} /> }
)
```

and re-export its types.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Rework `GraficoRegional` in the item page

Replace the 21-element selection logic inside `GraficoRegional` (the
`iMediana` reduce, the `elegidos` set, the `omitidas` math) with:

```tsx
const datos = item.regiones
  .filter((fila) => fila.costoDirecto > 0)
  .sort((a, b) => a.costoDirecto - b.costoDirecto)
  .map((fila) => ({
    slug: fila.region.slug,
    provincia: fila.region.provincia,
    departamento: fila.region.departamento,
    valor: fila.costoDirecto,
  }))
```

Render `CurvaPreciosLazy` with `mediana={item.agregados.mediana}`,
`unidad={item.unidad}`, `href={(p) => `/items/${item.codigo}/${p.slug}`}`,
and a description equivalent to: "Las {N} provincias con dato, de la más
barata a la más cara; la línea marca la mediana nacional. Toca una barra para
abrir el desglose. Costo directo, sin AIU." Keep the `conDato.length === 0 →
return null` guard. Switch the import from `PrecioBarLazy` to
`CurvaPreciosLazy`; if `PrecioBarLazy` is then unused in this file, remove
the import (the component file itself stays).

**Verify**: `bun run lint` → exit 0 (catches the unused import);
`bun run typecheck` → exit 0.

### Step 4: Build and manual check

**Verify**: `bun run build` → exit 0. `bun run dev`, open a well-covered item
(e.g. any 630-family destacado from the home page): ~140 bars render sorted
ascending, hover names province + department + price, the reference line sits
at the mediana from the Agregados band above, clicking a bar navigates to
`/items/{codigo}/{slug}`. Check one partial-coverage item (catalog rows
showing "no aplica en todas") — bar count equals its `provinciasConDato`.
Check dark mode (amber ramp flips correctly via CSS vars).

## Test plan

No DOM test infra exists; don't add any. The new page-side mapping is a
straight filter/sort/map with no branches worth a unit test beyond what
`bun run build` (prerendering all 526 items) already exercises. Existing
suite stays green: `bun test` → all pass.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test`, `bun run build` all exit 0
- [ ] `grep -n "CurvaPreciosLazy" "app/items/[codigo]/page.tsx"` → import + usage
- [ ] `grep -n "omitidas" "app/items/[codigo]/page.tsx"` → no matches (cut logic gone)
- [ ] `grep -c "use client" components/charts/curva-precios.tsx` → 1
- [ ] Zero-cost provinces excluded (code review: the `> 0` filter)
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- 140 bars visibly janks hover interaction in dev (report; a `ScatterChart`
  strip or downsampled ticks would be a redesign decision, not yours).
- Recharts 3.8's `Bar` onClick does not deliver the datum payload after two
  attempts (check its types first).
- `GraficoRegional`'s code no longer matches the excerpt beyond plan 005's
  comment edits.

## Maintenance notes

- The `PuntoCurva`/`href` API is deliberately library-agnostic — plan 009's
  TanStack Charts spike rebuilds THIS chart as its benchmark; keep the props
  stable.
- If "diffs entre vigencias" (BACKLOG) lands, this chart is where a second
  vigencia's curve would overlay.
- Reviewer scrutiny: the sort is ascending (curve reads left-cheap →
  right-expensive) and the tooltip price carries `/{unidad}` — a bare peso
  figure would violate the provenance spirit.
