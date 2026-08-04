/**
 * Desglose de un APU (ítem × provincia) leído de `apu_lineas.parquet`.
 *
 * **Solo servidor** (ver la nota de `leer.ts`) y **puro**: sin `"use cache"` ni
 * `next/cache`, para poder probarlo con `bun test` contra el Parquet real.
 *
 * ## Por qué Parquet y no JSON
 *
 * El desglose son 619 920 líneas (4 428 líneas × 140 provincias): pocos MB en
 * Parquet, cientos en JSON. `scripts/sql/apu_lineas.sql` lo ordena por
 * `(codigo, slug, orden)` con grupos de fila de 8 192 filas, así que las ~1 260
 * líneas de un ítem caen en **un solo grupo de fila** y las estadísticas
 * min/max de `codigo` por grupo dejan descartar el resto del archivo sin
 * leerlo. Eso es exactamente lo que hace hyparquet: `parquetReadObjects` con
 * `filter` poda grupos por estadísticas (`canSkipRowGroup`) y solo pide al
 * disco los rangos de bytes de los grupos supervivientes.
 *
 * Medido sobre el archivo real (3,2 MB, 76 grupos, zstd) en Bun/macOS arm64:
 * una consulta puntual toca **1 solo grupo** y tarda **~6 ms en caliente**
 * (~9 ms en frío, más ~8 ms de metadatos la primera vez del proceso).
 *
 * Lo invariante de esa medida son los BYTES, no los milisegundos: podando se
 * leen **85 KB**; sin podar, un escaneo de los 76 grupos lee **2 388 KB** y
 * tarda ~2 700 ms. El reloj de pared, en cambio, es puro hardware: los mismos
 * ~6 ms de macOS arm64 son 40-80 ms en un contenedor Linux y 196 ms en el
 * runner compartido de CI, dominados por la E/S. Por eso la prueba de
 * `data.test.ts` vigila el orden de magnitud (500 ms) y no un presupuesto
 * ajustado al mejor tiempo observado.
 *
 * Ojo con el orden: el archivo está ordenado numéricamente por segmentos
 * ("630.2" antes que "630.10"), pero las estadísticas de Parquet comparan
 * cadenas. Eso no rompe nada —un grupo que contiene X siempre tiene
 * `min ≤ X ≤ max` lexicográficamente— solo puede dejar pasar algún grupo de
 * más. Verificado: los códigos hostiles a la comparación lexicográfica
 * ("201.10") siguen resolviéndose en un puñado de milisegundos.
 */
import { open, stat } from "node:fs/promises"
import {
  cachedAsyncBuffer,
  parquetMetadataAsync,
  parquetReadObjects,
  type AsyncBuffer,
  type FileMetaData,
} from "hyparquet"
import { compressors } from "hyparquet-compressors"
import {
  ApuLineaSchema,
  CodigoApuSchema,
  COMPONENTES,
  SlugSchema,
  type ApuLinea,
  type Componente,
} from "@/lib/schema"
import { RUTA_APU_LINEAS, VIGENCIA_ACTUAL } from "./constantes"

/** Una línea del desglose: la línea del esquema más su posición en el APU. */
export interface LineaDesglose extends ApuLinea {
  /** Posición de la línea dentro del APU, tal como la publica la fuente. */
  orden: number
}

/** Las líneas de un componente (equipo, materiales, transporte, mano de obra). */
export interface ComponenteDesglose {
  componente: Componente
  /** Ordenadas por `orden`. */
  lineas: LineaDesglose[]
  /** Suma de los `subtotal` del componente, en COP, redondeada a 2 decimales. */
  subtotal: number
}

/** El desglose completo de un ítem en una provincia. */
export interface Desglose {
  codigo: string
  slug: string
  vigencia: string
  /** En el orden del formato FR-APU-1; solo los componentes con líneas. */
  componentes: ComponenteDesglose[]
  /**
   * Suma de los cuatro componentes, en COP. Debe coincidir con el
   * `costoDirecto` de `items/{codigo}.json` salvo ruido de redondeo.
   * Es COSTO DIRECTO: no incluye AIU ni IVA, y no es un precio de mercado.
   */
  total: number
  /** Número de líneas del desglose. */
  lineas: number
}

/** Columnas que se leen. `vigencia`/`region*`/`provincia` ya vienen del JSON. */
const COLUMNAS = [
  "codigo",
  "slug",
  "orden",
  "componente",
  "codigoInsumo",
  "descripcion",
  "unidad",
  "unidadCruda",
  "cantidad",
  "precioUnitario",
  "subtotal",
  "porcentaje",
  "base",
  "distancia",
  "jornal",
  "factorPrestacional",
] as const

/**
 * `AsyncBuffer` sobre un archivo local, por rangos de bytes.
 *
 * Se escribe aquí en vez de usar `asyncBufferFromFile` de hyparquet por dos
 * razones: (a) el paquete expone una condición de export `browser` distinta a
 * la de node y no queremos depender de cómo la resuelva el empaquetador de
 * Next, y (b) son quince líneas que dejan explícito que solo se leen los
 * rangos pedidos.
 */
async function bufferDeArchivo(ruta: string): Promise<AsyncBuffer> {
  const { size } = await stat(ruta)
  return {
    byteLength: size,
    async slice(inicio: number, fin?: number): Promise<ArrayBuffer> {
      const largo = Math.max(0, (fin ?? size) - inicio)
      if (largo === 0) return new ArrayBuffer(0)
      const destino = new Uint8Array(largo)
      const mango = await open(ruta, "r")
      try {
        await mango.read(destino, 0, largo, inicio)
      } finally {
        await mango.close()
      }
      return destino.buffer as ArrayBuffer
    },
  }
}

/**
 * Archivo y metadatos memoizados por proceso.
 *
 * Los metadatos (esquema + estadísticas de los 76 grupos de fila) cuestan ~8 ms
 * y no cambian: releerlos en cada una de las ~4 200 páginas de desglose que se
 * prerrenderizan serían 34 s tirados. `cachedAsyncBuffer` además reutiliza los
 * rangos de bytes ya leídos, acotados por el tamaño del archivo (3,2 MB).
 */
let archivoMemo: Promise<AsyncBuffer> | undefined
let metadatosMemo: Promise<FileMetaData> | undefined

async function archivo(): Promise<AsyncBuffer> {
  archivoMemo ??= bufferDeArchivo(RUTA_APU_LINEAS()).then((buffer) =>
    cachedAsyncBuffer(buffer)
  )
  return archivoMemo
}

async function metadatos(): Promise<FileMetaData> {
  metadatosMemo ??= archivo().then((file) => parquetMetadataAsync(file))
  return metadatosMemo
}

/** Redondeo a 2 decimales: las sumas de `double` arrastran ruido IEEE-754. */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

/** `null` de Parquet → `undefined`, que es lo que espera un campo opcional. */
function opcional(valor: unknown): number | undefined {
  return valor === null || valor === undefined ? undefined : (valor as number)
}

/**
 * Consulta puntual: el desglose del ítem `codigo` en la provincia `slug`.
 *
 * Devuelve `null` si el par no existe (la página hará `notFound()`). Un ítem
 * que no aplica en una región no tiene líneas publicadas: eso también es
 * `null`, no un desglose en cero (FORMATO.md §6.5).
 *
 * Ambos argumentos se validan antes de tocar el archivo: son segmentos de URL.
 */
export async function leerDesglose(
  codigo: string,
  slug: string
): Promise<Desglose | null> {
  if (!CodigoApuSchema.safeParse(codigo).success) return null
  if (!SlugSchema.safeParse(slug).success) return null

  const [file, metadata] = await Promise.all([archivo(), metadatos()])
  const filas = await parquetReadObjects({
    file,
    metadata,
    compressors,
    rowFormat: "object",
    columns: [...COLUMNAS],
    // Los dos predicados van juntos: `codigo` es el que poda grupos de fila
    // (el archivo está ordenado por él); `slug` filtra dentro del grupo.
    filter: { codigo: { $eq: codigo }, slug: { $eq: slug } },
  })
  if (filas.length === 0) return null

  const porComponente = new Map<Componente, LineaDesglose[]>()
  for (const fila of filas) {
    const componente = fila.componente as Componente
    // `ApuLineaSchema` es `strict`: se valida la línea sin `orden` y después se
    // le añade, en vez de relajar el esquema del dato.
    const linea = ApuLineaSchema.parse({
      componente,
      codigo: fila.codigoInsumo ?? undefined,
      descripcion: fila.descripcion,
      unidad: fila.unidad,
      unidadCruda: fila.unidadCruda ?? undefined,
      cantidad: fila.cantidad,
      precioUnitario: fila.precioUnitario,
      subtotal: fila.subtotal,
      porcentaje: opcional(fila.porcentaje),
      base: opcional(fila.base),
      distancia: opcional(fila.distancia),
      jornal: opcional(fila.jornal),
      factorPrestacional: opcional(fila.factorPrestacional),
    })
    const lista = porComponente.get(componente)
    const conOrden: LineaDesglose = { ...linea, orden: Number(fila.orden) }
    if (lista) lista.push(conOrden)
    else porComponente.set(componente, [conOrden])
  }

  // Orden del formato FR-APU-1 (I. Equipo, II. Materiales, III. Transportes,
  // IV. Mano de obra), no el orden en que salieron del archivo.
  const componentes: ComponenteDesglose[] = []
  for (const componente of COMPONENTES) {
    const lineas = porComponente.get(componente)
    if (!lineas) continue
    lineas.sort((a, b) => a.orden - b.orden)
    componentes.push({
      componente,
      lineas,
      subtotal: redondear(
        lineas.reduce((suma, linea) => suma + linea.subtotal, 0)
      ),
    })
  }

  return {
    codigo,
    slug,
    vigencia: VIGENCIA_ACTUAL,
    componentes,
    total: redondear(
      componentes.reduce((suma, grupo) => suma + grupo.subtotal, 0)
    ),
    lineas: filas.length,
  }
}
