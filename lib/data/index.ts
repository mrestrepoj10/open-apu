/**
 * Capa de lectura de datos de APU Stack: la API que consumen las rutas.
 *
 * ```ts
 * import { getCatalogo, getItem, getDesglose } from "@/lib/data"
 * ```
 *
 * ## Solo servidor
 *
 * Todo lo que hay debajo lee disco (`node:fs/promises`) en build y en ISR.
 * No importar desde un componente `"use client"`: el build fallará al intentar
 * empaquetar `node:fs`. (El paquete `server-only` no está instalado; la
 * política del repo es dependencias mínimas y el import de `node:*` ya hace
 * ruidoso el error.)
 *
 * ## Envoltorios finos sobre funciones puras
 *
 * Cada `getX` de este archivo es un envoltorio de tres líneas —directiva,
 * `cacheLife`, `cacheTag`— sobre una función pura de `leer.ts` o
 * `desglose.ts`. El corte es deliberado:
 *
 * - `"use cache"` es una directiva del compilador de Next; fuera de un render
 *   de Next, `cacheLife`/`cacheTag` no tienen contexto donde escribir. Bajo
 *   `bun test` estos envoltorios no se pueden ejecutar.
 * - Por eso las pruebas (`lib/data/data.test.ts`) importan `leerCatalogo`,
 *   `leerItem`, `leerDesglose`… directamente. Toda la lógica (validación,
 *   agrupación por componente, criterio de destacados) vive ahí y se prueba
 *   ahí; aquí no hay nada que probar que no sea Next.
 *
 * ## Patrón de caché
 *
 * `"use cache"` + `cacheLife("max")` + `cacheTag(ETIQUETA_VIGENCIA)`, según
 * `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`
 * ("Caching function output with `use cache`" y "On-demand revalidation") y
 * `.../04-functions/cacheLife.md` (perfil `max`: stale 5 min, revalidate 30
 * días, expire 1 año — "Stable content that rarely changes").
 *
 * `max` es el perfil correcto porque el dato es un archivo estático versionado:
 * dentro de una vigencia NO cambia. Lo que lo invalida es publicar una
 * vigencia nueva, y eso es un despliegue (Build ID nuevo ⇒ caché nueva) o un
 * `revalidateTag(ETIQUETA_VIGENCIA)` explícito. La etiqueta es una sola y
 * común a propósito: el dato y su procedencia se invalidan juntos.
 *
 * Los `getX` se llaman desde componentes de servidor durante el prerender
 * (incluidos los flujos de `generateStaticParams`). Leer disco dentro de
 * `"use cache"` es válido: la restricción de Cache Components es sobre APIs de
 * petición (`cookies()`, `headers()`, `searchParams`) y sobre promesas de
 * datos dinámicos creadas fuera del ámbito cacheado, no sobre E/S de archivos
 * — ver "Constraints › Request-time APIs" en `use-cache.md` y "Working with
 * deterministic operations" en `01-getting-started/08-caching.md`. Verificado
 * en un `next build` real: las rutas que solo usan estos lectores salen
 * marcadas como estáticas.
 *
 * ## Nota de despliegue (Vercel)
 *
 * Las rutas se componen en tiempo de ejecución (`items/${codigo}.json`), así
 * que el trazado automático de archivos de Next no puede deducirlas: sin
 * ayuda, el build traza CERO archivos de `data/` y una página generada por ISR
 * no encontraría nada. Por eso `next.config.ts` declara
 * `outputFileTracingIncludes` para `"/**"` (verificado: 670 archivos trazados).
 * Si se publica una vigencia nueva hay que actualizar esos globs junto con
 * `VIGENCIA_ACTUAL`.
 */
import { cacheLife, cacheTag } from "next/cache"
import type {
  Catalogo,
  ItemRegional,
  ProvinciaResumen,
  Stats,
} from "@/lib/schema"
import { ETIQUETA_VIGENCIA } from "./constantes"
import {
  elegirDestacados,
  leerCatalogo,
  leerItem,
  leerProvincia,
  leerStats,
  listarCodigos,
  listarSlugs,
} from "./leer"
import { leerDesglose, type Desglose } from "./desglose"

export {
  ETIQUETA_VIGENCIA,
  N_DESTACADOS,
  VIGENCIA_ACTUAL,
  dirJson,
  dirParquet,
} from "./constantes"
export type { ComponenteDesglose, Desglose, LineaDesglose } from "./desglose"

/**
 * `catalogo.json`: los 526 ítems con descripción, unidad, capítulo y los
 * agregados nacionales de costo directo. Es el índice de la aplicación.
 *
 * Lanza si el artefacto falta o no valida (sin catálogo no hay sitio); los
 * lectores que sí pueden devolver `null` son `getItem` y `getProvincia`.
 */
export async function getCatalogo(): Promise<Catalogo> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)
  return leerCatalogo()
}

/**
 * `items/{codigo}.json`: el ítem con su precio en las 140 provincias.
 * `null` si el código no existe o no tiene forma de código INVIAS ⇒ `notFound()`.
 */
export async function getItem(codigo: string): Promise<ItemRegional | null> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)
  return leerItem(codigo)
}

/**
 * `provincias/{slug}.json`: los 526 ítems resueltos para una provincia.
 * `null` si el slug no existe ⇒ `notFound()`.
 *
 * Bogotá D.C. nunca existe aquí: está fuera del alcance de INVIAS (la
 * referencia es el IDU). Ver `AGENTS.md`, no negociable 5.
 */
export async function getProvincia(
  slug: string
): Promise<ProvinciaResumen | null> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)
  return leerProvincia(slug)
}

/** `stats.json`: conteos y agregados globales para la portada. Lanza si falta. */
export async function getStats(): Promise<Stats> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)
  return leerStats()
}

/**
 * El desglose (líneas por componente) de un ítem en una provincia, leído por
 * consulta puntual sobre `apu_lineas.parquet` (~6 ms en caliente).
 * `null` si el par no existe o el ítem no aplica en esa región.
 */
export async function getDesglose(
  codigo: string,
  slug: string
): Promise<Desglose | null> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)
  return leerDesglose(codigo, slug)
}

/**
 * Los 526 códigos en forma de puntos (`"630.1.1"`), en orden de catálogo.
 * Para `generateStaticParams` de la ruta de ítem.
 */
export async function getTodosLosCodigos(): Promise<string[]> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)
  return listarCodigos()
}

/**
 * Los 140 slugs de provincia, alfabéticos.
 * Para `generateStaticParams` de la ruta de provincia.
 */
export async function getTodosLosSlugs(): Promise<string[]> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)
  return listarSlugs()
}

/**
 * Los 30 códigos destacados: el corte de ítems cuyo desglose se prerrenderiza
 * en las 140 provincias (30 × 140 ≈ 4 200 páginas); el resto queda para ISR.
 * El criterio —familia 630 completa + ronda por capítulo INVIAS ordenando por
 * mediana— está documentado en `elegirDestacados` (`leer.ts`).
 */
export async function getCodigosDestacados(): Promise<string[]> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)
  return elegirDestacados(await leerCatalogo())
}
