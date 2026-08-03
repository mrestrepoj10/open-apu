# APU Stack

Open-source construction pricing blocks for Colombia. APUs (Análisis de Precios
Unitarios) are the atomic unit of construction budgeting; official reference data
exists (INVIAS, departmental open data) but nothing is machine-readable. This repo
fixes that: data → schema → parsers → a public web explorer.

## Goal

Let anyone get the official reference price of a construction item, fast, with
provenance — via a static website first (CLI/MCP later, see BACKLOG.md).

## Stack & structure

- TypeScript end-to-end, Bun (runtime + package manager).
- The repo root IS the web app: Next.js 16 (App Router, Cache Components/PPR, shadcn) —
  static-first + ISR, one URL per ítem × región, Spanish-first.
- Data ships as versioned static files (JSON/Parquet). No database, no backend.
- Schema (apu.json spec + validators) and parsers (INVIAS xlsx, departamental CSV) live
  under `lib/`; parsers must stay browser-compatible (files parse client-side).
- `scripts/` holds the data pipeline (xlsx archive → static JSON).
- Code is MIT. Data directories carry their own LICENSE + provenance notes.

## Non-negotiables

1. Every number a user sees carries provenance (fuente, vigencia, licencia).
2. Reference prices are direct costs only (no AIU) — never present them as market prices.
3. No redistribution of INVIAS files in-repo; parsers work on user-downloaded exports.
4. No scraping automation against hermes2.invias.gov.co.
5. Bogotá D.C. is outside INVIAS scope — represent honestly (pointer to IDU).
6. Boring tech, small dependencies, everything testable offline with `data/samples/`.
7. Blocks stay single-purpose; anything off-goal goes to BACKLOG.md, not the code.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
