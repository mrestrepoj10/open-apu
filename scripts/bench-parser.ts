#!/usr/bin/env bun
/**
 * Banco de pruebas del parser: procesa un libro completo (526 ítems) y reporta
 * tiempo y memoria.
 *
 * Existe porque FORMATO.md §6.1 documenta que exceljs consume ~3.7 GB de RSS
 * por libro, lo que hace inviable el parseo en navegador. Este script es la
 * verificación continua de que la alternativa (zip + XML) mantiene la memoria
 * plana.
 *
 * Uso:
 *   bun scripts/bench-parser.ts [ruta.xlsx]
 *
 * Sin argumento usa APU_0509_ANTIOQUIA__VALLE_DE_ABURRA_2026_1.xlsx del archivo
 * local (data/archivo/2026-1/, que está en .gitignore: cada quien lo descarga
 * de la fuente oficial).
 */
import { readFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import {
  abrirLibro,
  parseIndice,
  parseInsumos,
  parseItem,
  parseRegion,
  verificarEstructura,
} from "../lib/parser"
import { revisarCoherencia, type Procedencia } from "../lib/schema"
import { TOLERANCIA_INVIAS } from "../lib/parser/coordenadas"

const RAIZ = resolve(import.meta.dir, "..")
const POR_DEFECTO = join(
  RAIZ,
  "data/archivo/2026-1/APU_0509_ANTIOQUIA__VALLE_DE_ABURRA_2026_1.xlsx"
)

const PROCEDENCIA: Procedencia = {
  fuente: "INVIAS",
  url: "https://www.invias.gov.co/publicaciones/4149/analisis-de-precios-unitarios-apu-regionalizados-de-referencia/",
  vigencia: "2026-1",
  fechaDescarga: "2026-08-03",
  licencia:
    "Datos oficiales de referencia de INVIAS (APU Regionalizados, 2026-1). " +
    "Costos directos sin AIU; no son precios de mercado.",
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(0)
const ms = (inicio: number) => ((Bun.nanoseconds() - inicio) / 1e6).toFixed(0)

const ruta = process.argv[2] ? resolve(process.argv[2]) : POR_DEFECTO
const archivo = basename(ruta)

const bytes = readFileSync(ruta)
const datos = bytes.buffer.slice(
  bytes.byteOffset,
  bytes.byteOffset + bytes.byteLength
) as ArrayBuffer

let pico = process.memoryUsage().rss
const vigilante = setInterval(() => {
  pico = Math.max(pico, process.memoryUsage().rss)
}, 20)

const t0 = Bun.nanoseconds()
const libro = abrirLibro(datos, { archivo })
verificarEstructura(libro)
console.log(
  `${archivo}: ${mb(bytes.byteLength)} MB, ${libro.hojas.length} hojas, ` +
    `${libro.hojasDeItem.length} ítems — abierto en ${ms(t0)} ms`
)
console.log("región:", JSON.stringify(parseRegion(libro)))

const tIndice = Bun.nanoseconds()
const indice = parseIndice(libro)
console.log(`ÍNDICE: ${indice.length} filas en ${ms(tIndice)} ms`)

const tItems = Bun.nanoseconds()
let lineas = 0
let enCero = 0
const descuadres: string[] = []
for (const hoja of libro.hojasDeItem) {
  const apu = parseItem(libro, hoja, { procedencia: PROCEDENCIA })
  lineas += apu.lineas.length
  if (apu.costoDirecto === 0) enCero++
  const problemas = revisarCoherencia(apu, TOLERANCIA_INVIAS)
  if (problemas.length > 0) descuadres.push(`${hoja}: ${problemas.join("; ")}`)
}
console.log(
  `ítems: ${libro.hojasDeItem.length} APU, ${lineas} líneas en ${ms(tItems)} ms ` +
    `(${enCero} con costo directo 0)`
)

const tInsumos = Bun.nanoseconds()
const lista = parseInsumos(libro, { procedencia: PROCEDENCIA })
console.log(`insumos: ${lista.insumos.length} en ${ms(tInsumos)} ms`)

clearInterval(vigilante)
pico = Math.max(pico, process.memoryUsage().rss)
console.log(`total: ${ms(t0)} ms · RSS pico ${mb(pico)} MB`)

if (descuadres.length > 0) {
  console.error(`\n${descuadres.length} ítems descuadrados:`)
  for (const d of descuadres.slice(0, 20)) console.error("  " + d)
  process.exit(1)
}
console.log(
  "coherencia: los 526 ítems cuadran con tolerancia",
  TOLERANCIA_INVIAS
)
