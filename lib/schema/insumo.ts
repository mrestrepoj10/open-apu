/**
 * Insumo — un precio de referencia regionalizado para un recurso individual
 * (material, equipo, transporte o mano de obra), tal como aparece en las hojas
 * MATERIALES / EQUIPO / TRANSPORTE / MANO DE OBRA del archivo INVIAS.
 */
import { z } from "zod"
import {
  ComponenteSchema,
  CopSchema,
  FactorSchema,
  ProcedenciaSchema,
  SchemaVersionSchema,
  TextoSchema,
} from "./comun"
import { RegionSchema } from "./region"

/**
 * Un insumo se puede servir suelto (página de insumo, búsqueda), así que lleva
 * su propia `region` y `procedencia`: cualquier objeto con precio que circule
 * solo debe poder explicar de dónde salió (no negociable 1).
 *
 * No lleva `vigencia` de primer nivel; la vigencia vive en
 * `procedencia.vigencia` para no tener dos fuentes de verdad.
 */
export const InsumoSchema = z.strictObject({
  /** Código INVIAS del insumo, p. ej. "B0123630". Opcional: no toda fuente lo trae. */
  codigo: TextoSchema.optional(),
  componente: ComponenteSchema,
  descripcion: TextoSchema,
  /** Unidad del precio, p. ej. "m3", "kg", "h", "m3-km", "jornal". */
  unidad: TextoSchema,
  /**
   * Grafía original de la unidad en el archivo fuente, cuando difiere de la
   * canónica ("Km" → "km"). Se conserva por procedencia (no negociable 1).
   */
  unidadCruda: TextoSchema.optional(),
  /**
   * Categoría / clasificación que publica INVIAS, p. ej. "AGREGADOS" o
   * "CONCRETO Y MORTERO". Opcional: transporte y mano de obra no la traen.
   */
  categoria: TextoSchema.optional(),
  /** Precio de referencia en COP, costo directo (sin AIU). */
  precio: CopSchema,
  /**
   * Factor prestacional aplicado al jornal (≈ 2.03–2.05). Solo aplica al
   * componente `manoDeObra`: en los listados INVIAS el `precio` de un
   * trabajador es el salario base MENSUAL (nacional) y este factor es la única
   * cifra regionalizada, así que sin él el listado no sería regional.
   */
  factorPrestacional: FactorSchema.optional(),
  region: RegionSchema,
  procedencia: ProcedenciaSchema,
})

/**
 * Documento de nivel superior: el listado de insumos de una región y vigencia.
 * Cada insumo repite `region` y `procedencia` a propósito, para que siga siendo
 * autodescriptivo al extraerlo del listado.
 */
export const ListaInsumosSchema = z
  .strictObject({
    schemaVersion: SchemaVersionSchema,
    region: RegionSchema,
    procedencia: ProcedenciaSchema,
    insumos: z.array(InsumoSchema).min(1),
  })
  .refine(
    (lista) =>
      lista.insumos.every(
        (insumo) => insumo.region.codigo === lista.region.codigo
      ),
    {
      message: "todos los insumos deben pertenecer a la región del listado",
      path: ["insumos"],
    }
  )

export type Insumo = z.infer<typeof InsumoSchema>
export type ListaInsumos = z.infer<typeof ListaInsumosSchema>
