# Plan 001: Añadir el mapa de teselas al índice de provincias (`/provincias`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3a29f98..HEAD -- app/provincias/page.tsx components/map/colombia-tile-map.tsx app/_ui/regiones.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction (visual)
- **Planned at**: commit `3a29f98`, 2026-08-03

## Why this matters

The home page renders `ColombiaTileMap` with department medians and links each
tile to `/provincias#departamento-XX` — but the `/provincias` page the user
lands on has **no map at all**, only a chip nav and text cards. The component,
the data helper, and the anchor IDs all already exist; the page is the one
place where a geographic overview is most expected and it's missing. This is
the cheapest visual win in the repo: pure reuse, zero new dependencies, zero
client JavaScript (the map is a server-rendered SVG).

## Current state

- `app/provincias/page.tsx` — the index page. Server component, fully cached
  (`"use cache"` + `cacheLife("max")` + `cacheTag(ETIQUETA_VIGENCIA)`). It
  already loads everything the map needs:

  ```tsx
  // app/provincias/page.tsx:26-30
  const [stats, provincias] = await Promise.all([
    getStats(),
    listarProvincias(),
  ])
  const departamentos = agruparPorDepartamento(provincias)
  ```

  Its department sections carry the anchors the map will target:

  ```tsx
  // app/provincias/page.tsx:76-79
  <section
    key={departamento.codigoDane}
    id={`departamento-${departamento.codigoDane}`}
    className="scroll-mt-16 rounded-lg border p-4"
  ```

- `components/map/colombia-tile-map.tsx` — server-component SVG tile map
  (tilegram) of the 33 departments. Props (lines 158–172):
  `valores: Record<string, number>` (keyed by 2-digit DANE code), `formatear`,
  `href?: (codigoDane: string) => string`, `unidad?`, `titulo?`, `sinLeyenda?`,
  `className?`. It handles Bogotá (always striped, never colored — non-negotiable
  5) and "sin dato" tiles internally. Do not modify this file.

- `app/_ui/regiones.ts:103-116` — `medianaPorDepartamento(provincias)` returns
  exactly the `Record<string, number>` shape the map's `valores` prop wants.

- The reference usage to copy is the home page:

  ```tsx
  // app/page.tsx:102-113
  <section className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start">
    <div className="space-y-3">
      <h2 className="text-sm font-medium">
        Mediana del costo directo por departamento
      </h2>
      <ColombiaTileMap
        valores={medianaPorDepartamento(provincias)}
        formatear={formatearCOP}
        href={(dane) => `/provincias#departamento-${dane}`}
        titulo="Mediana del costo directo por departamento"
      />
    </div>
  ```

Repo conventions that apply here:

- All UI text, identifiers, and comments in **Spanish** (es-CO).
- The page is a cached server component — keep it that way; the map is a
  server SVG, so nothing about caching changes.
- Every price surface states it is **costo directo, sin AIU** — the page
  header already does this; don't remove it.
- Prettier style: no semicolons, double quotes. Match the file.

## Commands you will need

| Purpose   | Command             | Expected on success       |
|-----------|---------------------|---------------------------|
| Typecheck | `bun run typecheck` | exit 0, no errors         |
| Lint      | `bun run lint`      | exit 0                    |
| Tests     | `bun test`          | all pass                  |
| Build     | `bun run build`     | exit 0, ~4.9k pages built |

## Scope

**In scope** (the only file you should modify):
- `app/provincias/page.tsx`

**Out of scope** (do NOT touch):
- `components/map/colombia-tile-map.tsx` — reused as-is.
- `app/page.tsx` — the home page keeps its own map.
- `app/_ui/regiones.ts` — helpers used as-is.

## Git workflow

- Branch: `advisor/001-mapa-indice-provincias`
- One commit; message style matches `git log` (short imperative, e.g.
  "Add tile map to provincias index").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Import the map and helper

In `app/provincias/page.tsx`, add imports:

```tsx
import { ColombiaTileMap } from "@/components/map/colombia-tile-map"
```

and extend the existing `../_ui/regiones` import to include
`medianaPorDepartamento`.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Render the map between the header and the chip nav

Insert a new section after the `<header>` (after line ~49) and before the
`<nav aria-label="Departamentos">`. Two-column layout on large screens like
the home page, with the map on the left and the existing chip nav content
unaffected. Target shape:

```tsx
<section
  aria-label="Mapa de departamentos"
  className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start"
>
  <div className="space-y-3">
    <h2 className="text-sm font-medium">
      Mediana del costo directo por departamento
    </h2>
    <ColombiaTileMap
      valores={medianaPorDepartamento(provincias)}
      formatear={formatearCOP}
      href={(dane) => `#departamento-${dane}`}
      titulo="Mediana del costo directo por departamento"
    />
  </div>
  <p className="max-w-prose text-sm text-pretty text-muted-foreground">
    Toca un departamento para saltar a sus provincias. La mediana
    departamental resume las medianas de sus provincias: mide dispersión
    regional del costo directo de referencia, sin AIU — no es un precio de
    mercado.
  </p>
</section>
```

Note the `href` is a **same-page anchor** (`#departamento-…`), not
`/provincias#departamento-…` — the user is already on this page.

**Verify**: `bun run lint` → exit 0; `bun run typecheck` → exit 0.

### Step 3: Build

**Verify**: `bun run build` → exit 0. Optionally `bun run dev` and load
`http://localhost:3000/provincias`: map renders, clicking a tile scrolls to
that department's card, Bogotá tile is striped with "Fuera del alcance
INVIAS — ver IDU" in its tooltip.

## Test plan

No new unit tests: the change composes two existing tested pieces and adds no
logic. The build (which prerenders `/provincias`) plus typecheck are the
gates. Existing tests must stay green: `bun test` → all pass.

## Done criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` exits 0
- [ ] `bun run build` exits 0
- [ ] `/provincias` renders a `ColombiaTileMap` whose tiles link to
      `#departamento-<dane>` (grep: `grep -n "ColombiaTileMap" app/provincias/page.tsx` → 2 matches: import + usage)
- [ ] Only `app/provincias/page.tsx` is modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `ColombiaTileMap` props no longer match the excerpt above (component drifted).
- `medianaPorDepartamento` no longer exists in `app/_ui/regiones.ts`.
- The build fails for any reason not introduced by your edit.

## Maintenance notes

- If the anchor ID scheme on this page changes (`departamento-XX`), the home
  page map (`app/page.tsx:110`) points at the same anchors — change both.
- Reviewer check: the map must not appear above the header's "sin AIU"
  disclaimer text; provenance framing stays intact.
