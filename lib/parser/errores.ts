/**
 * Errores del parser.
 *
 * Regla (FORMATO.md §8.4): si el libro se desvía del formato esperado, se
 * aborta con un error que **nombra el archivo, la hoja y la celda**. Un fallo
 * ruidoso es la señal de que INVIAS cambió el formato; un `null` silencioso se
 * convierte en un precio equivocado publicado en la web.
 */

export interface UbicacionParser {
  /** Nombre del archivo .xlsx, p. ej. "APU_0509_ANTIOQUIA__…_2026_1.xlsx". */
  archivo?: string
  /** Nombre de la hoja, p. ej. "630,1,1" o "ÍNDICE". */
  hoja?: string
  /** Referencia de celda en notación A1, p. ej. "N101". */
  celda?: string
  /** Ruta dentro del zip, p. ej. "xl/worksheets/sheet18.xml". */
  ruta?: string
}

/** Error de parseo con ubicación (archivo / hoja / celda). */
export class ParserError extends Error {
  override readonly name = "ParserError"
  readonly archivo?: string
  readonly hoja?: string
  readonly celda?: string
  readonly ruta?: string

  constructor(mensaje: string, ubicacion: UbicacionParser = {}) {
    super(formatearMensaje(mensaje, ubicacion))
    this.archivo = ubicacion.archivo
    this.hoja = ubicacion.hoja
    this.celda = ubicacion.celda
    this.ruta = ubicacion.ruta
  }
}

function formatearMensaje(mensaje: string, u: UbicacionParser): string {
  const partes: string[] = []
  if (u.archivo) partes.push(u.archivo)
  if (u.hoja) partes.push(u.celda ? `${u.hoja}!${u.celda}` : u.hoja)
  else if (u.celda) partes.push(u.celda)
  if (!u.hoja && !u.celda && u.ruta) partes.push(u.ruta)
  return partes.length > 0 ? `[${partes.join(" · ")}] ${mensaje}` : mensaje
}

/** Lanza `ParserError` si `condicion` es falsa. */
export function afirmar(
  condicion: unknown,
  mensaje: string,
  ubicacion: UbicacionParser = {}
): asserts condicion {
  if (!condicion) throw new ParserError(mensaje, ubicacion)
}
