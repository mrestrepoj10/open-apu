/**
 * APU — Análisis de Precios Unitarios (formato INVIAS FR-APU-1).
 *
 * Un APU descompone el costo directo de una unidad de obra (p. ej. 1 m3 de
 * concreto clase D) en cuatro componentes: equipo, materiales, transporte y
 * mano de obra. NO incluye costos indirectos (AIU): el esquema es `strict`, así
 * que un documento con campos de administración / imprevistos / utilidad se
 * rechaza en vez de colarse como si fuera un precio de mercado.
 */
import { z } from "zod"
import {
  CantidadSchema,
  ComponenteSchema,
  CopSchema,
  FactorSchema,
  ProcedenciaSchema,
  SchemaVersionSchema,
  TextoSchema,
  VigenciaSchema,
} from "./comun"
import { RegionSchema } from "./region"

/**
 * Código de ítem de pago INVIAS. En el archivo fuente viene con comas
 * ("630,1,1"); el esquema exige la forma normalizada con puntos ("630.1.1").
 */
export const CodigoApuSchema = z
  .string()
  .regex(
    /^\d{3}(?:\.\d+)*$/,
    'Código de APU inválido: se espera "630.1.1" (normalizado con puntos)'
  )

/**
 * Una línea (insumo) dentro de un APU.
 *
 * Sobre `cantidad`: es el número que INVIAS pone en la columna CANTIDAD o
 * RENDIMIENTO según el componente. Se usa un solo nombre de campo a propósito;
 * su significado depende de `componente`:
 *
 * - `equipo`: horas de uso del equipo por unidad de obra.
 *   `subtotal = cantidad * precioUnitario`.
 * - `materiales`: cantidad de insumo por unidad de obra.
 *   `subtotal = cantidad * precioUnitario`.
 * - `transporte`: cantidad transportada por unidad de obra; se combina con
 *   `distancia` (km). `subtotal = cantidad * distancia * precioUnitario`.
 * - `manoDeObra`: RENDIMIENTO, es decir unidades de obra producidas por jornal.
 *   Aquí DIVIDE en vez de multiplicar: `subtotal = precioUnitario / cantidad`,
 *   donde `precioUnitario` es el jornal total de la cuadrilla con prestaciones.
 *
 * Las líneas de "herramienta menor" son un caso especial de `equipo`: INVIAS
 * las calcula como un porcentaje del subtotal de mano de obra, así que
 * `precioUnitario` es ese subtotal (la base) y `cantidad` es la fracción
 * (0.05 = 5 %), que además se repite en `porcentaje` para lectura directa.
 *
 * Los campos opcionales son deliberadamente laxos: el parser de xlsx los irá
 * afinando; ninguno es necesario para mostrar el precio con procedencia.
 */
export const ApuLineaSchema = z.strictObject({
  componente: ComponenteSchema,
  /** Código del insumo en los listados INVIAS, p. ej. "B0123630". */
  codigo: TextoSchema.optional(),
  descripcion: TextoSchema,
  /**
   * Unidad de la línea, p. ej. "m3", "kg", "h", "m3-km", "jornal", "%".
   * El formato FR-APU-1 no imprime unidad para equipo ni mano de obra: el
   * parser la resuelve desde los listados de insumos ("h" y "jornal").
   */
  unidad: TextoSchema,
  /**
   * Grafía original de la unidad en el archivo fuente, cuando difiere de la
   * canónica ("m3 - Km" → "m3-km"). Se conserva para poder mostrar el dato tal
   * como lo publica la fuente (no negociable 1: procedencia por número).
   */
  unidadCruda: TextoSchema.optional(),
  /** CANTIDAD o RENDIMIENTO según el componente (ver arriba). */
  cantidad: CantidadSchema,
  /** Tarifa / precio unitario / jornal total del insumo, en COP. */
  precioUnitario: CopSchema,
  /** Valor unitario de la línea, en COP. */
  subtotal: CopSchema,

  // — Extras conocidos, opcionales y laxos —
  /** Fracción aplicada (0.05 = 5 %): herramienta menor y similares. */
  porcentaje: FactorSchema.optional(),
  /** Monto base sobre el que se aplica `porcentaje`, en COP. */
  base: CopSchema.optional(),
  /** Distancia de acarreo en km (componente `transporte`). */
  distancia: CantidadSchema.optional(),
  /** Jornal base sin prestaciones, en COP (componente `manoDeObra`). */
  jornal: CopSchema.optional(),
  /** Factor prestacional aplicado al jornal (p. ej. 2.04). */
  factorPrestacional: FactorSchema.optional(),
})

/** Subtotales por componente, en COP. Los cuatro son obligatorios (0 si no aplica). */
export const TotalesPorComponenteSchema = z.strictObject({
  equipo: CopSchema,
  materiales: CopSchema,
  transporte: CopSchema,
  manoDeObra: CopSchema,
})

/**
 * Documento de nivel superior: un ítem de pago en una región y vigencia.
 * Es lo que se sirve en `/apu/<region>/<codigo>`.
 */
export const ApuSchema = z
  .strictObject({
    schemaVersion: SchemaVersionSchema,
    /** Ítem de pago normalizado, p. ej. "630.1.1". */
    codigo: CodigoApuSchema,
    descripcion: TextoSchema,
    /** Unidad de la obra analizada, p. ej. "m3". */
    unidad: TextoSchema,
    /**
     * Grafía original de la unidad en el archivo fuente, cuando difiere de la
     * canónica. El ÍNDICE INVIAS usa 14 grafías distintas para 11 unidades
     * ("Kg"/"kg", "m³"/"m3", "m3 - Km"/"m3 - km"/"m3 - E").
     */
    unidadCruda: TextoSchema.optional(),
    region: RegionSchema,
    /** Debe coincidir con `procedencia.vigencia`. */
    vigencia: VigenciaSchema,
    /** Capítulo constructivo del índice INVIAS (opcional). */
    capitulo: TextoSchema.optional(),
    /** Artículo de la especificación, p. ej. "Artículo 630 - 22" (opcional). */
    articulo: TextoSchema.optional(),
    /** Clasificación de la especificación técnica (opcional). */
    clasificacion: TextoSchema.optional(),
    totales: TotalesPorComponenteSchema,
    /**
     * Costo directo total, en COP. Suma de los cuatro componentes.
     * NO incluye AIU ni IVA (ver `NOTA_COSTO_DIRECTO`).
     */
    costoDirecto: CopSchema,
    lineas: z.array(ApuLineaSchema).min(1),
    procedencia: ProcedenciaSchema,
    /** Aclaraciones sobre este APU en particular (opcional). */
    nota: TextoSchema.optional(),
  })
  .refine((apu) => apu.vigencia === apu.procedencia.vigencia, {
    message: "vigencia debe coincidir con procedencia.vigencia",
    path: ["vigencia"],
  })

export type ApuLinea = z.infer<typeof ApuLineaSchema>
export type TotalesPorComponente = z.infer<typeof TotalesPorComponenteSchema>
export type Apu = z.infer<typeof ApuSchema>

/** Tolerancia de redondeo al comparar sumas, en COP. */
export const TOLERANCIA_COP = 1

/**
 * Revisa la aritmética de un APU ya validado: que los subtotales de las líneas
 * sumen los totales por componente y que los totales sumen el costo directo.
 *
 * Va aparte de `ApuSchema` porque una fuente puede traer descuadres de
 * redondeo legítimos: `ApuSchema` valida forma, esto valida coherencia.
 * Devuelve la lista de descuadres (vacía = todo cuadra).
 */
export function revisarCoherencia(
  apu: Apu,
  tolerancia: number = TOLERANCIA_COP
): string[] {
  const problemas: string[] = []

  for (const componente of Object.keys(apu.totales) as Array<
    keyof TotalesPorComponente
  >) {
    const suma = apu.lineas
      .filter((linea) => linea.componente === componente)
      .reduce((acc, linea) => acc + linea.subtotal, 0)
    const declarado = apu.totales[componente]
    if (Math.abs(suma - declarado) > tolerancia) {
      problemas.push(
        `totales.${componente}: declarado ${declarado}, suma de líneas ${suma}`
      )
    }
  }

  const sumaTotales =
    apu.totales.equipo +
    apu.totales.materiales +
    apu.totales.transporte +
    apu.totales.manoDeObra
  if (Math.abs(sumaTotales - apu.costoDirecto) > tolerancia) {
    problemas.push(
      `costoDirecto: declarado ${apu.costoDirecto}, suma de totales ${sumaTotales}`
    )
  }

  return problemas
}

/**
 * `ApuSchema` + coherencia aritmética. Es el validador que debería usar el
 * pipeline de datos antes de publicar: hace ruidosos los errores del parser.
 */
export const ApuCoherenteSchema = ApuSchema.superRefine((apu, ctx) => {
  for (const problema of revisarCoherencia(apu)) {
    ctx.addIssue({ code: "custom", message: problema })
  }
})
