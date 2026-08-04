/**
 * Normalización de texto, códigos y unidades del formato INVIAS.
 *
 * Todo lo que se normaliza aquí conserva el valor crudo en el documento
 * emitido (`unidadCruda`), porque la no negociable 1 del repo exige que el
 * usuario pueda rastrear el número hasta la celda de la que salió.
 */

/**
 * Limpia texto de celda: normaliza saltos de línea a `\n`, colapsa espacios
 * dentro de cada línea y recorta. Las descripciones INVIAS traen CRLF y dobles
 * espacios (FORMATO.md §6.9).
 */
export function limpiarTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  const texto = String(valor)
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .split("\n")
    .map((linea) => linea.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .trim()
  return texto === "" ? null : texto
}

/**
 * Separa una descripción INVIAS en título y alcance.
 *
 * Convención observada: la primera línea es el nombre del ítem y lo que sigue,
 * entre paréntesis, delimita el alcance del análisis (FORMATO.md §6.9).
 */
export function partirDescripcion(descripcion: string): {
  titulo: string
  alcance?: string
} {
  const lineas = descripcion.split("\n")
  const titulo = (lineas[0] ?? "").trim()
  const resto = lineas.slice(1).join("\n").trim()
  return resto === "" ? { titulo } : { titulo, alcance: resto }
}

/**
 * Normaliza un código de ítem al formato del nombre de hoja (con comas).
 *
 * Seis ítems guardan el código como **número** (`730.4`) mientras la hoja se
 * llama `730,4` (FORMATO.md §6.4). Comparar sin normalizar falla en esos seis.
 */
export function codigoConComas(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  const texto = String(valor).trim().replace(/\./g, ",")
  return texto === "" ? null : texto
}

/**
 * Convierte el nombre de hoja (`"630,1,1"`) al código canónico del esquema
 * (`"630.1.1"`). La identidad del ítem es el nombre de la hoja (§8.1).
 */
export function codigoDesdeNombreHoja(nombreHoja: string): string {
  return nombreHoja.trim().replace(/,/g, ".")
}

/** Inverso de `codigoDesdeNombreHoja`. */
export function nombreHojaDesdeCodigo(codigo: string): string {
  return codigo.trim().replace(/\./g, ",")
}

/**
 * Unidades canónicas por grafía cruda.
 *
 * Las 14 grafías de `ÍNDICE!G` (FORMATO.md §6.9) más las de los listados de
 * insumos. La clave se compara ya recortada y con espacios colapsados; el
 * emparejamiento es sensible a mayúsculas salvo por la tabla de respaldo
 * insensible que se aplica después.
 */
export const UNIDADES_CANONICAS: Readonly<Record<string, string>> =
  Object.freeze({
    // — ítems (ÍNDICE!G) —
    ha: "ha",
    m2: "m2",
    m: "m",
    kg: "kg",
    Kg: "kg",
    u: "u",
    m3: "m3",
    "m³": "m3",
    L: "L",
    "tf-m": "tf-m",
    "kg-km": "kg-km",
    // Las tres grafías de transporte por metro cúbico y kilómetro. "m3 - E" es
    // una errata del original: mismos ítems de transporte, misma unidad.
    "m3 - E": "m3-km",
    "m3 - Km": "m3-km",
    "m3 - km": "m3-km",
    "m3-km": "m3-km",
    // — listados de insumos —
    h: "h",
    "%": "%",
    Km: "km",
    km: "km",
    mes: "mes",
    día: "día",
    jornal: "jornal",
  })

/**
 * Devuelve la unidad canónica y la cruda. Si la grafía es desconocida se
 * devuelve la cruda limpia como canónica (no es corrupción: es una unidad
 * nueva) y `conocida: false`, para que el pipeline lo pueda reportar.
 */
export function normalizarUnidad(valor: unknown): {
  unidad: string
  cruda: string
  conocida: boolean
} | null {
  const cruda = limpiarTexto(valor)
  if (cruda === null) return null
  const directa = UNIDADES_CANONICAS[cruda]
  if (directa) return { unidad: directa, cruda, conocida: true }
  const porMinusculas = UNIDADES_CANONICAS[cruda.toLowerCase()]
  if (porMinusculas) return { unidad: porMinusculas, cruda, conocida: true }
  const m3km = /^m\s*3\s*-\s*(km|e)$/i.exec(cruda)
  if (m3km) return { unidad: "m3-km", cruda, conocida: true }
  return { unidad: cruda, cruda, conocida: false }
}

/**
 * Convierte un nombre en MAYÚSCULAS o UPPER_SNAKE a capitalización española:
 * `"VALLE DE ABURRÁ"` → `"Valle de Aburrá"`, `"NORTE_DE_SANTANDER"` →
 * `"Norte de Santander"`. Los conectores van en minúscula salvo al inicio.
 */
const CONECTORES = new Set(["de", "del", "la", "las", "los", "el", "y", "e"])

export function capitalizarNombre(nombre: string): string {
  const palabras = nombre
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es")
    .split(" ")
  return palabras
    .map((palabra, indice) => {
      if (indice > 0 && CONECTORES.has(palabra)) return palabra
      return palabra.replace(/^([a-záéíóúüñ])/, (letra) =>
        letra.toLocaleUpperCase("es")
      )
    })
    .join(" ")
}

/** Compara textos ignorando mayúsculas, tildes y espacios sobrantes. */
export function textoEquivalente(a: string, b: string): boolean {
  const plano = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  return plano(a) === plano(b)
}
