/**
 * Piezas comunes del esquema APU Stack.
 *
 * Todo lo que vive en `lib/` debe ser compatible con el navegador: aquí no se
 * importa `node:*` ni APIs exclusivas de Bun.
 */
import { z } from "zod"

/**
 * Versión del esquema de datos (no del paquete). Va embebida en cada documento
 * de nivel superior (`Apu`, `ListaInsumos`) para que un archivo estático
 * generado con una versión vieja falle de forma ruidosa al validarse.
 *
 * Se incrementa cuando cambia la forma de los documentos publicados.
 */
export const SCHEMA_VERSION = "0.1.0"

export const SchemaVersionSchema = z.literal(SCHEMA_VERSION)

/**
 * Los precios de referencia son COSTO DIRECTO: no incluyen AIU
 * (administración, imprevistos, utilidad) ni IVA, y no son precios de mercado.
 * El esquema es `strict`, así que un documento que traiga campos de costos
 * indirectos es rechazado en vez de mostrarse como si fueran precios finales.
 */
export const NOTA_COSTO_DIRECTO =
  "Costo directo de referencia: no incluye AIU (administración, imprevistos, " +
  "utilidad) ni IVA. No es un precio de mercado."

/** Texto obligatorio, sin espacios sobrantes. */
export const TextoSchema = z.string().trim().min(1)

/**
 * Dinero en pesos colombianos (COP).
 *
 * Los valores son pesos, NO centavos, y pueden traer decimales: las fuentes
 * INVIAS publican precios calculados con varios decimales (p. ej.
 * `709617.1028062504`). No se redondea en el esquema; redondear es decisión de
 * la capa de presentación.
 */
export const CopSchema = z.number().nonnegative()

/**
 * Cantidad / rendimiento. No negativa; puede ser fraccionaria (0.5 h de
 * vibrador por m3) o grande (14 m3 por jornal).
 */
export const CantidadSchema = z.number().nonnegative()

/** Factor adimensional no negativo (porcentajes, factores prestacionales). */
export const FactorSchema = z.number().nonnegative()

/**
 * Vigencia de la publicación INVIAS: año + semestre, p. ej. "2026-1".
 * INVIAS publica dos actualizaciones por año (I y II semestre).
 */
export const VigenciaSchema = z
  .string()
  .regex(
    /^\d{4}-[12]$/,
    'Vigencia inválida: se espera "AAAA-S", p. ej. "2026-1"'
  )

/**
 * Los cuatro componentes en los que INVIAS descompone un APU. El orden es el
 * de las secciones del formato FR-APU-1 (I. Equipo, II. Materiales,
 * III. Transportes, IV. Mano de obra).
 */
export const COMPONENTES = [
  "equipo",
  "materiales",
  "transporte",
  "manoDeObra",
] as const

export const ComponenteSchema = z.enum(COMPONENTES)

/**
 * Procedencia: de dónde salió el número, de cuándo es y bajo qué licencia se
 * puede usar. Es obligatoria en todo objeto que pueda circular solo y que
 * contenga precios (`Apu`, `Insumo`, `ListaInsumos`).
 *
 * `ApuLinea` NO la lleva a propósito: una línea no existe fuera de su APU, y
 * su procedencia es la del documento que la contiene.
 */
export const ProcedenciaSchema = z.strictObject({
  /** Entidad que publica el dato, p. ej. "INVIAS". */
  fuente: TextoSchema,
  /** URL pública desde donde se obtuvo el archivo fuente. */
  url: z.url(),
  /** Vigencia de la publicación, p. ej. "2026-1". */
  vigencia: VigenciaSchema,
  /** Fecha ISO (AAAA-MM-DD) en que se descargó el archivo fuente. */
  fechaDescarga: z.iso.date(),
  /** Condiciones de uso del dato (texto libre, debe ser explícito). */
  licencia: TextoSchema,
  /** Nombre del archivo fuente, p. ej. "APU_0509_ANTIOQUIA__…_2026_1.xlsx". */
  archivo: TextoSchema.optional(),
  /** Aclaraciones adicionales (p. ej. que el dato es ilustrativo). */
  nota: TextoSchema.optional(),
})

export type Componente = z.infer<typeof ComponenteSchema>
export type Vigencia = z.infer<typeof VigenciaSchema>
export type Procedencia = z.infer<typeof ProcedenciaSchema>
