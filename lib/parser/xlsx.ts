/**
 * Lector mínimo de .xlsx: un zip con XML dentro.
 *
 * Por qué no exceljs (FORMATO.md §6.1): abrir uno de estos libros con exceljs
 * consume ~3.7 GB de RSS, porque materializa las 544 hojas en objetos. Eso
 * rompe el requisito de AGENTS.md de que los parsers funcionen en el navegador.
 * Aquí se hace lo mínimo:
 *
 *   1. leer el directorio central del zip **una sola vez** (sin descomprimir),
 *   2. inflar **una entrada a la vez** con `fflate` (DEFLATE crudo),
 *   3. barrer el XML de la hoja buscando `<c r="…">` y quedarse con el valor
 *      cacheado.
 *
 * No se evalúan fórmulas (FORMATO.md §8.3): todas las celdas de datos son
 * fórmulas con resultado cacheado, y ese resultado es el dato oficial.
 *
 * Compatible con navegador: sin `node:*`, sin APIs de Bun. La entrada es un
 * `ArrayBuffer`/`Uint8Array`.
 */
import { inflateSync } from "fflate"
import { ParserError } from "./errores"

// ————————————————————————————————————————————————————————————————
// Zip
// ————————————————————————————————————————————————————————————————

const FIRMA_EOCD = 0x06054b50
const FIRMA_EOCD64_LOC = 0x07064b50
const FIRMA_DIRECTORIO = 0x02014b50
const FIRMA_LOCAL = 0x04034b50
/** Tamaño máximo del comentario final del zip (uint16) + cabecera EOCD. */
const MAX_COMENTARIO = 0xffff + 22

export interface EntradaZip {
  nombre: string
  /** 0 = almacenado, 8 = DEFLATE. */
  metodo: number
  /** Desplazamiento de la cabecera local dentro del archivo. */
  offsetLocal: number
  bytesComprimidos: number
  bytesOriginales: number
}

const utf8 = new TextDecoder("utf-8")

/**
 * Zip de solo lectura, perezoso: el constructor únicamente indexa el directorio
 * central; cada entrada se descomprime cuando se pide y no se guarda en caché.
 */
export class ArchivoZip {
  private readonly bytes: Uint8Array
  private readonly vista: DataView
  readonly entradas: ReadonlyMap<string, EntradaZip>
  readonly archivo?: string

  constructor(datos: ArrayBuffer | Uint8Array, archivo?: string) {
    this.bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos)
    this.vista = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset,
      this.bytes.byteLength
    )
    this.archivo = archivo
    this.entradas = this.leerDirectorio()
  }

  tiene(nombre: string): boolean {
    return this.entradas.has(nombre)
  }

  /** Bytes descomprimidos de una entrada. Lanza `ParserError` si no existe. */
  leer(nombre: string): Uint8Array {
    const entrada = this.entradas.get(nombre)
    if (!entrada) {
      throw new ParserError(`el .xlsx no contiene la entrada "${nombre}"`, {
        archivo: this.archivo,
        ruta: nombre,
      })
    }
    const local = entrada.offsetLocal
    if (this.vista.getUint32(local, true) !== FIRMA_LOCAL) {
      throw new ParserError(
        "cabecera local de zip inválida (archivo corrupto)",
        {
          archivo: this.archivo,
          ruta: nombre,
        }
      )
    }
    const largoNombre = this.vista.getUint16(local + 26, true)
    const largoExtra = this.vista.getUint16(local + 28, true)
    const inicio = local + 30 + largoNombre + largoExtra
    const crudo = this.bytes.subarray(inicio, inicio + entrada.bytesComprimidos)
    if (entrada.metodo === 0) return crudo
    if (entrada.metodo !== 8) {
      throw new ParserError(
        `método de compresión zip no soportado: ${entrada.metodo}`,
        { archivo: this.archivo, ruta: nombre }
      )
    }
    try {
      return inflateSync(crudo, {
        out: new Uint8Array(entrada.bytesOriginales),
      })
    } catch (causa) {
      throw new ParserError(
        `no se pudo descomprimir (${(causa as Error).message})`,
        { archivo: this.archivo, ruta: nombre }
      )
    }
  }

  /** Contenido de una entrada decodificado como UTF-8. */
  leerTexto(nombre: string): string {
    return utf8.decode(this.leer(nombre))
  }

  private leerDirectorio(): Map<string, EntradaZip> {
    const eocd = this.buscarEocd()
    if (this.vista.getUint32(eocd - 20, true) === FIRMA_EOCD64_LOC) {
      throw new ParserError(
        "el archivo usa zip64; los libros APU de INVIAS no lo hacen",
        { archivo: this.archivo }
      )
    }
    const total = this.vista.getUint16(eocd + 10, true)
    let offset = this.vista.getUint32(eocd + 16, true)
    const entradas = new Map<string, EntradaZip>()
    for (let i = 0; i < total; i++) {
      if (this.vista.getUint32(offset, true) !== FIRMA_DIRECTORIO) {
        throw new ParserError(
          `directorio central del zip corrupto en la entrada ${i}`,
          { archivo: this.archivo }
        )
      }
      const metodo = this.vista.getUint16(offset + 10, true)
      const bytesComprimidos = this.vista.getUint32(offset + 20, true)
      const bytesOriginales = this.vista.getUint32(offset + 24, true)
      const largoNombre = this.vista.getUint16(offset + 28, true)
      const largoExtra = this.vista.getUint16(offset + 30, true)
      const largoComentario = this.vista.getUint16(offset + 32, true)
      const offsetLocal = this.vista.getUint32(offset + 42, true)
      const nombre = utf8.decode(
        this.bytes.subarray(offset + 46, offset + 46 + largoNombre)
      )
      entradas.set(nombre, {
        nombre,
        metodo,
        offsetLocal,
        bytesComprimidos,
        bytesOriginales,
      })
      offset += 46 + largoNombre + largoExtra + largoComentario
    }
    return entradas
  }

  private buscarEocd(): number {
    const limite = Math.max(0, this.bytes.length - MAX_COMENTARIO)
    for (let i = this.bytes.length - 22; i >= limite; i--) {
      if (this.vista.getUint32(i, true) === FIRMA_EOCD) return i
    }
    throw new ParserError(
      "no parece un .xlsx: no se encontró el fin del directorio central del zip",
      { archivo: this.archivo }
    )
  }
}

// ————————————————————————————————————————————————————————————————
// XML
// ————————————————————————————————————————————————————————————————

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
}

/** Decodifica entidades XML (`&amp;`, `&#10;`, `&#x1F;`). */
export function decodificarXml(texto: string): string {
  if (texto.indexOf("&") === -1) return texto
  return texto.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (todo, cuerpo: string) => {
    if (cuerpo[0] === "#") {
      const codigo =
        cuerpo[1] === "x" || cuerpo[1] === "X"
          ? parseInt(cuerpo.slice(2), 16)
          : parseInt(cuerpo.slice(1), 10)
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : todo
    }
    return ENTIDADES[cuerpo] ?? todo
  })
}

/** Concatena el texto de todos los `<t>` dentro de un fragmento. */
function textoDeElementosT(fragmento: string): string {
  let salida = ""
  let i = 0
  for (;;) {
    const abre = fragmento.indexOf("<t", i)
    if (abre === -1) break
    const siguiente = fragmento[abre + 2]
    if (siguiente !== ">" && siguiente !== " " && siguiente !== "/") {
      i = abre + 2
      continue
    }
    const finApertura = fragmento.indexOf(">", abre)
    if (finApertura === -1) break
    if (fragmento[finApertura - 1] === "/") {
      i = finApertura + 1
      continue
    }
    const cierre = fragmento.indexOf("</t>", finApertura)
    if (cierre === -1) break
    salida += decodificarXml(fragmento.slice(finApertura + 1, cierre))
    i = cierre + 4
  }
  return salida
}

/**
 * Tabla de cadenas compartidas (`xl/sharedStrings.xml`).
 * Soporta texto enriquecido (`<si><r><t>…`), que en estos libros aparece en 3
 * de las 5687 entradas.
 */
export function leerCadenasCompartidas(xml: string): string[] {
  const cadenas: string[] = []
  let i = 0
  for (;;) {
    const abre = xml.indexOf("<si>", i)
    if (abre === -1) break
    const cierre = xml.indexOf("</si>", abre)
    if (cierre === -1) break
    cadenas.push(textoDeElementosT(xml.slice(abre + 4, cierre)))
    i = cierre + 5
  }
  return cadenas
}

/** Tipo declarado en el atributo `t` de una celda. */
export type TipoCelda = "n" | "s" | "str" | "inlineStr" | "b" | "e" | "d"

export interface Celda {
  tipo: TipoCelda
  /**
   * Valor cacheado ya normalizado. `null` cuando la celda está vacía, cuando la
   * fórmula devolvió cadena vacía (`<v/>`, FORMATO.md §6.3: así se detecta una
   * línea sin usar) o cuando es una celda de error (`#VALUE!`, §6.10).
   */
  valor: string | number | boolean | null
}

/** Celdas de una hoja, indexadas por referencia A1 ("N101"). */
export type Celdas = Map<string, Celda>

const RE_REFERENCIA = /\br="([A-Z]+[0-9]+)"/
const RE_TIPO = /\bt="([a-zA-Z]+)"/

/**
 * Barre el XML de una hoja y devuelve sus celdas con valor.
 *
 * Se indexa por la referencia A1 del atributo `r`, no por posición: las hojas
 * de ítem omiten celdas vacías y contar columnas sería frágil.
 */
export function leerCeldas(
  xml: string,
  cadenas: readonly string[],
  ubicacion: { archivo?: string; hoja?: string; ruta?: string } = {}
): Celdas {
  const celdas: Celdas = new Map()
  let i = 0
  for (;;) {
    const abre = xml.indexOf("<c ", i)
    if (abre === -1) break
    const finApertura = xml.indexOf(">", abre)
    if (finApertura === -1) break
    const atributos = xml.slice(abre + 3, finApertura)
    const autocierre = xml[finApertura - 1] === "/"
    const refCoincide = RE_REFERENCIA.exec(atributos)
    if (!refCoincide) {
      throw new ParserError(
        "celda sin atributo r= (referencia A1); el XML no es el esperado",
        ubicacion
      )
    }
    const referencia = refCoincide[1]!
    if (autocierre) {
      i = finApertura + 1
      continue
    }
    const cierre = xml.indexOf("</c>", finApertura)
    if (cierre === -1) {
      throw new ParserError(`celda ${referencia} sin cierre </c>`, {
        ...ubicacion,
        celda: referencia,
      })
    }
    const interior = xml.slice(finApertura + 1, cierre)
    i = cierre + 4
    const tipoCoincide = RE_TIPO.exec(atributos)
    const tipo = (tipoCoincide ? tipoCoincide[1] : "n") as TipoCelda
    const valor = valorDeCelda(tipo, interior, cadenas, {
      ...ubicacion,
      celda: referencia,
    })
    if (valor !== null) celdas.set(referencia, { tipo, valor })
  }
  return celdas
}

function valorDeCelda(
  tipo: TipoCelda,
  interior: string,
  cadenas: readonly string[],
  ubicacion: { archivo?: string; hoja?: string; celda?: string }
): string | number | boolean | null {
  if (tipo === "inlineStr") {
    const texto = textoDeElementosT(interior)
    return texto === "" ? null : texto
  }
  const crudo = contenidoDeV(interior)
  if (crudo === null || crudo === "") return null
  switch (tipo) {
    case "s": {
      const indice = Number(crudo)
      const cadena = cadenas[indice]
      if (cadena === undefined) {
        throw new ParserError(
          `índice de cadena compartida fuera de rango: ${crudo}`,
          ubicacion
        )
      }
      return cadena === "" ? null : cadena
    }
    case "str":
    case "d":
      return decodificarXml(crudo)
    case "b":
      return crudo === "1"
    case "e":
      // #VALUE! decorativo de fórmulas de imagen (FORMATO.md §6.10).
      return null
    default: {
      const numero = Number(crudo)
      return Number.isFinite(numero) ? numero : null
    }
  }
}

/** Contenido crudo del primer `<v>` de una celda; `null` si es `<v/>` o falta. */
function contenidoDeV(interior: string): string | null {
  let i = 0
  for (;;) {
    const abre = interior.indexOf("<v", i)
    if (abre === -1) return null
    const siguiente = interior[abre + 2]
    if (siguiente !== ">" && siguiente !== "/" && siguiente !== " ") {
      i = abre + 2
      continue
    }
    const finApertura = interior.indexOf(">", abre)
    if (finApertura === -1) return null
    if (interior[finApertura - 1] === "/") return null // <v/>
    const cierre = interior.indexOf("</v>", finApertura)
    if (cierre === -1) return null
    return interior.slice(finApertura + 1, cierre)
  }
}

/** Valor de `<dimension ref="…"/>`, si la hoja lo declara. */
export function leerDimension(xml: string): string | undefined {
  const coincide = /<dimension ref="([^"]+)"/.exec(xml)
  return coincide ? coincide[1] : undefined
}
