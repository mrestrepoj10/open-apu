/**
 * El padrón de las 140 provincias, con su mediana de costo directo.
 *
 * No existe un artefacto que publique las 140 regiones juntas: `stats.json`
 * solo trae conteos por departamento y `listarSlugs()` devuelve cadenas. Aquí
 * se compone leyendo los 140 `provincias/{slug}.json` —los mismos archivos que
 * ya lee cada hub de provincia, así que dentro de un build la caché los sirve
 * una sola vez— y se reduce a lo mínimo que necesitan el índice y el mapa:
 * región, mediana e ítems con dato.
 *
 * Deliberadamente NO se deriva el nombre del slug: `antioquia-valle-de-aburra`
 * no reconstruye "Valle de Aburrá". Los nombres salen del dato.
 *
 * Solo servidor (`lib/data` lee disco).
 */
import { cacheLife, cacheTag } from "next/cache"

import { ETIQUETA_VIGENCIA, getProvincia, getTodosLosSlugs } from "@/lib/data"
import type { Region } from "@/lib/schema"

export type ProvinciaListada = {
  region: Region
  /** Mediana del costo directo de los 526 ítems en esa provincia. */
  mediana: number
  /** Ítems con costo directo positivo (los demás no aplican en la región). */
  itemsConDato: number
}

export type GrupoDepartamento = {
  codigoDane: string
  departamento: string
  provincias: ProvinciaListada[]
}

/** Compara textos en español (tildes y ñ en su sitio). */
function compararEs(a: string, b: string): number {
  return a.localeCompare(b, "es-CO")
}

/**
 * Las 140 provincias con su mediana, ordenadas por departamento y provincia.
 */
export async function listarProvincias(): Promise<ProvinciaListada[]> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const slugs = await getTodosLosSlugs()
  const resumenes = await Promise.all(slugs.map((slug) => getProvincia(slug)))

  return resumenes
    .filter((resumen) => resumen !== null)
    .map((resumen) => ({
      region: resumen.region,
      mediana: resumen.agregados.mediana,
      itemsConDato: resumen.itemsConDato,
    }))
    .sort(
      (a, b) =>
        compararEs(a.region.departamento, b.region.departamento) ||
        compararEs(a.region.provincia, b.region.provincia)
    )
}

/** Agrupa el padrón por departamento, conservando el orden alfabético. */
export function agruparPorDepartamento(
  provincias: readonly ProvinciaListada[]
): GrupoDepartamento[] {
  const grupos = new Map<string, GrupoDepartamento>()

  for (const provincia of provincias) {
    const { codigoDane, departamento } = provincia.region
    const grupo = grupos.get(codigoDane)
    if (grupo) grupo.provincias.push(provincia)
    else
      grupos.set(codigoDane, {
        codigoDane,
        departamento,
        provincias: [provincia],
      })
  }

  return [...grupos.values()].sort((a, b) =>
    compararEs(a.departamento, b.departamento)
  )
}

/** Mediana de una lista de números (0 si está vacía). */
function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0
  const ordenados = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 0
    ? (ordenados[medio - 1] + ordenados[medio]) / 2
    : ordenados[medio]
}

/**
 * Mediana departamental para el mapa: la mediana de las medianas de sus
 * provincias. Es una cifra de dispersión regional del costo directo de
 * referencia — no un índice de costo de vida ni un precio de mercado.
 */
export function medianaPorDepartamento(
  provincias: readonly ProvinciaListada[]
): Record<string, number> {
  const porDane = new Map<string, number[]>()
  for (const provincia of provincias) {
    const lista = porDane.get(provincia.region.codigoDane)
    if (lista) lista.push(provincia.mediana)
    else porDane.set(provincia.region.codigoDane, [provincia.mediana])
  }

  return Object.fromEntries(
    [...porDane.entries()].map(([dane, valores]) => [dane, mediana(valores)])
  )
}
