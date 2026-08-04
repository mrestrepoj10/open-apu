/**
 * Constantes de la capa de lectura: vigencia, rutas en disco y etiqueta de
 * caché. Un solo sitio que tocar cuando INVIAS publique 2026-2.
 *
 * Este archivo NO importa `node:*`: solo compone rutas con plantillas y
 * `process.cwd()`, así que puede importarse desde cualquier parte (los que sí
 * leen disco son `leer.ts` y `desglose.ts`).
 */

/**
 * Vigencia que sirve el explorador. INVIAS publica dos actualizaciones por año
 * (I y II semestre); mientras solo haya una publicada, esta constante es la
 * única fuente de verdad para rutas, etiqueta de caché y procedencia.
 */
export const VIGENCIA_ACTUAL = "2026-1"

/**
 * Etiqueta de caché de todo lo derivado de la vigencia (no negociable 1: el
 * dato y su procedencia viajan juntos, así que se invalidan juntos).
 *
 * Publicar una vigencia nueva = `revalidateTag(ETIQUETA_VIGENCIA)` (o un
 * despliegue, que ya invalida todo por Build ID).
 */
export const ETIQUETA_VIGENCIA = `vigencia-${VIGENCIA_ACTUAL}` as const

/**
 * Raíz del repositorio en tiempo de build / ISR.
 *
 * `process.cwd()` es el directorio del proyecto tanto en `next build` como en
 * la función de Vercel (Next fija el cwd a la raíz del proyecto trazado).
 * Se resuelve de forma perezosa —función, no constante— para no congelar el
 * valor al importar el módulo.
 */
export function raizProyecto(): string {
  return process.cwd()
}

/** `data/json/<vigencia>/` — los artefactos publicados. */
export function dirJson(): string {
  return `${raizProyecto()}/data/json/${VIGENCIA_ACTUAL}`
}

/** `data/parquet/vigencia=<vigencia>/` — el desglose columnar. */
export function dirParquet(): string {
  return `${raizProyecto()}/data/parquet/vigencia=${VIGENCIA_ACTUAL}`
}

export const RUTA_CATALOGO = () => `${dirJson()}/catalogo.json`
export const RUTA_STATS = () => `${dirJson()}/stats.json`
/** Los archivos se nombran con el código en forma de puntos: `630.1.1.json`. */
export const RUTA_ITEM = (codigo: string) => `${dirJson()}/items/${codigo}.json`
export const RUTA_PROVINCIA = (slug: string) =>
  `${dirJson()}/provincias/${slug}.json`
export const RUTA_APU_LINEAS = () => `${dirParquet()}/apu_lineas.parquet`

/**
 * Cuántos ítems entran en el corte destacado de la portada. Ver
 * `elegirDestacados` en `leer.ts`. (No es el corte prerrenderizado del
 * desglose; ese es la familia 630 sola — ver `elegirFamiliaDestacada`.)
 */
export const N_DESTACADOS = 30

/**
 * Familia de referencia que siempre entra en los destacados: 630 (concretos
 * estructurales) es la familia que usan los goldens del parser y la más
 * consultada de la fuente. También define el corte de desglose que se
 * prerrenderiza (`elegirFamiliaDestacada` en `leer.ts`).
 */
export const CAPITULO_DESTACADO = "630"
