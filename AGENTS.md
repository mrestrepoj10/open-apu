# APU Stack

Open-source construction pricing blocks for Colombia. APUs (Análisis de Precios
Unitarios) are the atomic unit of construction budgeting; official reference data
exists (INVIAS, departmental open data) but nothing is machine-readable. This repo
fixes that: data → schema → parsers → a public web explorer.

## Goal

Let anyone get the official reference price of a construction item, fast, with
provenance — via a static website first (CLI/MCP later, see BACKLOG.md).
The explorer is deliberately **visually rich**: interactive charts are
first-class content (the .xlsx already covers plain tables); key figures stay
in server HTML with their provenance.

## Stack & structure

- TypeScript end-to-end, Bun (runtime + package manager).
- The repo root IS the web app: Next.js 16 (App Router, Cache Components/PPR, shadcn) —
  static-first + ISR, one URL per ítem × región, Spanish-first.
- Data ships as versioned static files (JSON/Parquet). No database, no backend.
- Schema (apu.json spec + validators) and parsers (INVIAS xlsx, departamental CSV) live
  under `lib/`; parsers must stay browser-compatible (files parse client-side).
- `scripts/` holds the data pipeline (xlsx archive → static JSON).
- Code is MIT. Data directories carry their own LICENSE + provenance notes.

## Arquitectura de datos

The chain, source to page — each link is committed except the first:

1. **xlsx archive** — `data/archivo/2026-1/` (140 INVIAS workbooks, ~1.9 GB,
   gitignored per non-negotiable 3). Only `data/archivo/manifest.json` is
   committed: filenames, sizes, sha256, provenance. Regenerate with
   `bun scripts/manifest.ts` after downloading the workbooks by hand.
2. **`lib/parser/`** — browser-safe reader (raw OOXML via `fflate`, no `node:*`).
   `lib/parser/FORMATO.md` is the spec for the INVIAS FR-APU-1 sheet layout;
   `lib/parser/__goldens__/` pins parser output against the workbooks' own
   cached values.
3. **`scripts/pipeline.ts`** (`bun run pipeline`) — parses the 140 workbooks to
   NDJSON in `data/.staging/`, loads it into DuckDB (`scripts/sql/`), emits
   parquet (4.1 MB) + JSON (~30 MB). Both output trees are committed; CI never
   regenerates them.
4. **`lib/data/`** — `'use cache'` loaders over `data/json/` plus point lookups
   into `apu_lineas.parquet` with hyparquet (only the desglose needs the
   columnar file).
5. **routes** — 526 item pages, 140 province hubs, 9 familia-630 × 140 desglose
   pages prerendered at build (1.949 pages, ~18 s local), the remaining ~72 k
   desglose URLs served by ISR. The desglose cut is the 630 family only — NOT
   the 30 destacados of the homepage: 4.200 prerendered desgloses OOM-killed
   the build on Vercel's 4-core/8-GB machine, and the prerender workers' heap
   cannot be raised from outside (Next strips `--max-old-space-size` from
   worker NODE_OPTIONS; see `elegirFamiliaDestacada` in `lib/data/leer.ts`).

Next 16.3 with `partialPrefetching: true`: a `<Link>` prefetches the App Shell of
its **route**, shared across every link to it, which is what makes `next/link`
affordable in the 280- and 1.050-link tables. The convention every new route with
`params`/`searchParams` follows: the page component is **not** `async` — it passes
the promise into a `<Suspense>`-wrapped child that awaits it, so the shell stays
URL-independent (`node_modules/next/dist/docs/01-app/02-guides/adopting-partial-prefetching.md`).
The trade-off is documented and accepted: `notFound()` now fires after the shell
has streamed, so unknown URLs answer a soft 404 (200 + `noindex`) instead of 404.

Bumping a vigencia: `VIGENCIA_ACTUAL` in `lib/data/constantes.ts`,
`outputFileTracingIncludes` in `next.config.ts` (the paths are literal), then
rerun `bun run pipeline`.

## Non-negotiables

1. Every number a user sees carries provenance (fuente, vigencia, licencia).
2. Reference prices are direct costs only (no AIU) — never present them as market prices.
3. No scraping automation against hermes2.invias.gov.co.
4. Bogotá D.C. is outside INVIAS scope — represent honestly (pointer to IDU).
5. Boring tech, small dependencies, everything testable offline with `data/samples/`.
6. Blocks stay single-purpose; anything off-goal goes to BACKLOG.md, not the code.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
