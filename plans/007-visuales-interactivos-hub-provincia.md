# Plan 007: Visuales interactivos del hub de provincia (sustituye al plan 003)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index. **Ignore plan 003 entirely** — it specified a
> server-SVG rendering that the maintainer's 2026-08-03 "visually rich"
> direction superseded; this plan is self-contained.
>
> **Drift check (run first)**: `git diff --stat d50cf63..HEAD -- "app/provincias/[slug]/page.tsx" app/_ui/regiones.ts app/_ui/capitulos.tsx components/charts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Comment-only drift from plan 005
> is expected — proceed.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (two new interactive charts + one pure data builder with edge cases)
- **Depends on**: 005 (direction/comments); supersedes 003
- **Category**: direction (visual richness)
- **Planned at**: commit `d50cf63`, 2026-08-04 (refreshed after the 16.3
  restructure — see the App Shell note in Current state)

## Why this matters

The province hub (`/provincias/[slug]`, 140 prerendered pages) is the only
content page with **zero visuals**: stat tiles, then 526 rows of tables. The
two questions a visitor actually has — *"¿es esta una provincia cara o
barata?"* and *"¿en qué capítulos se nota?"* — are unanswerable at a glance.
Both answers exist in data the page already loads. Two interactive charts fix
it: a **strip plot** placing this province among the 140 (hover any dot to
see its name/median, click to jump to it), and a **grouped bar chart** of
per-chapter medians, province vs national, with tooltips.

## Current state

- **App Shell structure (16.3 — do not disturb):** the page component is NOT
  async; it renders `<main>` + `<Suspense fallback={<EsqueletoProvincia />}>`
  + `<ProvinciaDeParams params={params} />`. All content lives in the cached
  `Contenido` (returns a fragment). Your sections go inside `Contenido`; the
  shell, skeleton, and Suspense cut are untouched. The hub's table rows now
  use `next/link` (partial prefetching) — irrelevant to this plan.

- `app/provincias/[slug]/page.tsx` — the hub. The cached `Contenido`
  component (~line 115 after the restructure) already loads both artifacts:

  ```tsx
  async function Contenido({ slug }: { slug: string }) {
    "use cache"
    cacheLife("max")
    cacheTag(ETIQUETA_VIGENCIA)

    const [resumen, catalogo] = await Promise.all([
      getProvincia(slug),
      getCatalogo(),
    ])
    if (!resumen) notFound()

    const { region, agregados } = resumen
    const capitulosPorCodigo = mapaDeCapitulos(catalogo)
    const capitulos = agruparPorCapitulo(resumen.items, (item) =>
      capitulosPorCodigo.get(item.capitulo) ?? {
        numero: Number(item.capitulo[0]),
        nombre: `Capítulo ${item.capitulo[0]}`,
      }
    )
  ```

  The stat-tiles section (`aria-label="Agregados de la provincia"`, inside
  `Contenido`) is the insertion point — new sections go right after it.

- `resumen` is a `ProvinciaResumen` (`lib/schema/artefactos.ts:175-184`):
  `region`, `agregados` (min/mediana/max/promedio), `itemsConDato`,
  `items: ProvinciaItem[]`; each `ProvinciaItem` (lines 163–169) has `codigo`,
  `titulo`, `unidad`, `capitulo` (3-digit string), `costoDirecto`.
  **`costoDirecto === 0` means "no aplica en esta región" (FORMATO.md §6.5) —
  it must be EXCLUDED from every median, never averaged in, and never drawn
  as a $0 bar.**

- `catalogo.items` are `CatalogoItem`s with `capitulo`, `capituloNumero?`,
  `capituloNombre?`, and `costoDirecto.mediana` (national median per item).

- `app/_ui/regiones.ts:44-64` — `listarProvincias(): Promise<ProvinciaListada[]>`
  (cached) returns all 140 `{ region, mediana, itemsConDato }`. Import path
  from the hub: `"../../_ui/regiones"`. Its private `mediana()` helper
  (lines 88–96) is NOT exported — write your own 5-line median in the new
  builder module (sort ascending; middle element, or mean of two middles for
  even length; 0 for empty).

- `app/_ui/capitulos.tsx` — `mapaDeCapitulos(catalogo)`, `idCapitulo(numero)`
  (the hub's chapter sections use `id={idCapitulo(n)}` anchors).

- Chart conventions (copy them): `components/charts/desglose-donut.tsx` —
  `"use client"`, library-agnostic props, shadcn `ChartContainer` +
  `ChartTooltip`, config colors `var(--chart-N)`, `<figure>`/`<figcaption>`
  wrapper. Lazy islands via `components/charts/lazy.tsx` (`dynamic(...,
  { ssr: false, loading: () => <EsqueletoGrafico altura={N} /> })`).

Repo conventions: Spanish-first names/copy; Prettier no-semicolons; every
price surface labeled **costo directo de referencia, sin AIU**; the page's
`ProcedenciaBox` stays at the bottom.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `bun run typecheck` | exit 0              |
| Lint      | `bun run lint`      | exit 0              |
| Tests     | `bun test`          | all pass            |
| Build     | `bun run build`     | exit 0 (prerenders all 140 hubs) |

## Scope

**In scope**:
- `components/charts/franja-provincias.tsx` (create — client chart)
- `components/charts/capitulos-barras.tsx` (create — client chart)
- `components/charts/lazy.tsx` (add two lazy exports)
- `app/provincias/[slug]/_components/comparar-capitulos.ts` (create — pure
  data builder, server-safe, no JSX)
- `app/provincias/[slug]/_components/comparar-capitulos.test.ts` (create)
- `app/provincias/[slug]/page.tsx` (wire in)

**Out of scope** (do NOT touch):
- `app/_ui/regiones.ts`, `app/_ui/capitulos.tsx` — import only.
- `components/charts/precio-bar.tsx`, `desglose-donut.tsx`,
  `components/map/colombia-tile-map.tsx`.
- The hub's tables and chip nav.
- `app/_ui/esqueleto.tsx` and the page's `EsqueletoProvincia`/
  `ProvinciaDeParams`/`Page` shell structure — 16.3 App Shell machinery.

## Git workflow

- Branch: `advisor/007-visuales-hub-provincia`
- Commit per component; short imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Pure builder `compararCapitulos`

Create `app/provincias/[slug]/_components/comparar-capitulos.ts` exporting:

```ts
export type CapituloComparado = {
  numero: number
  nombre: string
  medianaProvincia: number   // 0 ⇒ ningún ítem aplica en la provincia
  medianaNacional: number
  conDato: number            // ítems con dato en la provincia
  total: number              // ítems del capítulo
}

export function compararCapitulos(
  items: readonly ProvinciaItem[],
  catalogo: Catalogo
): CapituloComparado[]
```

Rules (load-bearing — implement exactly):

- Group the province's items by constructive chapter with
  `mapaDeCapitulos(catalogo)`, fallback `Number(item.capitulo[0])` /
  `` `Capítulo ${item.capitulo[0]}` `` (the same fallback `Contenido` uses
  when it builds `capitulos` — copy it from there).
- `medianaProvincia`: median over the chapter's items **with
  `costoDirecto > 0` only**; 0 when none apply.
- `medianaNacional`: median over `catalogo.items` of that chapter of
  `item.costoDirecto.mediana`, restricted to **the same item codes that have
  data in the province** (apples-to-apples — otherwise a chapter where only
  cheap items apply looks artificially cheap). When the province chapter has
  no items with data, fall back to all chapter items.
- Local median helper as described in Current state. Sort output by `numero`
  ascending.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: `FranjaProvincias` — interactive strip plot

Create `components/charts/franja-provincias.tsx`, `"use client"`,
library-agnostic props:

```ts
export type PuntoFranja = {
  slug: string
  provincia: string
  departamento: string
  mediana: number
}

export type FranjaProvinciasProps = {
  puntos: PuntoFranja[]        // las 140
  slugActual: string
  unidad?: string
  titulo?: string
  descripcion?: string
  className?: string
  altura?: number              // default 96
}
```

Rendering with recharts `ScatterChart` inside `ChartContainer` (height ≈ 96):

- All points at a constant y (e.g. `y: 0`), x = `mediana`; numeric `XAxis`
  with `formatearCOP` ticks (3–4 ticks), `YAxis` hidden
  (`type="number" hide domain={[-1, 1]}`).
- Two `Scatter` series from the same array split by
  `slug === slugActual`: the rest (`fill: var(--chart-2)`, `fillOpacity`
  ~0.55, r≈4) and the current province drawn after (bigger r≈7,
  `var(--chart-4)`).
- `ChartTooltip` showing `{provincia} ({departamento})` +
  `{formatearCOP(mediana)}` (+ `/{unidad}` when given).
- Click a dot → `router.push(`/provincias/${punto.slug}`)`; cursor pointer.
- Below the chart, in plain HTML (this figure must survive without JS):
  "**{provincia actual}: puesto {p} de {n}** por mediana del costo directo
  (de más barata a más cara)." Export the rank as a pure helper in the same
  file: `puesto(puntos, slugActual): { puesto: number; total: number } | null`
  (sort ascending by mediana; rank = index + 1; `null` when slug missing →
  component renders nothing). Points with `mediana <= 0` are dropped before
  ranking and plotting (defensive).

**Verify**: `bun run typecheck` → exit 0.

### Step 3: `CapitulosBarras` — grouped bars, provincia vs nacional

Create `components/charts/capitulos-barras.tsx`, `"use client"`. Props:
`{ capitulos: CapituloComparado[], titulo?, descripcion?, className? }`
(import the type from the builder module — type-only import keeps the client
bundle clean).

- Horizontal `BarChart` (`layout="vertical"`), `YAxis` category =
  `"${numero} ${nombre}"` (width ≈ 150, tick font small), two `<Bar>` series:
  `medianaProvincia` (`var(--chart-1)`, label "Esta provincia") and
  `medianaNacional` (`var(--chart-3)`, label "Mediana nacional");
  `ChartLegend` + `ChartLegendContent` (see `desglose-donut.tsx:115-117`).
- Height: `capitulos.length * 44 + 40` (≈ 10 chapters → ~480 px).
- Tooltip formatter: value as `formatearCOP`, plus the coverage line
  "{conDato} de {total} ítems con dato" (the tooltip receives the row datum —
  follow the formatter-with-payload pattern; recharts passes `item.payload`).
- Chapters with `medianaProvincia === 0` keep their national bar but render
  the provincial value in the tooltip as "No aplica aquí" — never a $0 bar
  (pass the datum through and branch in the formatter; the bar for value 0
  naturally has zero length, which is acceptable ONLY because the tooltip and
  legend never present it as a price — do not label it `$ 0`).

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 4: Lazy exports

In `components/charts/lazy.tsx`, add `FranjaProvinciasLazy` (altura 96) and
`CapitulosBarrasLazy` (altura 480), following the existing `dynamic` pattern
exactly; re-export the prop types.

**Verify**: `bun run typecheck` → exit 0.

### Step 5: Wire into the hub

In `Contenido` (`app/provincias/[slug]/page.tsx`):

- Add `listarProvincias()` to the `Promise.all` (import from
  `"../../_ui/regiones"`); map its result to `PuntoFranja[]`.
- After the stat-tiles section insert two sections (headings in Spanish,
  each with a one-line muted caption ending in "Costo directo de referencia,
  sin AIU."):

  ```tsx
  <section aria-label="Posición nacional" className="space-y-2">
    <h2 className="text-lg font-medium">Posición entre las 140 provincias</h2>
    <FranjaProvinciasLazy puntos={puntos} slugActual={slug} … />
  </section>

  <section aria-label="Capítulos frente a la mediana nacional" className="space-y-2">
    <h2 className="text-lg font-medium">Capítulos frente a la mediana nacional</h2>
    <CapitulosBarrasLazy capitulos={compararCapitulos(resumen.items, catalogo)} … />
  </section>
  ```

- Payload note: `puntos` is 140 × 4 small fields ≈ 8–10 kB serialized — fine.
  Do NOT pass `resumen.items` (526 rows) to any client component; only the
  ~10-row `CapituloComparado[]` output crosses the boundary.

**Verify**: `bun run build` → exit 0. `bun run dev`: check the most expensive
and cheapest provinces (home page "notables" cards link to both) — the big
dot sits at opposite ends; hover dots elsewhere names other provinces;
clicking one navigates; a chapter with no applicable items shows "No aplica
aquí" in its tooltip.

## Test plan

New test file `comparar-capitulos.test.ts` (bun test; `describe`/`test`/
`expect` from `bun:test`; fixture literals — see
`lib/schema/artefactos.test.ts:44-100` for valid object shapes):

- zeros excluded from `medianaProvincia`,
- chapter with all zeros → `medianaProvincia === 0` + national fallback to
  all chapter items,
- national median restricted to province-applicable codes,
- fallback chapter naming when `capituloNumero` is absent,
- output sorted by `numero`.

Also test `puesto()` (exported from `franja-provincias.tsx` — pure, no DOM):
rank 1 for cheapest, N for dearest, `null` for unknown slug.

Verification: `bun test` → all pass including the new files.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test`, `bun run build` all exit 0
- [ ] Hub renders both lazy charts (`grep -c "FranjaProvinciasLazy\|CapitulosBarrasLazy" "app/provincias/[slug]/page.tsx"` → ≥ 2)
- [ ] No 526-row prop crosses to a client component (code review of Step 5)
- [ ] "No aplica" never presented as `$ 0` (test + tooltip branch review)
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md`: this row updated AND plan 003 row marked SUPERSEDED

## STOP conditions

Stop and report back if:

- `ProvinciaResumen`/`Catalogo`/`listarProvincias` shapes differ from the
  excerpts.
- Recharts `ScatterChart` tooltips or per-point click payloads fight you for
  more than two attempts (check installed types first) — report; a custom SVG
  strip with a client overlay would be a redesign decision.
- Build time for the 140 hubs grows by more than ~2× versus a baseline build
  run BEFORE your change.

## Maintenance notes

- Plan 003 specified the same two visuals as server-SVG/CSS; it is superseded,
  not executed. Its data rules live on here (the builder + "No aplica" rules).
- If "diffs entre vigencias" lands, `FranjaProvincias` can show movement
  (two dots per province) — keep props library-agnostic (plan 009 spike may
  swap the renderer).
- Reviewer scrutiny: the apples-to-apples restriction in `medianaNacional`,
  and the client-boundary payload (only slim arrays cross).
