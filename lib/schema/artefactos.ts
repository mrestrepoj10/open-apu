/**
 * Artefactos publicados: la forma exacta de los JSON estáticos que genera
 * `scripts/pipeline.ts` y que consume el explorador web.
 *
 * `apu.ts` describe el dato de origen (un APU completo con su desglose);
 * este archivo describe los **agregados** que se sirven al navegador:
 *
 * | Artefacto                              | Esquema                 |
 * | -------------------------------------- | ----------------------- |
 * | `catalogo.json`                        | `CatalogoSchema`        |
 * | `items/{codigo}.json` (526)            | `ItemRegionalSchema`    |
 * | `provincias/{slug}.json` (140)         | `ProvinciaResumenSchema`|
 * | `stats.json`                           | `StatsSchema`           |
 *
 * Reglas que todos comparten:
 * - Llevan `schemaVersion` y `procedencia` (no negociable 1: todo número que
 *   se muestra puede rastrearse hasta su fuente, vigencia y licencia).
 * - `nota` repite `NOTA_COSTO_DIRECTO`: los precios son costo directo sin AIU
 *   y no son precios de mercado (no negociable 2).
 * - Ningún artefacto incluye AIU, precio total ni margen: los esquemas son
 *   `strict`, así que un documento que los traiga se rechaza.
 *
 * Compatible con el navegador: sin `node:*` ni APIs de Bun.
 */
import { z } from "zod"
import {
  CopSchema,
  ProcedenciaSchema,
  SchemaVersionSchema,
  TextoSchema,
  VigenciaSchema,
} from "./comun"
import { CodigoApuSchema, TotalesPorComponenteSchema } from "./apu"
import { RegionSchema, SlugSchema } from "./region"

/**
 * Capítulo del ítem: el **primer segmento del código** de pago, p. ej. `"630"`
 * en `630.1.1`. Es el agrupador fino y estable (sale del propio código).
 *
 * El ÍNDICE trae además una agrupación constructiva más gruesa
 * (`"Capitulo 6\nPavimentos"`, ocho valores); se publica descompuesta en
 * `capituloNumero` + `capituloNombre` para poder agrupar y rotular sin volver
 * a parsear texto.
 */
export const CapituloSchema = z
  .string()
  .regex(/^\d{3}$/, 'Capítulo inválido: 3 dígitos, p. ej. "630"')

/** Número de capítulo constructivo del ÍNDICE INVIAS (2…9). */
export const CapituloNumeroSchema = z.number().int().positive()

/**
 * Agregados de un conjunto de precios, en COP.
 *
 * Se publican los cuatro juntos a propósito: la **mediana** es la cifra
 * representativa de un ítem a nivel nacional (140 provincias con dispersión
 * alta), mientras que `min`/`max` documentan esa dispersión. Presentar solo el
 * promedio sería engañoso.
 *
 * Se calculan **omitiendo los ceros**. Un costo directo de 0 significa "el
 * ítem no aplica en esta región" (transporte marítimo tierra adentro,
 * FORMATO.md §6.5), no "cuesta cero": incluirlo haría que `min` fuera 0 en
 * varios ítems y un 0 nunca se debe presentar como precio. El número de
 * provincias que sí aportaron dato va aparte, en `provinciasConDato`.
 * Si ningún valor es positivo, los cuatro agregados valen 0.
 */
export const AgregadosSchema = z.strictObject({
  min: CopSchema,
  max: CopSchema,
  mediana: CopSchema,
  promedio: CopSchema,
})

/** Cabecera común a todo artefacto publicado. */
const cabecera = {
  schemaVersion: SchemaVersionSchema,
  vigencia: VigenciaSchema,
  procedencia: ProcedenciaSchema,
  /** Script que generó el archivo, p. ej. "scripts/pipeline.ts". */
  generadoPor: TextoSchema,
  /** Advertencia de costo directo (`NOTA_COSTO_DIRECTO`). */
  nota: TextoSchema,
}

// —————————————————————————— catalogo.json ——————————————————————————

/** Una fila del catálogo nacional: el ítem y su dispersión de precio. */
export const CatalogoItemSchema = z.strictObject({
  codigo: CodigoApuSchema,
  /** Descripción completa (título + alcance entre paréntesis, con `\n`). */
  descripcion: TextoSchema,
  unidad: TextoSchema,
  unidadCruda: TextoSchema.optional(),
  capitulo: CapituloSchema,
  capituloNumero: CapituloNumeroSchema.optional(),
  capituloNombre: TextoSchema.optional(),
  clasificacion: TextoSchema.optional(),
  /** Agregados del costo directo sobre las provincias con dato. */
  costoDirecto: AgregadosSchema,
  /** Provincias con costo directo positivo (ver `AgregadosSchema`). */
  provinciasConDato: z.number().int().nonnegative(),
})

/**
 * `catalogo.json`: los 526 ítems con sus agregados nacionales. Es el índice de
 * la aplicación; no trae desglose ni precios por provincia.
 */
export const CatalogoSchema = z.strictObject({
  ...cabecera,
  /** Nº de provincias sobre las que se calcularon los agregados. */
  provincias: z.number().int().positive(),
  items: z.array(CatalogoItemSchema).min(1),
})

// ———————————————————— items/{codigo}.json ————————————————————

/** El precio de un ítem en una provincia concreta. */
export const ItemRegionSchema = z.strictObject({
  region: RegionSchema,
  totales: TotalesPorComponenteSchema,
  costoDirecto: CopSchema,
})

/**
 * `items/{codigo}.json`: un ítem de pago con su precio en las 140 provincias.
 * Alimenta el mapa y la tabla comparativa. El desglose (líneas) NO va aquí:
 * vive en `apu_lineas.parquet`, que se consulta por ítem.
 */
export const ItemRegionalSchema = z.strictObject({
  ...cabecera,
  codigo: CodigoApuSchema,
  descripcion: TextoSchema,
  unidad: TextoSchema,
  unidadCruda: TextoSchema.optional(),
  capitulo: CapituloSchema,
  capituloNumero: CapituloNumeroSchema.optional(),
  capituloNombre: TextoSchema.optional(),
  articulo: TextoSchema.optional(),
  clasificacion: TextoSchema.optional(),
  /**
   * Aclaración del propio libro fuente sobre este ítem (p. ej. líneas que
   * INVIAS dejó sin resolver). Distinta de `nota`, que es la advertencia
   * general de costo directo.
   */
  notaFuente: TextoSchema.optional(),
  agregados: AgregadosSchema,
  /** Provincias con costo directo positivo (ver `AgregadosSchema`). */
  provinciasConDato: z.number().int().nonnegative(),
  /** Una fila por provincia, ordenadas por `region.slug`. */
  regiones: z.array(ItemRegionSchema).min(1),
})

// ———————————————— provincias/{slug}.json ————————————————

/**
 * Resumen de un ítem dentro de una provincia.
 *
 * `titulo` es la **primera línea** de la descripción INVIAS (sin el alcance
 * entre paréntesis): la lista de 526 ítems se repite en las 140 provincias y
 * publicar la descripción completa multiplicaría por tres el peso del
 * artefacto. El texto íntegro está en `catalogo.json` y en `items/{codigo}.json`.
 */
export const ProvinciaItemSchema = z.strictObject({
  codigo: CodigoApuSchema,
  titulo: TextoSchema,
  unidad: TextoSchema,
  capitulo: CapituloSchema,
  costoDirecto: CopSchema,
})

/**
 * `provincias/{slug}.json`: los 526 ítems resueltos para una provincia.
 * Alimenta la página de provincia.
 */
export const ProvinciaResumenSchema = z.strictObject({
  ...cabecera,
  region: RegionSchema,
  /** Agregados del costo directo de los 526 ítems de esta provincia. */
  agregados: AgregadosSchema,
  /** Ítems con costo directo positivo en esta provincia. */
  itemsConDato: z.number().int().nonnegative(),
  /** Ordenados por `codigo`. */
  items: z.array(ProvinciaItemSchema).min(1),
})

// ————————————————————————— stats.json —————————————————————————

export const ConteosSchema = z.strictObject({
  /** Ítems de pago distintos (526). */
  items: z.number().int().nonnegative(),
  /** Provincias con libro publicado (140). Bogotá D.C. no tiene: ver IDU. */
  provincias: z.number().int().nonnegative(),
  departamentos: z.number().int().nonnegative(),
  /** Filas ítem × provincia (526 × 140). */
  apus: z.number().int().nonnegative(),
  /** Líneas de desglose publicadas. */
  lineas: z.number().int().nonnegative(),
  /** Filas de insumo regional publicadas. */
  insumos: z.number().int().nonnegative(),
  /**
   * Líneas que el propio libro fuente dejó sin resolver (código de insumo que
   * no existe en el listado regional). Se omiten del desglose en vez de
   * publicarse en cero; se cuentan aquí por transparencia.
   */
  lineasSinResolver: z.number().int().nonnegative(),
})

export const CapituloStatSchema = z.strictObject({
  capitulo: CapituloSchema,
  items: z.number().int().positive(),
})

export const CapituloInviasStatSchema = z.strictObject({
  numero: CapituloNumeroSchema,
  nombre: TextoSchema,
  items: z.number().int().positive(),
})

export const DepartamentoStatSchema = z.strictObject({
  codigoDane: z.string().regex(/^\d{2}$/),
  nombre: TextoSchema,
  provincias: z.number().int().positive(),
})

/** Provincia resumida por su mediana de costo directo (dispersión regional). */
export const ProvinciaStatSchema = z.strictObject({
  slug: SlugSchema,
  departamento: TextoSchema,
  provincia: TextoSchema,
  medianaCostoDirecto: CopSchema,
})

/** `stats.json`: cifras globales para la portada. */
export const StatsSchema = z.strictObject({
  ...cabecera,
  conteos: ConteosSchema,
  /** Agregados del costo directo sobre las 526 × 140 filas. */
  costoDirecto: AgregadosSchema,
  /** Ítems por capítulo (primer segmento del código), ordenados por capítulo. */
  capitulos: z.array(CapituloStatSchema).min(1),
  /** Ítems por capítulo constructivo del ÍNDICE, ordenados por número. */
  capitulosInvias: z.array(CapituloInviasStatSchema),
  /** Provincias por departamento, ordenadas por código DANE. */
  departamentos: z.array(DepartamentoStatSchema).min(1),
  /**
   * Extremos de dispersión regional. Son medianas de **costo directo de
   * referencia**, no precios de mercado ni índices de costo de vida.
   */
  notables: z.strictObject({
    provinciaMasCara: ProvinciaStatSchema,
    provinciaMasBarata: ProvinciaStatSchema,
  }),
})

export type Agregados = z.infer<typeof AgregadosSchema>
export type CatalogoItem = z.infer<typeof CatalogoItemSchema>
export type Catalogo = z.infer<typeof CatalogoSchema>
export type ItemRegion = z.infer<typeof ItemRegionSchema>
export type ItemRegional = z.infer<typeof ItemRegionalSchema>
export type ProvinciaItem = z.infer<typeof ProvinciaItemSchema>
export type ProvinciaResumen = z.infer<typeof ProvinciaResumenSchema>
export type Conteos = z.infer<typeof ConteosSchema>
export type Stats = z.infer<typeof StatsSchema>
