#!/usr/bin/env bun
/**
 * Build data/archivo/manifest.json — the provenance record for the locally
 * downloaded INVIAS APU archive.
 *
 * The .xlsx workbooks themselves are NOT redistributed in this repo
 * (see AGENTS.md non-negotiable #3): data/archivo/2026-1/ is gitignored.
 * This manifest is what gets committed, so anyone can verify that the archive
 * they downloaded from INVIAS matches the one the parsers were built against.
 *
 * Usage:  bun scripts/manifest.ts
 */

import { createHash } from "node:crypto"
import { readdir, stat } from "node:fs/promises"
import { createReadStream } from "node:fs"
import { join, resolve } from "node:path"

const VIGENCIA = "2026-1"
const FECHA_DESCARGA = "2026-08-03"

const REPO_ROOT = resolve(import.meta.dir, "..")
const ARCHIVE_DIR = join(REPO_ROOT, "data", "archivo", VIGENCIA)
const OUTPUT = join(REPO_ROOT, "data", "archivo", "manifest.json")

/** INVIAS publication page for the regionalised reference APUs. */
const SOURCE_URL =
  "https://www.invias.gov.co/publicaciones/4149/analisis-de-precios-unitarios-apu-regionalizados-de-referencia/"

/** Portal the per-municipality downloads are served from. */
const PORTAL_URL = "https://hermes2.invias.gov.co/SeguimientoInversiones/"

const DESCARGA_NOTA =
  "Archivo descargado manualmente desde el portal oficial de INVIAS " +
  "(ZIP nacional 2026_1.zip) el " +
  FECHA_DESCARGA +
  ". Este repositorio no automatiza descargas ni hace scraping contra " +
  PORTAL_URL +
  " (ver AGENTS.md)."

const LICENCIA_NOTA =
  "Datos oficiales de referencia del Instituto Nacional de Vías (INVIAS), " +
  "“Análisis de Precios Unitarios (APU) Regionalizados de Referencia”, vigencia " +
  VIGENCIA +
  ". Los libros .xlsx NO se redistribuyen en este repositorio: data/archivo/" +
  VIGENCIA +
  "/ está en .gitignore y cada usuario debe descargarlos de la fuente oficial. " +
  "El aviso legal de INVIAS restringe el uso comercial o con ánimo de lucro sin " +
  "autorización previa. Los valores son costos directos de referencia (sin AIU) " +
  "y no constituyen precios de mercado."

/** APU_<code4>_<DEPARTAMENTO>__<PROVINCIA>_<vigencia con guion bajo>.xlsx */
const FILENAME_RE = /^APU_(\d{4})_(.+?)__(.+?)_(\d{4})_(\d)\.xlsx$/

export interface ManifestFile {
  filename: string
  /** 4-digit INVIAS province code taken from the filename. */
  codigo: string
  /** Department slug as it appears in the filename (UPPER_SNAKE, no accents). */
  departamento: string
  /** Province slug as it appears in the filename (UPPER_SNAKE, no accents). */
  provincia: string
  bytes: number
  sha256: string
}

export interface Manifest {
  vigencia: string
  fuente: string
  portal: string
  fechaDescarga: string
  descarga: string
  licencia: string
  generadoPor: string
  archivos: number
  bytesTotales: number
  files: ManifestFile[]
}

async function sha256(path: string): Promise<string> {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(path, {
    highWaterMark: 4 * 1024 * 1024,
  })) {
    hash.update(chunk as Buffer)
  }
  return hash.digest("hex")
}

async function main(): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(ARCHIVE_DIR)
  } catch {
    console.error(
      `No se encontró ${ARCHIVE_DIR}.\n` +
        `Descarga el ZIP oficial de INVIAS (${SOURCE_URL}) y extrae los .xlsx ahí.`
    )
    process.exit(1)
  }

  const names = entries
    .filter((name) => name.endsWith(".xlsx") && !name.startsWith("~$"))
    .sort((a, b) => a.localeCompare(b, "es"))

  if (names.length === 0) {
    console.error(`No hay archivos .xlsx en ${ARCHIVE_DIR}.`)
    process.exit(1)
  }

  const files: ManifestFile[] = []
  let bytesTotales = 0

  for (const [i, filename] of names.entries()) {
    const path = join(ARCHIVE_DIR, filename)
    const match = FILENAME_RE.exec(filename)
    if (!match) {
      console.warn(
        `  aviso: nombre fuera de patrón, se incluye igual: ${filename}`
      )
    }
    const [, codigo = "", departamento = "", provincia = ""] = match ?? []
    const { size } = await stat(path)
    const digest = await sha256(path)
    bytesTotales += size
    files.push({
      filename,
      codigo,
      departamento,
      provincia,
      bytes: size,
      sha256: digest,
    })
    process.stdout.write(
      `\r  hash ${i + 1}/${names.length}  ${filename.slice(0, 60)}`.padEnd(90)
    )
  }
  process.stdout.write("\n")

  const manifest: Manifest = {
    vigencia: VIGENCIA,
    fuente: SOURCE_URL,
    portal: PORTAL_URL,
    fechaDescarga: FECHA_DESCARGA,
    descarga: DESCARGA_NOTA,
    licencia: LICENCIA_NOTA,
    generadoPor: "scripts/manifest.ts",
    archivos: files.length,
    bytesTotales,
    files,
  }

  await Bun.write(OUTPUT, JSON.stringify(manifest, null, 2) + "\n")

  const mb = (bytesTotales / 1024 ** 3).toFixed(2)
  console.log(`\nmanifest.json escrito: ${OUTPUT}`)
  console.log(`  vigencia   ${VIGENCIA}`)
  console.log(`  archivos   ${files.length}`)
  console.log(`  tamaño     ${mb} GB`)
}

await main()
