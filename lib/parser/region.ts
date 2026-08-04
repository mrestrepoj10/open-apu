/**
 * Región (departamento × provincia) y metadatos de PORTADA.
 *
 * El código de 4 dígitos solo existe en el **nombre del archivo**
 * (`APU_0509_ANTIOQUIA__VALLE_DE_ABURRA_2026_1.xlsx`); el nombre acentuado de
 * la provincia solo existe dentro del libro (`PORTADA!F24`). Por eso hay dos
 * funciones: una que trabaja solo con el nombre y otra que además lee el libro.
 *
 * El `slug` sale de `slugRegion`, que quita tildes, así que ambas rutas
 * producen exactamente el mismo slug: `antioquia-valle-de-aburra`.
 */
import {
  DEPARTAMENTOS_DANE,
  RegionSchema,
  codigoDaneDeRegion,
  slugRegion,
  type Region,
} from "../schema"
import { memo } from "./cache"
import { HOJA_PORTADA, PORTADA } from "./coordenadas"
import { ParserError, afirmar } from "./errores"
import type { Libro } from "./libro"
import { capitalizarNombre, limpiarTexto } from "./normalizar"

/** `APU_<codigo4>_<DEPARTAMENTO>__<PROVINCIA>_<año>_<semestre>.xlsx` */
export const NOMBRE_ARCHIVO_APU =
  /^APU_(\d{4})_(.+?)__(.+?)_(\d{4})_([12])\.xlsx$/i

export interface DatosNombreArchivo {
  codigo: string
  departamentoCrudo: string
  provinciaCruda: string
  vigencia: string
}

/** Descompone el nombre de archivo INVIAS. `null` si no encaja. */
export function partirNombreArchivo(
  nombreArchivo: string
): DatosNombreArchivo | null {
  const coincide = NOMBRE_ARCHIVO_APU.exec(nombreArchivo.trim())
  if (!coincide) return null
  return {
    codigo: coincide[1]!,
    departamentoCrudo: coincide[2]!,
    provinciaCruda: coincide[3]!,
    vigencia: `${coincide[4]}-${coincide[5]}`,
  }
}

/**
 * Región a partir del nombre del archivo.
 *
 * El departamento se toma de la tabla DANE (nombre canónico con tildes), no
 * del nombre del archivo, que viene sin acentos. La provincia sí sale del
 * nombre de archivo, capitalizada: sin abrir el libro no hay forma de conocer
 * sus tildes. `parseRegion` la corrige leyendo PORTADA.
 */
export function parseRegionDesdeNombreArchivo(nombreArchivo: string): Region {
  const partes = partirNombreArchivo(nombreArchivo)
  if (!partes) {
    throw new ParserError(
      `nombre de archivo no reconocido: se esperaba ` +
        `APU_<codigo4>_<DEPARTAMENTO>__<PROVINCIA>_<AAAA>_<S>.xlsx`,
      { archivo: nombreArchivo }
    )
  }
  return construirRegion(
    partes.codigo,
    capitalizarNombre(partes.provinciaCruda),
    nombreArchivo
  )
}

/**
 * Región del libro abierto: código del nombre de archivo + provincia acentuada
 * de `PORTADA!F24`. Requiere que `abrirLibro` haya recibido `archivo`.
 */
export function parseRegion(libro: Libro): Region {
  return memo(libro, "region", () => {
    const archivo = libro.archivo
    afirmar(
      archivo !== undefined,
      "para resolver la región hace falta el nombre del archivo: " +
        "pasa `archivo` a abrirLibro()",
      {}
    )
    const partes = partirNombreArchivo(archivo)
    if (!partes) {
      throw new ParserError(
        "nombre de archivo no reconocido; no se puede deducir el código de región",
        { archivo }
      )
    }
    const portada = parsePortada(libro)
    return construirRegion(partes.codigo, portada.provincia, archivo)
  })
}

function construirRegion(
  codigo: string,
  provincia: string,
  archivo: string
): Region {
  const codigoDane = codigoDaneDeRegion(codigo)
  const departamento = DEPARTAMENTOS_DANE[codigoDane]
  if (!departamento) {
    throw new ParserError(
      `código DANE de departamento desconocido: "${codigoDane}" (región ${codigo})`,
      { archivo }
    )
  }
  const region = {
    codigo,
    codigoDane,
    departamento,
    provincia,
    slug: slugRegion(departamento, provincia),
  }
  const resultado = RegionSchema.safeParse(region)
  if (!resultado.success) {
    throw new ParserError(
      `región inválida: ${resultado.error.issues.map((i) => i.message).join("; ")}`,
      { archivo }
    )
  }
  return resultado.data
}

export interface DatosPortada {
  departamento: string
  provincia: string
  /** Jornada legal aplicada, p. ej. "42 HORAS". */
  factorHorario?: string
  altitud?: number
  factorAltitud?: number
  temperatura?: number
  factorManoDeObra?: number
}

/** Metadatos territoriales de la hoja PORTADA (FORMATO.md §5.6). */
export function parsePortada(libro: Libro): DatosPortada {
  return memo(libro, "portada", () => {
    const celdas = libro.celdas(HOJA_PORTADA)
    const ubicacion = { archivo: libro.archivo, hoja: HOJA_PORTADA }
    const texto = (ref: string) => limpiarTexto(celdas.get(ref)?.valor)
    const numero = (ref: string) => {
      const valor = celdas.get(ref)?.valor
      return typeof valor === "number" ? valor : undefined
    }

    const departamentoCrudo = texto(PORTADA.departamento)
    afirmar(departamentoCrudo, "PORTADA no trae el departamento", {
      ...ubicacion,
      celda: PORTADA.departamento,
    })

    // La provincia vive en una celda combinada muy ancha: unos libros la
    // escriben en F24 y otros en CL24 (FORMATO.md §5.6).
    let provinciaCruda: string | null = null
    for (const ref of PORTADA.provincia) {
      provinciaCruda = texto(ref)
      if (provinciaCruda) break
    }
    afirmar(
      provinciaCruda,
      `PORTADA no trae la provincia (se buscó en ${PORTADA.provincia.join(", ")})`,
      { ...ubicacion, celda: PORTADA.provincia[0] }
    )

    return {
      departamento: capitalizarNombre(departamentoCrudo),
      provincia: capitalizarNombre(provinciaCruda),
      factorHorario: texto(PORTADA.factorHorario) ?? undefined,
      altitud: numero(PORTADA.altitud),
      factorAltitud: numero(PORTADA.factorAltitud),
      temperatura: numero(PORTADA.temperatura),
      factorManoDeObra: numero(PORTADA.factorManoDeObra),
    }
  })
}
