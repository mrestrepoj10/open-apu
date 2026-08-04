/**
 * Hoja `ÍNDICE`: la vía rápida.
 *
 * Con **una sola hoja leída** se obtienen los 526 ítems con descripción,
 * unidad, los cuatro subtotales y el costo directo (FORMATO.md §8.2). Es
 * suficiente para el listado del explorador; las hojas de ítem solo hacen falta
 * para el desglose.
 *
 * Todos esos valores son fórmulas con resultado cacheado (`INDIRECT` a las
 * celdas N53/N74/N84/N99/N101 de la hoja del ítem). Se lee el resultado, nunca
 * se evalúa (§8.3).
 */
import { z } from "zod"
import {
  CodigoApuSchema,
  CopSchema,
  TextoSchema,
  TotalesPorComponenteSchema,
  type TotalesPorComponente,
} from "../schema"
import { memo } from "./cache"
import { ES_HOJA_ITEM, HOJA_INDICE, INDICE } from "./coordenadas"
import { ParserError, afirmar } from "./errores"
import type { Libro } from "./libro"
import {
  codigoConComas,
  codigoDesdeNombreHoja,
  limpiarTexto,
  normalizarUnidad,
} from "./normalizar"
import type { Celdas } from "./xlsx"

/** Una fila del ÍNDICE, ya normalizada y validada. */
export const FilaIndiceSchema = z.strictObject({
  /** Número de fila en la hoja (5…530). Útil para mensajes de error. */
  fila: z.number().int().positive(),
  /** Consecutivo impreso en la columna A (1…526). */
  consecutivo: z.number().int().positive().optional(),
  /** Nombre de la hoja del ítem, identidad canónica: "630,1,1". */
  hoja: TextoSchema,
  /** Código normalizado del esquema: "630.1.1". */
  codigo: CodigoApuSchema,
  descripcion: TextoSchema,
  unidad: TextoSchema,
  /** Grafía original de la unidad, cuando difiere de la canónica. */
  unidadCruda: TextoSchema.optional(),
  capitulo: TextoSchema.optional(),
  articulo: TextoSchema.optional(),
  clasificacion: TextoSchema.optional(),
  totales: TotalesPorComponenteSchema,
  costoDirecto: CopSchema,
})

export type FilaIndice = z.infer<typeof FilaIndiceSchema>

/**
 * Lee las 526 filas del ÍNDICE.
 *
 * Terminación robusta (FORMATO.md §2): se avanza desde la fila 5 mientras la
 * columna E tenga valor. No hay fila de totales ni marcador de fin.
 */
export function parseIndice(libro: Libro): FilaIndice[] {
  return memo(libro, "indice", () => {
    const celdas = libro.celdas(HOJA_INDICE)
    const filas: FilaIndice[] = []
    for (let fila = INDICE.primeraFila; ; fila++) {
      const crudo = celdas.get(`${INDICE.columnas.codigo}${fila}`)?.valor
      const hoja = codigoConComas(crudo)
      if (hoja === null) break
      filas.push(leerFila(libro, celdas, fila, hoja))
    }
    afirmar(
      filas.length > 0,
      `el ÍNDICE está vacío a partir de la fila ${INDICE.primeraFila}`,
      { archivo: libro.archivo, hoja: HOJA_INDICE }
    )
    return filas
  })
}

/** Índice por nombre de hoja, para cruzar con las hojas de ítem. */
export function indicePorHoja(libro: Libro): ReadonlyMap<string, FilaIndice> {
  return memo(
    libro,
    "indicePorHoja",
    () => new Map(parseIndice(libro).map((fila) => [fila.hoja, fila]))
  )
}

function leerFila(
  libro: Libro,
  celdas: Celdas,
  fila: number,
  hoja: string
): FilaIndice {
  const ubicacion = { archivo: libro.archivo, hoja: HOJA_INDICE }
  const col = INDICE.columnas
  const texto = (columna: string) =>
    limpiarTexto(celdas.get(`${columna}${fila}`)?.valor) ?? undefined
  const cop = (columna: string, etiqueta: string) => {
    const celda = `${columna}${fila}`
    const valor = celdas.get(celda)?.valor
    if (typeof valor !== "number") {
      throw new ParserError(
        `${etiqueta} del ítem "${hoja}" no es numérico (${JSON.stringify(valor ?? null)})`,
        { ...ubicacion, celda }
      )
    }
    return valor
  }

  afirmar(
    ES_HOJA_ITEM.test(hoja),
    `el código "${hoja}" no tiene la forma de un ítem de pago`,
    { ...ubicacion, celda: `${col.codigo}${fila}` }
  )

  const descripcion = texto(col.descripcion)
  afirmar(descripcion, `el ítem "${hoja}" no trae descripción`, {
    ...ubicacion,
    celda: `${col.descripcion}${fila}`,
  })
  const unidad = normalizarUnidad(celdas.get(`${col.unidad}${fila}`)?.valor)
  afirmar(unidad, `el ítem "${hoja}" no trae unidad`, {
    ...ubicacion,
    celda: `${col.unidad}${fila}`,
  })

  const consecutivo = celdas.get(`${col.consecutivo}${fila}`)?.valor
  const totales: TotalesPorComponente = {
    equipo: cop(col.equipo, "subtotal de equipo"),
    materiales: cop(col.materiales, "subtotal de materiales"),
    transporte: cop(col.transporte, "subtotal de transporte"),
    manoDeObra: cop(col.manoDeObra, "subtotal de mano de obra"),
  }

  const candidata = {
    fila,
    consecutivo: typeof consecutivo === "number" ? consecutivo : undefined,
    hoja,
    codigo: codigoDesdeNombreHoja(hoja),
    descripcion,
    unidad: unidad.unidad,
    unidadCruda: unidad.cruda === unidad.unidad ? undefined : unidad.cruda,
    capitulo: texto(col.capitulo),
    articulo: texto(col.articulo),
    clasificacion: texto(col.clasificacion),
    totales,
    costoDirecto: cop(col.costoDirecto, "costo directo"),
  }

  const resultado = FilaIndiceSchema.safeParse(candidata)
  if (!resultado.success) {
    throw new ParserError(
      `fila de ÍNDICE inválida para "${hoja}": ` +
        resultado.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      { ...ubicacion, celda: `${col.codigo}${fila}` }
    )
  }
  return resultado.data
}
