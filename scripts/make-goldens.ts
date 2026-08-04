#!/usr/bin/env bun
/**
 * Regenera los goldens de `lib/parser/__goldens__/` a partir del extracto
 * `data/samples/sample-provincia.xlsx`.
 *
 * No necesita el archivo completo de INVIAS: trabaja sobre la muestra que sí
 * está en el repo, así que cualquiera puede reproducirlos.
 *
 * Uso:
 *   bun scripts/make-goldens.ts
 *
 * Si un golden cambia, hay que mirar el diff antes de aceptarlo: significa que
 * cambió lo que el parser publica.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { abrirLibro, parseIndice, parseInsumos, parseItem } from "../lib/parser"
import type { Componente, Procedencia } from "../lib/schema"

const RAIZ = resolve(import.meta.dir, "..")
const MUESTRA = join(RAIZ, "data/samples/sample-provincia.xlsx")
const GOLDENS = join(RAIZ, "lib/parser/__goldens__")

/**
 * Nombre real del libro del que salió el extracto. El parser deduce el código
 * de región del nombre de archivo, así que hay que pasarle este y no
 * "sample-provincia.xlsx".
 */
export const ARCHIVO_MUESTRA = "APU_0509_ANTIOQUIA__VALLE_DE_ABURRA_2026_1.xlsx"

/** Procedencia fija para que los goldens sean deterministas. */
export const PROCEDENCIA_MUESTRA: Procedencia = {
  fuente: "INVIAS",
  url: "https://www.invias.gov.co/publicaciones/4149/analisis-de-precios-unitarios-apu-regionalizados-de-referencia/",
  vigencia: "2026-1",
  fechaDescarga: "2026-08-03",
  licencia:
    "Datos oficiales de referencia del Instituto Nacional de Vías (INVIAS), " +
    "«Análisis de Precios Unitarios (APU) Regionalizados de Referencia», " +
    "vigencia 2026-1. Costos directos sin AIU; no son precios de mercado. " +
    "El aviso legal de INVIAS restringe el uso comercial sin autorización previa.",
  archivo: ARCHIVO_MUESTRA,
}

const libro = abrirLibro(readFileSync(MUESTRA), { archivo: ARCHIVO_MUESTRA })
mkdirSync(GOLDENS, { recursive: true })

const escribir = (nombre: string, valor: unknown) => {
  writeFileSync(join(GOLDENS, nombre), JSON.stringify(valor, null, 2) + "\n")
  console.log("  " + nombre)
}

console.log("goldens desde", MUESTRA)

// —— contexto compartido con las pruebas ——
escribir("contexto.json", {
  archivo: ARCHIVO_MUESTRA,
  procedencia: PROCEDENCIA_MUESTRA,
  items: [...libro.hojasDeItem],
})

// —— rebanada del ÍNDICE ——
const indice = parseIndice(libro)
const porHoja = new Map(indice.map((fila) => [fila.hoja, fila]))
/** Los 6 ítems cuyo código está guardado como número (FORMATO.md §6.4). */
const NUMERICOS = ["730,4", "730,5", "730,6", "730,7", "730,8", "731,1"]
const rebanada = (hojas: readonly string[]) =>
  hojas.map((hoja) => {
    const fila = porHoja.get(hoja)
    if (!fila) throw new Error(`el ÍNDICE no trae el ítem "${hoja}"`)
    return fila
  })

escribir("indice.json", {
  total: indice.length,
  primera: indice[0],
  ultima: indice[indice.length - 1],
  /** Grafías crudas de unidad presentes, para vigilar la normalización. */
  unidades: [...new Set(indice.map((f) => f.unidadCruda ?? f.unidad))].sort(),
  unidadesCanonicas: [...new Set(indice.map((f) => f.unidad))].sort(),
  numericos: rebanada(NUMERICOS),
  muestreados: rebanada(libro.hojasDeItem),
} satisfies Record<string, unknown>)

// —— un golden por ítem del extracto ——
for (const hoja of libro.hojasDeItem) {
  const apu = parseItem(libro, hoja, { procedencia: PROCEDENCIA_MUESTRA })
  escribir(`apu-${apu.codigo.replace(/\./g, "-")}.json`, apu)
}

// —— rebanada de insumos ——
const lista = parseInsumos(libro, { procedencia: PROCEDENCIA_MUESTRA })
const componentes: Componente[] = [
  "equipo",
  "materiales",
  "transporte",
  "manoDeObra",
]
escribir("insumos.json", {
  total: lista.insumos.length,
  porComponente: Object.fromEntries(
    componentes.map((c) => [
      c,
      lista.insumos.filter((i) => i.componente === c).length,
    ])
  ),
  region: lista.region,
  // Tres por componente: suficiente para fijar forma, unidades y factores sin
  // volcar el catálogo regional completo a un archivo de pruebas.
  muestra: componentes.flatMap((c) =>
    lista.insumos
      .filter((i) => i.componente === c)
      .slice(0, 3)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ region: _region, procedencia: _procedencia, ...resto }) => resto)
  ),
})

console.log(
  `listo: ${indice.length} filas de ÍNDICE, ${libro.hojasDeItem.length} ítems`
)
