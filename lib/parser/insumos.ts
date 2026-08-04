/**
 * Listados de insumos resueltos para la provincia del libro (FORMATO.md §4).
 *
 * Son las cuatro hojas **visibles** (MATERIALES, EQUIPO, MANO DE OBRA,
 * TRANSPORTE) que las hojas de ítem consultan por `VLOOKUP`. Ya traen el precio
 * de esta provincia, así que son la fuente natural del catálogo regional.
 *
 * Las matrices nacionales `INSUMO_*` (ocultas, con las 140 provincias en cada
 * libro) son alcance del pipeline de `scripts/`, no de esta función; se llega a
 * ellas con `libro.celdas("INSUMO_EQUIPO")`.
 */
import {
  ListaInsumosSchema,
  SCHEMA_VERSION,
  type Insumo,
  type ListaInsumos,
  type Procedencia,
  type Region,
} from "../schema"
import {
  HOJA_MANO_DE_OBRA,
  LISTADOS_INSUMOS,
  type HojaInsumos,
} from "./coordenadas"
import { ParserError } from "./errores"
import type { Libro } from "./libro"
import { limpiarTexto, normalizarUnidad } from "./normalizar"
import { parseRegion } from "./region"

export interface OpcionesInsumos {
  procedencia: Procedencia
  region?: Region
  /** Limita el parseo a estas hojas (por defecto, las cuatro visibles). */
  hojas?: readonly string[]
}

/** Catálogo regional de insumos, listo para publicar. */
export function parseInsumos(
  libro: Libro,
  opciones: OpcionesInsumos
): ListaInsumos {
  const region = opciones.region ?? parseRegion(libro)
  const procedencia: Procedencia = {
    ...opciones.procedencia,
    archivo: opciones.procedencia.archivo ?? libro.archivo,
  }
  const listados = LISTADOS_INSUMOS.filter(
    (listado) => !opciones.hojas || opciones.hojas.includes(listado.hoja)
  )

  const insumos: Insumo[] = []
  for (const listado of listados) {
    if (!libro.tieneHoja(listado.hoja)) continue
    insumos.push(...leerListado(libro, listado, region, procedencia))
  }

  const candidata = {
    schemaVersion: SCHEMA_VERSION,
    region,
    procedencia,
    insumos,
  }
  const resultado = ListaInsumosSchema.safeParse(candidata)
  if (!resultado.success) {
    throw new ParserError(
      "listado de insumos inválido: " +
        resultado.error.issues
          .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
          .join("; "),
      { archivo: libro.archivo }
    )
  }
  return resultado.data
}

function leerListado(
  libro: Libro,
  listado: HojaInsumos,
  region: Region,
  procedencia: Procedencia
): Insumo[] {
  const celdas = libro.celdas(listado.hoja)
  const col = listado.columnas
  const insumos: Insumo[] = []

  for (let fila = listado.primeraFila; ; fila++) {
    const codigo = limpiarTexto(celdas.get(`${col.codigo}${fila}`)?.valor)
    if (codigo === null) break

    const descripcion = limpiarTexto(
      celdas.get(`${col.descripcion}${fila}`)?.valor
    )
    if (descripcion === null) {
      throw new ParserError(`el insumo "${codigo}" no trae descripción`, {
        archivo: libro.archivo,
        hoja: listado.hoja,
        celda: `${col.descripcion}${fila}`,
      })
    }

    const precio = celdas.get(`${col.precio}${fila}`)?.valor
    if (typeof precio !== "number") {
      // Caso conocido: HERMENINV ("HERRAMIENTA MENOR (% MANO DE OBRA)") existe
      // en el listado EQUIPO **sin celda de precio**, porque no es un insumo con
      // tarifa sino un porcentaje del subtotal de mano de obra. Se omite en vez
      // de inventarle un 0.
      //
      // Distinto es un precio que sí viene y vale 0 (transporte marítimo/fluvial
      // en provincias sin acceso al mar): ese sí se publica, porque significa
      // "no aplica en esta región" y la UI debe poder distinguirlo de "no hay
      // dato" (FORMATO.md §6.5). Lo que nunca se debe hacer es presentarlo como
      // precio.
      continue
    }

    const unidad = col.unidad
      ? normalizarUnidad(celdas.get(`${col.unidad}${fila}`)?.valor)
      : null
    const canonica = unidad ?? {
      unidad: listado.unidadPorDefecto ?? "",
      cruda: listado.unidadPorDefecto ?? "",
    }
    if (canonica.unidad === "") {
      throw new ParserError(`el insumo "${codigo}" no trae unidad`, {
        archivo: libro.archivo,
        hoja: listado.hoja,
        celda: col.unidad ? `${col.unidad}${fila}` : undefined,
      })
    }

    const insumo: Insumo = {
      codigo,
      componente: listado.componente,
      descripcion,
      unidad: canonica.unidad,
      precio,
      region,
      procedencia,
    }
    if (canonica.cruda !== canonica.unidad) insumo.unidadCruda = canonica.cruda
    const categoria = col.categoria
      ? limpiarTexto(celdas.get(`${col.categoria}${fila}`)?.valor)
      : null
    if (categoria !== null) insumo.categoria = categoria
    if (col.factorPrestacional) {
      const factor = celdas.get(`${col.factorPrestacional}${fila}`)?.valor
      if (typeof factor === "number") insumo.factorPrestacional = factor
    }
    insumos.push(insumo)
  }
  return insumos
}

/**
 * Bloque salarial de referencia de la hoja MANO DE OBRA (filas 4–7).
 * Dato de procedencia relevante: los precios de la vigencia 2026-1 se calculan
 * sobre el SMLMV de **2025** (FORMATO.md §4.4).
 */
export interface ReferenciaSalarial {
  concepto: string
  unidad?: string
  valor: number
}

export function parseReferenciaSalarial(libro: Libro): ReferenciaSalarial[] {
  if (!libro.tieneHoja(HOJA_MANO_DE_OBRA)) return []
  const celdas = libro.celdas(HOJA_MANO_DE_OBRA)
  const referencias: ReferenciaSalarial[] = []
  for (let fila = 4; fila <= 7; fila++) {
    const concepto = limpiarTexto(celdas.get(`D${fila}`)?.valor)
    const valor = celdas.get(`G${fila}`)?.valor
    if (concepto === null || typeof valor !== "number") continue
    referencias.push({
      concepto,
      unidad: limpiarTexto(celdas.get(`B${fila}`)?.valor) ?? undefined,
      valor,
    })
  }
  return referencias
}
