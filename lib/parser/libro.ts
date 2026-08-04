/**
 * `Libro`: el manejador de un .xlsx de APU de INVIAS.
 *
 * Abre el zip, indexa las hojas y expone lectura **perezosa, una hoja a la
 * vez**. No cachea celdas: con 544 hojas, guardarlas todas es exactamente el
 * problema de memoria que documenta FORMATO.md §6.1.
 */
import {
  ES_HOJA_ITEM,
  HOJAS_DE_APOYO,
  HOJAS_ESPERADAS,
  HOJA_APU_BASE,
  HOJA_INDICE,
  HOJA_PORTADA,
  ITEMS_ESPERADOS,
} from "./coordenadas"
import { ParserError, afirmar } from "./errores"
import {
  ArchivoZip,
  decodificarXml,
  leerCadenasCompartidas,
  leerCeldas,
  leerDimension,
  type Celdas,
} from "./xlsx"

export type EstadoHoja = "visible" | "hidden" | "veryHidden"

export interface HojaInfo {
  nombre: string
  estado: EstadoHoja
  /** Ruta dentro del zip, p. ej. "xl/worksheets/sheet18.xml". */
  ruta: string
  /** Posición en `workbook.xml` (0-based). */
  posicion: number
}

export interface OpcionesAbrir {
  /** Nombre del archivo fuente; aparece en los errores y en la procedencia. */
  archivo?: string
  /**
   * Exige la estructura canónica (544 hojas, 526 ítems, las 18 de apoyo).
   * El pipeline de `scripts/` debe usarlo; las pruebas trabajan sobre un
   * extracto recortado y no.
   */
  exigirLibroCompleto?: boolean
}

const RUTA_WORKBOOK = "xl/workbook.xml"
const RUTA_RELS = "xl/_rels/workbook.xml.rels"
const RUTA_CADENAS = "xl/sharedStrings.xml"

export class Libro {
  readonly archivo?: string
  readonly hojas: readonly HojaInfo[]
  /** Nombres de las hojas de ítem, en el orden del libro (FORMATO.md §1.1). */
  readonly hojasDeItem: readonly string[]
  /** `true` si el libro trae la estructura canónica completa. */
  readonly esLibroCompleto: boolean

  private readonly zip: ArchivoZip
  private readonly cadenas: readonly string[]
  private readonly porNombre: ReadonlyMap<string, HojaInfo>

  constructor(zip: ArchivoZip, opciones: OpcionesAbrir = {}) {
    this.zip = zip
    this.archivo = opciones.archivo
    this.hojas = inventariarHojas(zip, this.archivo)
    this.porNombre = new Map(this.hojas.map((h) => [h.nombre, h]))
    this.hojasDeItem = this.hojas
      .filter((h) => ES_HOJA_ITEM.test(h.nombre))
      .map((h) => h.nombre)
    this.cadenas = zip.tiene(RUTA_CADENAS)
      ? leerCadenasCompartidas(zip.leerTexto(RUTA_CADENAS))
      : []
    this.esLibroCompleto =
      this.hojas.length === HOJAS_ESPERADAS &&
      this.hojasDeItem.length === ITEMS_ESPERADOS

    // Invariantes mínimas: sin ÍNDICE ni PORTADA esto no es un libro APU.
    afirmar(this.porNombre.has(HOJA_INDICE), `falta la hoja "${HOJA_INDICE}"`, {
      archivo: this.archivo,
    })
    afirmar(
      this.porNombre.has(HOJA_PORTADA),
      `falta la hoja "${HOJA_PORTADA}"`,
      { archivo: this.archivo }
    )
    afirmar(
      this.hojasDeItem.length > 0,
      "el libro no tiene ninguna hoja de ítem",
      { archivo: this.archivo }
    )
    // APU BASE es una plantilla vacía; el regex ya la excluye, pero conviene
    // afirmarlo explícitamente (FORMATO.md §5.7).
    afirmar(
      !ES_HOJA_ITEM.test(HOJA_APU_BASE),
      `"${HOJA_APU_BASE}" no debería clasificar como hoja de ítem`,
      { archivo: this.archivo }
    )

    if (opciones.exigirLibroCompleto) verificarEstructura(this)
  }

  tieneHoja(nombre: string): boolean {
    return this.porNombre.has(nombre)
  }

  info(nombre: string): HojaInfo {
    const hoja = this.porNombre.get(nombre)
    if (!hoja) {
      throw new ParserError(`el libro no tiene la hoja "${nombre}"`, {
        archivo: this.archivo,
        hoja: nombre,
      })
    }
    return hoja
  }

  /** XML crudo de una hoja. Útil para `scripts/` (matrices INSUMO_*). */
  xmlDeHoja(nombre: string): string {
    return this.zip.leerTexto(this.info(nombre).ruta)
  }

  /**
   * Celdas con valor de una hoja, indexadas por referencia A1.
   * Se lee y descomprime en cada llamada: memoria plana, una hoja a la vez.
   */
  celdas(nombre: string): Celdas {
    const hoja = this.info(nombre)
    return leerCeldas(this.zip.leerTexto(hoja.ruta), this.cadenas, {
      archivo: this.archivo,
      hoja: nombre,
      ruta: hoja.ruta,
    })
  }

  /** `<dimension ref="…"/>` declarada por la hoja. */
  dimension(nombre: string): string | undefined {
    return leerDimension(this.xmlDeHoja(nombre))
  }

  /** Acceso al zip subyacente (entradas, medios, matrices ocultas). */
  get paquete(): ArchivoZip {
    return this.zip
  }
}

/**
 * Abre un libro APU desde los bytes del .xlsx.
 *
 * Compatible con navegador: la entrada es un `ArrayBuffer`/`Uint8Array`; quien
 * llama decide de dónde salen (input de archivo, fetch, fs en un script).
 */
export function abrirLibro(
  datos: ArrayBuffer | Uint8Array,
  opciones: OpcionesAbrir = {}
): Libro {
  const zip = new ArchivoZip(datos, opciones.archivo)
  return new Libro(zip, opciones)
}

/**
 * Verifica la estructura canónica del libro (FORMATO.md §6.11) y lanza
 * `ParserError` con el detalle si algo cambió. Es la alarma de "INVIAS cambió
 * el formato".
 */
export function verificarEstructura(libro: Libro): void {
  const ubicacion = { archivo: libro.archivo }
  afirmar(
    libro.hojas.length === HOJAS_ESPERADAS,
    `se esperaban ${HOJAS_ESPERADAS} hojas y hay ${libro.hojas.length}`,
    ubicacion
  )
  afirmar(
    libro.hojasDeItem.length === ITEMS_ESPERADOS,
    `se esperaban ${ITEMS_ESPERADOS} hojas de ítem y hay ${libro.hojasDeItem.length}`,
    ubicacion
  )
  for (const nombre of HOJAS_DE_APOYO) {
    afirmar(libro.tieneHoja(nombre), `falta la hoja de apoyo "${nombre}"`, {
      ...ubicacion,
      hoja: nombre,
    })
  }
}

function inventariarHojas(zip: ArchivoZip, archivo?: string): HojaInfo[] {
  if (!zip.tiene(RUTA_WORKBOOK)) {
    throw new ParserError(
      "no parece un .xlsx de Excel: falta xl/workbook.xml",
      { archivo, ruta: RUTA_WORKBOOK }
    )
  }
  const workbook = zip.leerTexto(RUTA_WORKBOOK)
  const rels = zip.tiene(RUTA_RELS) ? zip.leerTexto(RUTA_RELS) : ""
  const objetivos = new Map<string, string>()
  for (const rel of rels.matchAll(
    /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g
  )) {
    objetivos.set(rel[1]!, normalizarRuta(rel[2]!))
  }

  const hojas: HojaInfo[] = []
  const bloque = /<sheets>([\s\S]*?)<\/sheets>/.exec(workbook)
  if (!bloque) {
    throw new ParserError("xl/workbook.xml no declara <sheets>", {
      archivo,
      ruta: RUTA_WORKBOOK,
    })
  }
  for (const hoja of bloque[1]!.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const atributos = hoja[1]!
    const nombre = decodificarXml(atributo(atributos, "name") ?? "")
    const idRelacion = atributo(atributos, "r:id")
    const estado = (atributo(atributos, "state") ?? "visible") as EstadoHoja
    if (!nombre || !idRelacion) {
      throw new ParserError(
        `<sheet> sin name o r:id en xl/workbook.xml: ${atributos}`,
        { archivo, ruta: RUTA_WORKBOOK }
      )
    }
    const ruta = objetivos.get(idRelacion)
    if (!ruta) {
      throw new ParserError(
        `la hoja "${nombre}" apunta a la relación ${idRelacion}, que no existe`,
        { archivo, hoja: nombre, ruta: RUTA_RELS }
      )
    }
    hojas.push({ nombre, estado, ruta, posicion: hojas.length })
  }
  return hojas
}

function atributo(atributos: string, nombre: string): string | undefined {
  const escapado = nombre.replace(":", "\\:")
  const coincide = new RegExp(`\\b${escapado}="([^"]*)"`).exec(atributos)
  return coincide ? coincide[1] : undefined
}

/** Los `Target` de workbook.xml.rels son relativos a `xl/` (o absolutos). */
function normalizarRuta(objetivo: string): string {
  if (objetivo.startsWith("/")) return objetivo.slice(1)
  return `xl/${objetivo.replace(/^\.\//, "")}`
}
