#!/usr/bin/env bun
/**
 * Genera `data/samples/sample-provincia.xlsx`: un extracto recortado de UN libro
 * oficial de INVIAS, para poder probar el parser sin depender del archivo
 * completo (que no se redistribuye: `data/archivo/2026-1/` está en .gitignore).
 *
 * Solo de desarrollo: lee el archivo local con `node:fs`. El parser en sí nunca
 * toca el sistema de archivos.
 *
 * Qué conserva y qué no:
 *
 * - Hojas: `PORTADA`, `ÍNDICE`, los cuatro listados visibles de insumos y 5
 *   hojas de ítem escogidas por lo que ejercitan (ver `ITEMS`). Se descartan las
 *   otras 533, incluidas **todas las hojas ocultas**: la receta nacional
 *   `APU´S`, las matrices `INSUMO_*` con los precios de las 140 provincias,
 *   `CLASIFICACIÓN_APU` y `LISTADO DE PROVINCIAS`.
 * - **Se eliminan todas las fórmulas** (`<f>`), dejando solo el valor cacheado.
 *   Es lo único que lee el parser (FORMATO.md §8.3), así que no se pierde nada,
 *   y de paso el extracto deja de contener la estructura de cálculo de INVIAS y
 *   de referenciar hojas que ya no están.
 * - Se eliminan dibujos, imágenes, comentarios, configuraciones de impresión,
 *   metadatos de rich value y la cadena de cálculo.
 *
 * Uso:
 *   bun scripts/make-sample.ts [ruta-al-libro.xlsx]
 */
import { readFileSync, writeFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { zipSync, strToU8 } from "fflate"
import { abrirLibro, parseIndice, parseInsumos, parseItem } from "../lib/parser"
import type { Procedencia } from "../lib/schema"
import {
  HOJA_EQUIPO,
  HOJA_INDICE,
  HOJA_MANO_DE_OBRA,
  HOJA_MATERIALES,
  HOJA_PORTADA,
  HOJA_TRANSPORTE,
} from "../lib/parser/coordenadas"

const RAIZ = resolve(import.meta.dir, "..")

/** Libro fuente por defecto: el mismo con el que se levantó FORMATO.md. */
const FUENTE_POR_DEFECTO = join(
  RAIZ,
  "data/archivo/2026-1/APU_0509_ANTIOQUIA__VALLE_DE_ABURRA_2026_1.xlsx"
)
const DESTINO = join(RAIZ, "data/samples/sample-provincia.xlsx")

/**
 * Ítems del extracto. Cada uno está por una razón concreta; si se cambian, hay
 * que regenerar los goldens de `lib/parser/__goldens__/`.
 */
const ITEMS: ReadonlyArray<{ hoja: string; porque: string }> = [
  {
    hoja: "200,1,1",
    porque:
      "los cuatro componentes con líneas; verificado a mano en FORMATO.md §7",
  },
  {
    hoja: "630,1,1",
    porque: "familia 630 (concreto), el caso de demostración; §7",
  },
  {
    hoja: "650,5",
    porque: "costo directo 0: no aplica en esta región, no es 'sin dato'; §6.5",
  },
  {
    hoja: "730,4",
    porque:
      "código numérico (B33 = 730.4, hoja '730,4'); §6.4 · equipo solo con herramienta menor",
  },
  {
    hoja: "801,1",
    porque:
      "sección de transporte vacía + 2 líneas que el propio libro deja sin resolver",
  },
]

const LISTADOS = [
  HOJA_MATERIALES,
  HOJA_EQUIPO,
  HOJA_MANO_DE_OBRA,
  HOJA_TRANSPORTE,
]

const RUTA_ESTILOS = "xl/styles.xml"
const RUTA_TEMA = "xl/theme/theme1.xml"
const RUTA_CADENAS = "xl/sharedStrings.xml"

const NS_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const NS_SS =
  "http://schemas.openxmlformats.org/officeDocument/2006/spreadsheetml"

const fuente = process.argv[2] ? resolve(process.argv[2]) : FUENTE_POR_DEFECTO
const archivo = basename(fuente)

const bytes = readFileSync(fuente)
const libro = abrirLibro(bytes, { archivo, exigirLibroCompleto: true })

const nombresHoja = [
  HOJA_PORTADA,
  HOJA_INDICE,
  ...LISTADOS,
  ...ITEMS.map((i) => i.hoja),
]
for (const nombre of nombresHoja) {
  if (!libro.tieneHoja(nombre)) {
    throw new Error(`el libro fuente no tiene la hoja "${nombre}"`)
  }
}

const partes: Record<string, Uint8Array> = {}

// —— hojas ——
nombresHoja.forEach((nombre, indice) => {
  const ruta = `xl/worksheets/sheet${indice + 1}.xml`
  partes[ruta] = strToU8(limpiarHoja(libro.xmlDeHoja(nombre)))
})

// —— partes compartidas, tal cual ——
for (const ruta of [RUTA_ESTILOS, RUTA_TEMA, RUTA_CADENAS]) {
  if (libro.paquete.tiene(ruta)) partes[ruta] = libro.paquete.leer(ruta)
}

// —— workbook y relaciones ——
partes["xl/workbook.xml"] = strToU8(construirWorkbook(nombresHoja))
partes["xl/_rels/workbook.xml.rels"] = strToU8(
  construirRelsWorkbook(nombresHoja.length)
)
partes["_rels/.rels"] = strToU8(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`
)
partes["[Content_Types].xml"] = strToU8(
  construirContentTypes(nombresHoja.length)
)

// `mtime` fijo para que dos ejecuciones den el mismo archivo byte a byte: así
// un cambio en el extracto se ve como un diff real y no como ruido de fecha.
const zip = zipSync(partes, {
  level: 9,
  mem: 12,
  mtime: Date.UTC(2026, 7, 3),
})
writeFileSync(DESTINO, zip)

// —— verificación: el extracto debe dar exactamente lo mismo que el original ——
const muestra = abrirLibro(readFileSync(DESTINO), { archivo })
if (muestra.hojas.length !== nombresHoja.length) {
  throw new Error("el extracto no conserva las hojas esperadas")
}
const PROCEDENCIA_PRUEBA: Procedencia = {
  fuente: "INVIAS",
  url: "https://www.invias.gov.co/",
  vigencia: "2026-1",
  fechaDescarga: "2026-08-03",
  licencia: "verificación",
}
if (
  JSON.stringify(parseIndice(libro)) !== JSON.stringify(parseIndice(muestra))
) {
  throw new Error("el ÍNDICE del extracto no coincide con el del libro fuente")
}
for (const { hoja } of ITEMS) {
  const original = parseItem(libro, hoja, { procedencia: PROCEDENCIA_PRUEBA })
  const copia = parseItem(muestra, hoja, { procedencia: PROCEDENCIA_PRUEBA })
  if (JSON.stringify(original) !== JSON.stringify(copia)) {
    throw new Error(
      `el ítem "${hoja}" del extracto no coincide con el original`
    )
  }
}
if (
  JSON.stringify(parseInsumos(libro, { procedencia: PROCEDENCIA_PRUEBA })) !==
  JSON.stringify(parseInsumos(muestra, { procedencia: PROCEDENCIA_PRUEBA }))
) {
  throw new Error("los insumos del extracto no coinciden con los del original")
}

console.log(
  `${basename(DESTINO)}: ${(zip.byteLength / 1024).toFixed(0)} kB · ` +
    `${muestra.hojas.length} hojas (${muestra.hojasDeItem.length} ítems)`
)
console.log(`fuente: ${archivo}`)
for (const item of ITEMS) console.log(`  ${item.hoja} — ${item.porque}`)

// ————————————————————————————————————————————————————————————————

/**
 * Quita de una hoja todo lo que no es dato: fórmulas, dibujos, comentarios,
 * hipervínculos, configuración de impresora y metadatos de rich value.
 * Lo que queda son celdas con su valor cacheado.
 */
function limpiarHoja(xml: string): string {
  return (
    xml
      // Fórmulas. Primero las de cuerpo vacío (`<f t="shared" si="0"/>`, muy
      // comunes en el ÍNDICE): si se quitara antes la forma con cuerpo, su
      // `[\s\S]*?</f>` se comería las celdas siguientes hasta el próximo </f>.
      .replace(/<f\b[^>]*\/>/g, "")
      .replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, "")
      // referencias a partes que no se conservan
      .replace(/<drawing\b[^>]*\/>/g, "")
      .replace(/<legacyDrawing\b[^>]*\/>/g, "")
      .replace(/<picture\b[^>]*\/>/g, "")
      .replace(/<tableParts\b[^>]*\/>/g, "")
      .replace(/<tableParts\b[\s\S]*?<\/tableParts>/g, "")
      .replace(/<hyperlinks\b[\s\S]*?<\/hyperlinks>/g, "")
      .replace(/<oleObjects\b[\s\S]*?<\/oleObjects>/g, "")
      .replace(/<controls\b[\s\S]*?<\/controls>/g, "")
      .replace(/<extLst\b[\s\S]*?<\/extLst>/g, "")
      // r:id de pageSetup y vm= de las celdas #VALUE! decorativas
      .replace(/(<pageSetup\b[^>]*?)\s+r:id="[^"]*"/g, "$1")
      .replace(/\s+vm="\d+"/g, "")
  )
}

function construirWorkbook(nombres: readonly string[]): string {
  const hojas = nombres
    .map(
      (nombre, i) =>
        `<sheet name="${escaparXml(nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
    )
    .join("")
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="${NS_SS}/2006/main" xmlns:r="${NS_REL}">` +
    `<sheets>${hojas}</sheets>` +
    `</workbook>`
  )
}

function construirRelsWorkbook(cantidadHojas: number): string {
  const relaciones: string[] = []
  for (let i = 1; i <= cantidadHojas; i++) {
    relaciones.push(
      `<Relationship Id="rId${i}" Type="${NS_REL}/worksheet" ` +
        `Target="worksheets/sheet${i}.xml"/>`
    )
  }
  let siguiente = cantidadHojas + 1
  relaciones.push(
    `<Relationship Id="rId${siguiente++}" Type="${NS_REL}/theme" Target="theme/theme1.xml"/>`,
    `<Relationship Id="rId${siguiente++}" Type="${NS_REL}/styles" Target="styles.xml"/>`,
    `<Relationship Id="rId${siguiente++}" Type="${NS_REL}/sharedStrings" Target="sharedStrings.xml"/>`
  )
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    relaciones.join("") +
    `</Relationships>`
  )
}

function construirContentTypes(cantidadHojas: number): string {
  const tipo = (parte: string, sufijo: string) =>
    `<Override PartName="${parte}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.${sufijo}+xml"/>`
  const hojas: string[] = []
  for (let i = 1; i <= cantidadHojas; i++) {
    hojas.push(tipo(`/xl/worksheets/sheet${i}.xml`, "worksheet"))
  }
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    hojas.join("") +
    tipo("/xl/styles.xml", "styles") +
    tipo("/xl/sharedStrings.xml", "sharedStrings") +
    `<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
    `</Types>`
  )
}

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
