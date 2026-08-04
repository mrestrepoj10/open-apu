/**
 * El inventario de URLs públicas del sitio: la fuente única del sitemap y del
 * robots.txt (que necesita saber cuántos archivos de sitemap hay).
 *
 * El sitio es una matriz: 526 ítems × 140 provincias = 73 640 páginas de
 * desglose, más los ítems, las provincias y los tres índices. Se publican todas
 * aunque solo una parte esté prerrenderizada: el resto se genera por ISR en la
 * primera visita, y para un rastreador la diferencia es invisible.
 *
 * Solo servidor (`lib/data` lee disco).
 */
import { cacheLife, cacheTag } from "next/cache"

import {
  ETIQUETA_VIGENCIA,
  getStats,
  getTodosLosCodigos,
  getTodosLosSlugs,
} from "@/lib/data"
import { SITIO_URL } from "@/lib/site"

export type UrlDelSitio = {
  url: string
  prioridad: number
}

/** Índices navegables, en orden de importancia. */
const INDICES: readonly UrlDelSitio[] = [
  { url: "", prioridad: 1 },
  { url: "/items", prioridad: 0.9 },
  { url: "/provincias", prioridad: 0.9 },
]

/**
 * Cuántas URLs publica el sitio. Se cuenta sin materializar la lista: el
 * robots.txt solo necesita el número para saber cuántos sitemaps referenciar.
 */
export async function contarUrls(): Promise<number> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const [codigos, slugs] = await Promise.all([
    getTodosLosCodigos(),
    getTodosLosSlugs(),
  ])

  return (
    INDICES.length +
    codigos.length +
    slugs.length +
    codigos.length * slugs.length
  )
}

/**
 * Todas las URLs, en el mismo orden estable en que se cuentan: índices, ítems,
 * provincias y por último la matriz de desgloses. El orden importa porque el
 * sitemap se parte en archivos por rangos: si cambiara entre invocaciones, un
 * archivo podría repetir u omitir URLs.
 */
export async function urlsDelSitio(): Promise<UrlDelSitio[]> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const [codigos, slugs] = await Promise.all([
    getTodosLosCodigos(),
    getTodosLosSlugs(),
  ])

  const urls: UrlDelSitio[] = [...INDICES]

  for (const codigo of codigos) {
    urls.push({ url: `/items/${codigo}`, prioridad: 0.8 })
  }
  for (const slug of slugs) {
    urls.push({ url: `/provincias/${slug}`, prioridad: 0.7 })
  }
  for (const codigo of codigos) {
    for (const slug of slugs) {
      urls.push({ url: `/items/${codigo}/${slug}`, prioridad: 0.5 })
    }
  }

  return urls
}

/** URL absoluta a partir de una ruta ("" → la portada). */
export function absoluta(ruta: string): string {
  return ruta === "" ? SITIO_URL : `${SITIO_URL}${ruta}`
}

/**
 * Fecha de última modificación del contenido: la de descarga del libro fuente.
 * Todo el sitio deriva de la misma publicación, así que todas las URLs
 * comparten `lastmod` — y eso es exactamente lo que pasa en la realidad.
 */
export async function fechaDePublicacion(): Promise<string> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const { procedencia } = await getStats()
  return procedencia.fechaDescarga
}
