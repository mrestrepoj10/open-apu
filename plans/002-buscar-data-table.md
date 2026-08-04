# Plan 002: Página `/buscar` — catálogo interactivo con TanStack Table, estado en la URL (rev. 2)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d50cf63..HEAD -- app/items/page.tsx app/_ui/chrome.tsx app/_ui/esqueleto.tsx lib/data lib/schema package.json AGENTS.md BACKLOG.md`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (new dependency + first client-heavy surface + shallow routing)
- **Depends on**: none
- **Category**: direction (feature — implements a BACKLOG-decided architecture)
- **Planned at**: commit `d50cf63`, 2026-08-04 (rev. 2 — reconciled after the
  repo adopted Next 16.3 partial prefetching; rev. 1 predates that)

## Why this matters

The 526-item catalog is navigable only by chapter; there is no search, no
sorting, no filtering. `BACKLOG.md` («Página de búsqueda») now records a
**decided architecture** — this plan implements that decision exactly, plus
the maintainer's original ask (shadcn data-table pattern = TanStack Table
rendered through the installed shadcn `Table` primitives). The catalog page's
own comment already anticipates it: «El plan 002 la sustituye por `/buscar`;
hasta entonces no se toca» (`app/items/page.tsx:31-32`).

The decision, quoted from BACKLOG.md (honor every clause):

> Arquitectura ya decidida: **la consulta vive en la URL** (`?q=`, `?cap=`),
> el `<input>` va en el shell estático de la ruta y los resultados llegan en
> un `<Suspense>` que lee `searchParams` (mismo corte que las rutas con
> `params`, ver AGENTS.md). Ordenar y filtrar en cliente sin ida al servidor:
> `history.pushState` + `useSearchParams` (routing superficial), no
> `router.push`.

`/items` stays untouched as the deliberate no-JS/SEO surface.

## Current state

- **Repo-wide App Shell convention** (AGENTS.md, «Arquitectura de datos»,
  added with 16.3): "The convention every new route with
  `params`/`searchParams` follows: the page component is **not** `async` — it
  passes the promise into a `<Suspense>`-wrapped child that awaits it, so the
  shell stays URL-independent." `next.config.ts` has `cacheComponents: true`
  and `partialPrefetching: true`. The three param routes
  (`app/items/[codigo]/page.tsx`, `app/provincias/[slug]/page.tsx`,
  `app/items/[codigo]/[provincia]/page.tsx`) all follow the shape:

  ```tsx
  export default function Page({ params }) {          // NOT async
    return (
      <main className="…">
        <Suspense fallback={<EsqueletoX />}>
          <XDeParams params={params} />
        </Suspense>
      </main>
    )
  }
  ```

- `app/_ui/esqueleto.tsx` — shared skeleton primitives (`Esqueleto`, `Bloque`,
  `EsqueletoCabecera`, `EsqueletoCifras`, `EsqueletoTabla`) used by every
  route's Suspense fallback. Reuse them; don't invent new skeleton styles.

- `app/_ui/chrome.tsx:23-27` — site nav; nav links are `next/link` with
  default prefetch (`/theme` is the exception with `prefetch={false}`):

  ```tsx
  const NAVEGACION = [
    { href: "/", etiqueta: "Inicio" },
    { href: "/items", etiqueta: "Ítems" },
    { href: "/provincias", etiqueta: "Provincias" },
  ] as const
  ```

- `lib/data/index.ts` — `getCatalogo(): Promise<Catalogo>`; `CatalogoItem`
  (`lib/schema/artefactos.ts:85-102`) has `codigo`, `descripcion`, `unidad`,
  `capitulo`, `capituloNumero?`, `capituloNombre?`, `costoDirecto.mediana`,
  `provinciasConDato`. `app/_ui/capitulos.tsx` — `primeraLinea(texto)`.
  `lib/format.ts` — `formatearCOP`, `formatearNumero`.

- `components/ui/table.tsx`, `input.tsx`, `select.tsx`, `button.tsx`,
  `badge.tsx` — shadcn primitives, installed. `lucide-react` installed.

- Cached-loader pattern to copy for the data component:
  `"use cache"` + `cacheLife("max")` + `cacheTag(ETIQUETA_VIGENCIA)`
  (see `ContenidoItem`, `app/items/[codigo]/page.tsx`).

Repo conventions: Spanish-first everything; Prettier no-semicolons; every
price surface carries the "costo directo, sin AIU" framing +
`<ProcedenciaBox>`; client components are the exception — isolate them.

## Commands you will need

| Purpose     | Command                          | Expected on success       |
|-------------|----------------------------------|---------------------------|
| Install     | `bun install`                    | exit 0 (fresh worktree)   |
| Add dep     | `bun add @tanstack/react-table`  | exit 0, lockfile updated  |
| Typecheck   | `bun run typecheck`              | exit 0                    |
| Lint        | `bun run lint`                   | exit 0                    |
| Tests       | `bun test`                       | all pass                  |
| Build       | `bun run build`                  | exit 0 (~35 s, ~4.9k pages) |

## Suggested executor toolkit

- **Before coding, read** (versioned local docs — this Next.js differs from
  training data):
  - `node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md`
    — the **shallow routing** section (`window.history.pushState` /
    `replaceState` + `useSearchParams`).
  - `node_modules/next/dist/docs/01-app/02-guides/adopting-partial-prefetching.md`
    — «Auditing routes for URL data» (why nothing above the Suspense boundary
    may read the URL).
- `vercel:shadcn` skill for the data-table composition; `vercel:nextjs` if an
  App Router API behaves unexpectedly.

## Scope

**In scope**:
- `package.json` / `bun.lock` (add `@tanstack/react-table` only)
- `app/buscar/page.tsx` (create)
- `app/buscar/_components/tabla-busqueda.tsx` (create — the client island)
- `app/buscar/_components/tabla-busqueda.test.ts` (create — pure helpers)
- `app/_ui/chrome.tsx` (add one nav entry)

**Out of scope** (do NOT touch):
- `app/items/page.tsx` («hasta entonces no se toca» refers to replacing its
  role — this plan must not modify the file at all)
- `app/provincias/**`, `components/ui/*`, `app/_ui/esqueleto.tsx` (import
  only), `app/sitemap.ts` (noindex page — don't add it)

## Git workflow

- Branch: `advisor/002-buscar-data-table`
- Commit per step; short imperative messages ("Add /buscar search page…").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the dependency

`bun add @tanstack/react-table` (headless, stable v8, ~15 kB gz — consistent
with "boring tech, small dependencies").

**Verify**: `grep '"@tanstack/react-table"' package.json` → one match;
`bun run typecheck` → exit 0.

### Step 2: `app/buscar/page.tsx` — shell + Suspense cut

Follow the repo's route shape exactly:

- `export default function Page()` — **not async**, reads **nothing** from
  the request. It renders: the `<main>` wrapper, a static header (h1 "Buscar
  ítems", copy stating the shown price is the **mediana nacional del costo
  directo, sin AIU**), then:

  ```tsx
  <Suspense fallback={<EsqueletoBusqueda />}>
    <ResultadosBusqueda />
  </Suspense>
  ```

- `ResultadosBusqueda` — async server component with `"use cache"` +
  `cacheLife("max")` + `cacheTag(ETIQUETA_VIGENCIA)`: loads `getCatalogo()`,
  maps items to slim rows (ONLY these fields — payload discipline):

  ```ts
  export type FilaBusqueda = {
    codigo: string
    titulo: string        // primeraLinea(item.descripcion)
    unidad: string
    capitulo: number      // item.capituloNumero ?? Number(item.capitulo[0])
    capituloNombre: string
    mediana: number       // item.costoDirecto.mediana
    provinciasConDato: number
  }
  ```

  and renders `<TablaBusqueda filas={filas} provincias={catalogo.provincias} />`
  followed by `<ProcedenciaBox procedencia={catalogo.procedencia} />`.
- `EsqueletoBusqueda` — built from `app/_ui/esqueleto.tsx` primitives: a
  `Bloque` shaped like the search input row (h-9), then
  `<EsqueletoTabla filas={12} />`. Per the BACKLOG decision the input belongs
  to the shell — this fallback is what the shell shows, so its first block
  must read as the input's placeholder.
- Metadata: title "Buscar", Spanish description, and
  `robots: { index: false, follow: true }` (content duplicates `/items`, the
  canonical SEO surface).

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Client island `app/buscar/_components/tabla-busqueda.tsx`

`"use client"`. This is where the BACKLOG decision's interaction model lives:

- **URL is the source of truth for `q` and `cap`.** Read with
  `useSearchParams()` (legal here: the island renders inside the page's
  Suspense boundary — the same cut the decision describes). Derive:
  `q = searchParams.get("q") ?? ""`, `cap = searchParams.get("cap")`.
- **Writes are shallow — never `router.push`:**
  - typing in the input → debounced (~150 ms)
    `window.history.replaceState(null, "", "?" + params)` (replace, so each
    keystroke doesn't pollute history),
  - changing the chapter `Select` → `window.history.pushState(null, "", …)`
    (push — a chapter change is a navigable state),
  - empty values are **removed** from the URL, not left as `?q=`.
  Per the Next docs read in the toolkit step, `useSearchParams` re-renders on
  native pushState/replaceState — that is the shallow-routing integration.
- The `<Input>` is controlled by local state initialized from the URL param
  (so back/forward buttons update it via a `useEffect` on `searchParams`).
- **TanStack Table** (`useReactTable` + `getCoreRowModel`,
  `getFilteredRowModel`, `getSortedRowModel`) over the 526 rows:
  - Global filter: accent-insensitive match of `q` against `codigo` +
    `titulo`. Export the pure helper:

    ```ts
    export function normalizar(texto: string): string {
      return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
    }
    ```

  - Column filter on `capitulo` driven by `cap`.
  - Sorting: in-memory component state (NOT in the URL — the decision names
    only `q` and `cap`). Default `codigo` ascending; sortable headers for
    Código and Mediana nacional with lucide `ArrowUpDown`/`ArrowUp`/
    `ArrowDown` indicator buttons.
- Columns: Código (monospace, `next/link` to `/items/{codigo}` — default
  prefetch; with partial prefetching all rows share one route shell), Ítem,
  Unidad, Capítulo (`capituloNombre`), Mediana nacional (right-aligned,
  `tabular-nums`, `formatearCOP`; when `provinciasConDato < provincias`, the
  muted caveat line "no aplica en todas: N provincias con dato" — wording
  copied from `app/items/page.tsx`).
- Render through shadcn `Table` primitives; live result count
  ("N de 526 ítems", `aria-live="polite"`); empty state row "Ningún ítem
  coincide con la búsqueda."

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 4: Nav link

Add `{ href: "/buscar", etiqueta: "Buscar" }` to `NAVEGACION` in
`app/_ui/chrome.tsx`, after "Ítems".

**Verify**: `grep -n "buscar" app/_ui/chrome.tsx` → one match.

### Step 5: Build and manual check

**Verify**: `bun run build` → exit 0. `bun run dev`, open
`http://localhost:3000/buscar`:

- typing "concreto" filters and the URL becomes `?q=concreto` WITHOUT a
  server request for the page (check the network panel — no document/RSC
  fetch on keystrokes),
- "excavacion" (no accent) matches accented titles,
- loading `/buscar?q=concreto&cap=6` directly shows pre-filtered results,
- browser Back after a chapter change restores the previous filter state,
- sorting by Mediana nacional works both directions,
- código links navigate to item pages.

## Test plan

`app/buscar/_components/tabla-busqueda.test.ts` (bun test, model after
`lib/data/data.test.ts` style): `normalizar` strips accents
("Excavación" → "excavacion"), lowercases, leaves ASCII untouched. If you
extract the row-mapping to a pure function, test the `capitulo` fallback
(`Number(item.capitulo[0])` when `capituloNumero` missing). No DOM/interaction
tests — the repo has no DOM test infra; don't add one.

Verification: `bun test` → all pass including the new file.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test`, `bun run build` all exit 0
- [ ] `app/buscar/page.tsx`: page is NOT async (`grep -n "export default function Page" app/buscar/page.tsx` → 1 match) and contains a `Suspense` boundary
- [ ] `grep -n "router.push" app/buscar/_components/tabla-busqueda.tsx` → **no matches** (shallow routing only)
- [ ] `grep -cn "pushState\|replaceState" app/buscar/_components/tabla-busqueda.tsx` → ≥ 2
- [ ] `grep -n "index: false" app/buscar/page.tsx` → 1 match (noindex)
- [ ] `app/items/page.tsx` untouched (`git diff --stat` clean for it)
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `@tanstack/react-table` hard-fails to typecheck against React 19.2.
- `useSearchParams` does NOT re-render on native
  `pushState`/`replaceState` in this Next version (verify against
  `single-page-applications.md` first — if the doc prescribes a different
  shallow-routing mechanism, follow the doc and note the deviation; if none
  works, stop).
- The built `/buscar` route's first-load JS exceeds ~250 kB in the build
  output table — report the number instead of shipping.
- You find yourself modifying `app/items/page.tsx`.

## Maintenance notes

- The BACKLOG «Página de búsqueda» entry is resolved by this plan — delete
  that single bullet in the same commit (only BACKLOG edit allowed).
- When a second vigencia ships, everything flows through
  `cacheTag(ETIQUETA_VIGENCIA)` — no changes here.
- Reviewer scrutiny: no `router.push` anywhere; RSC payload of the slim rows
  (~60 kB target); the Suspense fallback visually matching the loaded input
  row (shell promise of the BACKLOG decision).
- Deferred: sort state in the URL; fuzzy ranking; pagination.
