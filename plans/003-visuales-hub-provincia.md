# Plan 003: Capa visual del hub de provincia (`/provincias/[slug]`)

> **⚠️ SUPERSEDED (2026-08-03, same day as written): do not execute.**
> The maintainer set a "visually rich" direction that revokes this plan's
> core rendering constraint (server-only SVG/CSS, zero client JS for charts).
> The same two visuals are re-specified as interactive charts in
> `plans/007-visuales-interactivos-hub-provincia.md`, which also carries over
> this plan's data rules (`compararCapitulos`, "No aplica" handling). This
> file is kept for the rationale record only.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3a29f98..HEAD -- app/provincias/[slug]/page.tsx app/_ui/regiones.ts app/_ui/capitulos.tsx components/charts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (new server-SVG component; math must respect "No aplica" zeros)
- **Depends on**: none (001 is unrelated; can land in any order)
- **Category**: direction (visual)
- **Planned at**: commit `3a29f98`, 2026-08-03

## Why this matters

The province hub is the only content page with **zero visuals**: stat tiles,
then 526 rows of tables. The two questions a visitor has — *"¿es esta una
provincia cara o barata?"* and *"¿en qué capítulos se nota?"* — are exactly
the ones a table can't answer at a glance. All the data needed is already
loaded by the page or one import away, and both visuals can be **server-rendered
SVG/HTML with zero client JavaScript**, matching the repo's static-first rule
(numbers live in server HTML; charts are enhancement, never the source of the
figure — see the doc comment in `app/items/[codigo]/page.tsx:8-13`).

Two additions:

1. **Franja de posición** — a strip plot of the 140 province medians with this
   province highlighted: one glance answers "where does it sit nationally".
2. **Comparación por capítulo** — per-chapter median (this province vs national),
   as paired horizontal HTML bars: shows *which* kinds of work drive the gap.

## Current state

- `app/provincias/[slug]/page.tsx` — the hub. The cached `Contenido` component
  already loads both artifacts:

  ```tsx
  // app/provincias/[slug]/page.tsx:71-93
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
    const capitulos = agruparPorCapitulo(resumen.items, ...)
  ```

  The stat tiles section (`aria-label="Agregados de la provincia"`, lines
  144–162) is where the new visuals go right after.

- `resumen` is a `ProvinciaResumen` (`lib/schema/artefactos.ts:175-184`):
  `region`, `agregados` (min/mediana/max/promedio), `itemsConDato`,
  `items: ProvinciaItem[]` where each item has `codigo`, `titulo`, `unidad`,
  `capitulo` (3-digit string), `costoDirecto`. **A `costoDirecto` of 0 means
  "no aplica en esta región" (FORMATO.md §6.5) — it must be EXCLUDED from
  every median/aggregate, never averaged in.**

- `catalogo.items` are `CatalogoItem`s with `capitulo`, `capituloNumero?`,
  `capituloNombre?` and `costoDirecto.mediana` (the national median per item).

- `app/_ui/regiones.ts:44-64` — `listarProvincias(): Promise<ProvinciaListada[]>`,
  cached, returns all 140 `{ region, mediana, itemsConDato }`. Import path from
  the hub: `"../../_ui/regiones"`. It reads the same 140 JSON files the hubs
  already read, so within a build the cache serves them once (its own doc
  comment says so).

- `app/_ui/regiones.ts:88-96` has a private `mediana(valores)` helper — it is
  NOT exported. You will need a median; either export it from `regiones.ts`…
  no: `regiones.ts` is out of scope. Write the median inside the new chart
  helper module instead (5 lines, same algorithm).

- `components/map/colombia-tile-map.tsx` — the repo's exemplar for a
  **server-component SVG visual**: plain SVG, native `<title>` tooltips,
  Tailwind classes on SVG elements, `role="img"` + `aria-label`, a
  `<figcaption>` legend. Follow its style.

- Chart color tokens exist in `app/globals.css` (`--chart-1` … `--chart-5`,
  amber ramp, light and dark). For server SVG, prefer semantic Tailwind
  classes like the tile map does (`fill-amber-500 dark:fill-amber-600`,
  `stroke-border`, `fill-muted-foreground`) — literal classes so Tailwind's
  scanner sees them.

Repo conventions that apply:

- Spanish-first naming and copy; Prettier no-semicolons.
- Non-negotiable 1/2: label both visuals as **costo directo de referencia,
  sin AIU**; the page's `ProcedenciaBox` at the bottom stays.
- No client JS for these — server components only. No recharts here (recharts
  is lazy-loaded and below-the-fold on item/desglose pages only; a hub is a
  lighter page and these two visuals don't need interactivity).
- Payload discipline: 140 SVG dots is fine; avoid per-element repeated long
  class strings (hoist shared styling to the parent where possible, as the
  big tables do).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `bun run typecheck` | exit 0              |
| Lint      | `bun run lint`      | exit 0              |
| Tests     | `bun test`          | all pass            |
| Build     | `bun run build`     | exit 0              |

## Scope

**In scope**:
- `components/charts/franja-provincias.tsx` (create — server component)
- `components/charts/franja-provincias.test.ts` (create — tests for the pure
  helpers; keep helpers exported)
- `app/provincias/[slug]/_components/capitulos-comparados.tsx` (create —
  server component, HTML bars)
- `app/provincias/[slug]/_components/capitulos-comparados.test.ts` (create)
- `app/provincias/[slug]/page.tsx` (wire both in)

**Out of scope** (do NOT touch):
- `app/_ui/regiones.ts` — import it, don't modify it.
- `components/charts/lazy.tsx`, `precio-bar.tsx`, `desglose-donut.tsx` —
  recharts components, unrelated.
- `components/map/colombia-tile-map.tsx` — style reference only.
- The hub's tables and chip nav.

## Git workflow

- Branch: `advisor/003-visuales-hub-provincia`
- Commit per component; short imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `FranjaProvincias` — strip plot of the 140 medians

Create `components/charts/franja-provincias.tsx`, a **server** component
(no `"use client"`). Doc comment in Spanish explaining what it shows and that
it renders as static SVG (follow the tile map's comment style).

Props:

```ts
export type FranjaProvinciasProps = {
  /** Las 140 provincias con su mediana (de listarProvincias()). */
  provincias: readonly { region: Region; mediana: number }[]
  /** Slug de la provincia destacada. */
  slugActual: string
  formatear?: (valor: number) => string   // default formatearNumero
  titulo?: string
  className?: string
}
```

Rendering spec:

- A horizontal band, `viewBox` roughly `0 0 320 44`: a baseline axis, one
  vertical tick (line, e.g. `y` 14→30, `strokeWidth` 1.5, rounded caps,
  `className="stroke-muted-foreground/35"`) per province positioned by linear
  scale from min→max of the medians; the current province drawn LAST (so it
  paints on top), thicker (`strokeWidth` 3.5) and amber
  (`stroke-amber-600 dark:stroke-amber-500`).
- Each tick wrapped so it carries a native `<title>`:
  `"{provincia} ({departamento}): {formatear(mediana)}"` — same pattern as the
  tile map.
- `<figure>` + `<figcaption>` with min and max labels (`tabular-nums`) at the
  ends and a one-line caption naming the highlighted province and its
  national rank, e.g. `"Valle de Aburrá: puesto 12 de 140 por mediana del
  costo directo (de más barata a más cara)."` — compute rank by sorting a
  copy ascending; rank = index + 1. Export the rank computation as a pure
  helper `puesto(provincias, slugActual): { puesto: number; total: number } | null`
  for testing; return `null` when the slug isn't found and render nothing in
  that case.
- Provinces with `mediana <= 0` (defensive; shouldn't occur since medians come
  from positive-only aggregates) are skipped by the scale AND the ticks.
- `role="img"` + `aria-label={titulo}` on the `<svg>`.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: `CapitulosComparados` — per-chapter province vs national bars

Create `app/provincias/[slug]/_components/capitulos-comparados.tsx`, server
component. It receives the already-grouped data:

```ts
export type CapituloComparado = {
  numero: number
  nombre: string
  /** Mediana del costo directo de los ítems CON dato en la provincia. */
  medianaProvincia: number
  /** Mediana nacional (catálogo) de los mismos ítems. */
  medianaNacional: number
  /** Ítems con dato en la provincia / ítems del capítulo. */
  conDato: number
  total: number
}
```

Also export the pure builder that the page will call:

```ts
export function compararCapitulos(
  items: readonly ProvinciaItem[],
  catalogo: Catalogo
): CapituloComparado[]
```

Builder rules (this is the load-bearing logic — implement exactly):

- Group the province's items by constructive chapter using the same mapping
  the page already uses (`mapaDeCapitulos(catalogo)` from
  `app/_ui/capitulos.tsx`, fallback `Number(item.capitulo[0])` /
  `` `Capítulo ${item.capitulo[0]}` `` — copy the fallback from
  `app/provincias/[slug]/page.tsx:86-93`).
- `medianaProvincia`: median over the chapter's items **with
  `costoDirecto > 0` only**. A chapter where no item applies gets
  `medianaProvincia = 0` and renders as "No aplica aquí" (muted text, no bar)
  — never a zero-length bar presented as a price of $0.
- `medianaNacional`: median over `catalogo.items` of that chapter of
  `item.costoDirecto.mediana` — restricted to **the same item codes that have
  data in the province** so the pair is apples-to-apples. (If you compare the
  province's applicable subset against the national median of ALL chapter
  items, a chapter where only cheap items apply would look artificially
  cheap.) When the province chapter has no items with data, fall back to all
  chapter items for the national bar.
- Median: local 5-line helper (sort ascending; middle element, or mean of the
  two middle elements for even length; 0 for empty). Same algorithm as
  `app/_ui/regiones.ts:88-96`.
- Sort output by `numero` ascending.

Rendering spec (plain HTML, no SVG needed):

- One row per chapter: label (número + nombre, linking to the page's existing
  `#capitulo-N` anchors — reuse `idCapitulo` from `app/_ui/capitulos.tsx`),
  then two bars stacked: provincia (amber, `bg-amber-500 dark:bg-amber-600`)
  and nacional (`bg-muted-foreground/25`), widths proportional to
  `max(medianaProvincia, medianaNacional)` across all chapters → percentage
  width via inline `style={{ width: \`${pct}%\` }}`; each bar followed by its
  `formatearCOP` value in `tabular-nums` text (the number is in the HTML — the
  bar is decoration, per the repo's "numbers live in server HTML" rule).
- A small legend ("■ esta provincia · ■ mediana nacional") and the caveat line:
  "Medianas del costo directo de referencia, sin AIU, sobre los ítems con dato
  en la provincia."
- Mark bars `aria-hidden="true"`; the accessible content is the text.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 3: Wire both into the hub page

In `app/provincias/[slug]/page.tsx` `Contenido`:

- Add `listarProvincias` to the existing `Promise.all` (import from
  `"../../_ui/regiones"`).
- After the stat-tiles section (after line ~162) insert:

  ```tsx
  <section aria-label="Posición nacional" className="space-y-2">
    <h2 className="text-lg font-medium">Posición entre las 140 provincias</h2>
    <FranjaProvincias
      provincias={provincias}
      slugActual={slug}
      formatear={formatearCOP}
      titulo={`Mediana de ${region.provincia} frente a las demás provincias`}
      className="max-w-xl"
    />
  </section>

  <section aria-label="Comparación por capítulo" className="space-y-2">
    <h2 className="text-lg font-medium">Capítulos frente a la mediana nacional</h2>
    <CapitulosComparados capitulos={compararCapitulos(resumen.items, catalogo)} />
  </section>
  ```

  (Exact heading copy may be tuned; the structure and labels-in-Spanish are
  required.)

**Verify**: `bun run build` → exit 0 (this prerenders all 140 hubs — it will
catch any data edge case, e.g. chapters with no applicable items). Then
`bun run dev`, check two contrasting hubs, e.g. a cheap and an expensive
province from the home page's "notables" cards: the highlighted tick sits at
opposite ends; a chapter with no applicable items shows "No aplica aquí".

## Test plan

New tests (bun test, model after `lib/data/data.test.ts` structure —
`describe`/`test`/`expect` from `bun:test`):

- `franja-provincias.test.ts`: `puesto()` — rank 1 for the lowest median,
  rank N for the highest, `null` for unknown slug; ties keep stable order.
- `capitulos-comparados.test.ts`: `compararCapitulos()` —
  - zeros excluded from `medianaProvincia` (item with `costoDirecto: 0`
    doesn't drag the median),
  - chapter with all zeros → `medianaProvincia === 0`, national fallback to
    all chapter items,
  - national median restricted to province-applicable codes,
  - fallback chapter naming when `capituloNumero` is missing from the catalog
    entry.

Fixtures: build minimal `ProvinciaItem[]`/`Catalogo` literals inline (see
`lib/schema/artefactos.test.ts:44-100` for the shape of valid fixture
objects).

Verification: `bun test` → all pass, including the new files.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test`, `bun run build` all exit 0
- [ ] `components/charts/franja-provincias.tsx` exists with NO `"use client"` (`grep -L "use client" components/charts/franja-provincias.tsx` → prints the path)
- [ ] The hub renders both new sections (`grep -c "FranjaProvincias\|CapitulosComparados" "app/provincias/[slug]/page.tsx"` → ≥ 2 lines)
- [ ] No recharts import in either new component (`grep -rn "recharts" components/charts/franja-provincias.tsx app/provincias/[slug]/_components/` → no matches)
- [ ] Zeros are labeled "No aplica", never rendered as a $0 bar (code review + test)
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `ProvinciaResumen`/`Catalogo` shapes differ from the excerpts.
- `listarProvincias()` is no longer importable from `app/_ui/regiones.ts` or
  its return shape changed.
- Build time for the 140 hubs grows by more than ~2× versus a baseline build
  you run BEFORE your change (the `listarProvincias` fan-in reads 140 JSONs —
  it's cached per build, but verify; report numbers if it regresses).
- You find yourself adding `"use client"` to make something work — the design
  is server-only; stop and report why.

## Maintenance notes

- When vigencia 2026-2 ships, nothing here changes (all data flows through
  cached loaders tagged with `ETIQUETA_VIGENCIA`).
- If a "diffs entre vigencias" feature lands (BACKLOG), `FranjaProvincias` is
  the natural place to show movement (two ticks per province) — keep its
  props library-agnostic.
- Reviewer scrutiny: the apples-to-apples restriction in `medianaNacional`
  (easy to get subtly wrong), and RSC/HTML weight of the 140-tick SVG on hub
  pages (should be ~10 kB; the tables dominate regardless).
