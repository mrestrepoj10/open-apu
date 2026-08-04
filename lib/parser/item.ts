/**
 * Hojas de ítem: el desglose completo de un APU.
 *
 * Layout idéntico en las 526 hojas de los 140 libros (FORMATO.md §3): el parser
 * **afirma** las coordenadas en vez de buscarlas. Si un banner o una etiqueta no
 * está donde debe, se aborta nombrando hoja y celda.
 *
 * Reglas que este archivo hace cumplir:
 * - Identidad canónica = **nombre de la hoja** (§8.1); `B33` solo se usa como
 *   verificación cruzada, porque en 6 ítems es un número (§6.4).
 * - Se publica `N101` tal cual; la suma de líneas solo sirve de aserción (§7).
 * - Herramienta menor entra en el subtotal de EQUIPO pero se marca aparte: su
 *   "cantidad" es el 5 % y su base es el subtotal de MANO DE OBRA (§3.3).
 * - MANO DE OBRA **divide** por el rendimiento (§3.3).
 * - No se emite ningún campo de AIU ni de precio total; se verifica además que
 *   el bloque de costos indirectos venga vacío (§3.5).
 */
import {
  ApuSchema,
  SCHEMA_VERSION,
  revisarCoherencia,
  type Apu,
  type ApuLinea,
  type Procedencia,
  type Region,
  type TotalesPorComponente,
} from "../schema"
import { memo } from "./cache"
import {
  CODIGO_HERRAMIENTA_MENOR,
  ES_HOJA_ITEM,
  ETIQUETA_COSTO_DIRECTO,
  ETIQUETA_SUBTOTAL,
  HERRAMIENTA_MENOR,
  HOJA_EQUIPO,
  ITEM,
  LISTADOS_INSUMOS,
  SECCIONES,
  TOLERANCIA_INVIAS,
  UNIDAD_EQUIPO_POR_DEFECTO,
  UNIDAD_MANO_DE_OBRA,
  type SeccionItem,
} from "./coordenadas"
import { ParserError, afirmar } from "./errores"
import { indicePorHoja } from "./indice"
import type { Libro } from "./libro"
import {
  codigoConComas,
  codigoDesdeNombreHoja,
  limpiarTexto,
  normalizarUnidad,
  textoEquivalente,
} from "./normalizar"
import { parseRegion } from "./region"
import type { Celdas } from "./xlsx"

/**
 * Línea que el propio libro INVIAS dejó sin resolver: hay código de insumo,
 * pero el `VLOOKUP` no encontró nada en el listado regional, así que la fila no
 * tiene descripción, precio ni valor unitario y **no suma al subtotal**.
 *
 * Caso real en 2026-1: `801,1` referencia `"B0033052\r\n"` (con salto de línea
 * pegado al código) y `"B0033053\r\n"`, que no existen en la hoja MATERIALES.
 * No se inventa descripción ni se emite un precio 0: la línea se omite del
 * desglose y se reporta.
 */
export interface LineaSinResolver {
  hoja: string
  componente: string
  fila: number
  codigo: string
}

export interface OpcionesItem {
  /** Procedencia del dato; la controla quien llama (no negociable 1). */
  procedencia: Procedencia
  /** Región; si se omite se deduce del libro (nombre de archivo + PORTADA). */
  region?: Region
  /** Se invoca por cada línea que el libro fuente dejó sin resolver. */
  alDetectarLineaSinResolver?: (linea: LineaSinResolver) => void
  /**
   * Tolerancia de la revisión aritmética, en COP.
   * Por defecto `TOLERANCIA_INVIAS` (0.011, FORMATO.md §7).
   */
  tolerancia?: number
  /** Desactiva la revisión aritmética (solo para diagnosticar). */
  omitirCoherencia?: boolean
}

/**
 * Parsea una hoja de ítem completa y devuelve un `Apu` validado y cuadrado.
 *
 * @param nombreHoja identidad canónica del ítem, p. ej. `"630,1,1"`.
 */
export function parseItem(
  libro: Libro,
  nombreHoja: string,
  opciones: OpcionesItem
): Apu {
  const ubicacion = { archivo: libro.archivo, hoja: nombreHoja }
  afirmar(
    ES_HOJA_ITEM.test(nombreHoja),
    `"${nombreHoja}" no es una hoja de ítem (se espera "630,1,1")`,
    ubicacion
  )
  const celdas = libro.celdas(nombreHoja)
  verificarLayout(libro, nombreHoja, celdas)

  const fila = indicePorHoja(libro).get(nombreHoja)
  const codigo = codigoDesdeNombreHoja(nombreHoja)

  // B33 es la única celda literal de la hoja: verificación cruzada barata.
  const codigoHoja = codigoConComas(celdas.get(ITEM.codigo)?.valor)
  afirmar(
    codigoHoja === nombreHoja,
    `el código de la hoja (${ITEM.codigo} = ${JSON.stringify(codigoHoja)}) ` +
      `no coincide con el nombre de la hoja "${nombreHoja}"`,
    { ...ubicacion, celda: ITEM.codigo }
  )

  const descripcion =
    limpiarTexto(celdas.get(ITEM.descripcion)?.valor) ?? fila?.descripcion
  afirmar(descripcion, "el ítem no trae descripción", {
    ...ubicacion,
    celda: ITEM.descripcion,
  })

  const unidad =
    normalizarUnidad(celdas.get(ITEM.unidad)?.valor) ??
    (fila
      ? { unidad: fila.unidad, cruda: fila.unidadCruda ?? fila.unidad }
      : null)
  afirmar(unidad, "el ítem no trae unidad", {
    ...ubicacion,
    celda: ITEM.unidad,
  })

  const lineas: ApuLinea[] = []
  const sinResolver: LineaSinResolver[] = []
  const totales = {} as TotalesPorComponente
  for (const seccion of SECCIONES) {
    totales[seccion.componente] = leerSubtotal(
      libro,
      nombreHoja,
      celdas,
      seccion
    )
    lineas.push(...leerLineas(libro, nombreHoja, celdas, seccion, sinResolver))
    if (seccion.componente === "equipo") {
      const herramienta = leerHerramientaMenor(libro, nombreHoja, celdas)
      if (herramienta) lineas.push(herramienta)
    }
  }
  for (const linea of sinResolver) opciones.alDetectarLineaSinResolver?.(linea)

  const costoDirecto = numeroObligatorio(
    libro,
    nombreHoja,
    celdas,
    ITEM.costoDirecto,
    "costo directo"
  )

  const candidato = {
    schemaVersion: SCHEMA_VERSION,
    codigo,
    descripcion,
    unidad: unidad.unidad,
    unidadCruda: unidad.cruda === unidad.unidad ? undefined : unidad.cruda,
    region: opciones.region ?? parseRegion(libro),
    vigencia: opciones.procedencia.vigencia,
    capitulo: fila?.capitulo,
    articulo: fila?.articulo,
    clasificacion: fila?.clasificacion,
    totales,
    costoDirecto,
    lineas,
    procedencia: {
      ...opciones.procedencia,
      archivo: opciones.procedencia.archivo ?? libro.archivo,
    },
    nota: notaSinResolver(sinResolver),
  }

  const resultado = ApuSchema.safeParse(candidato)
  if (!resultado.success) {
    throw new ParserError(
      `APU inválido: ` +
        resultado.error.issues
          .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
          .join("; "),
      ubicacion
    )
  }
  const apu = resultado.data

  if (!opciones.omitirCoherencia) {
    const tolerancia = opciones.tolerancia ?? TOLERANCIA_INVIAS
    const problemas = revisarCoherencia(apu, tolerancia)
    if (problemas.length > 0) {
      throw new ParserError(
        `la aritmética no cuadra (tolerancia ${tolerancia}): ${problemas.join("; ")}`,
        { ...ubicacion, celda: ITEM.costoDirecto }
      )
    }
  }

  // El ÍNDICE hace INDIRECT a N101: debe dar exactamente lo mismo (§7).
  if (fila) {
    const desvio = Math.abs(fila.costoDirecto - apu.costoDirecto)
    afirmar(
      desvio <= TOLERANCIA_INVIAS,
      `el costo directo de la hoja (${apu.costoDirecto}) no coincide con el ` +
        `del ÍNDICE fila ${fila.fila} (${fila.costoDirecto})`,
      { ...ubicacion, celda: ITEM.costoDirecto }
    )
  }

  return apu
}

/** Parsea todos los ítems del libro. Una hoja a la vez: memoria plana. */
export function parseItems(libro: Libro, opciones: OpcionesItem): Apu[] {
  return libro.hojasDeItem.map((hoja) => parseItem(libro, hoja, opciones))
}

// ————————————————————————————————————————————————————————————————

function verificarLayout(libro: Libro, hoja: string, celdas: Celdas): void {
  const ubicacion = { archivo: libro.archivo, hoja }
  for (const seccion of SECCIONES) {
    const banner = limpiarTexto(celdas.get(seccion.banner)?.valor)
    afirmar(
      banner !== null && textoEquivalente(banner, seccion.textoBanner),
      `se esperaba el banner "${seccion.textoBanner}" y hay ${JSON.stringify(banner)}`,
      { ...ubicacion, celda: seccion.banner }
    )
    const etiqueta = limpiarTexto(celdas.get(seccion.etiquetaSubtotal)?.valor)
    afirmar(
      etiqueta !== null && textoEquivalente(etiqueta, ETIQUETA_SUBTOTAL),
      `se esperaba la etiqueta "${ETIQUETA_SUBTOTAL}" y hay ${JSON.stringify(etiqueta)}`,
      { ...ubicacion, celda: seccion.etiquetaSubtotal }
    )
  }
  const etiquetaTotal = limpiarTexto(
    celdas.get(ITEM.etiquetaCostoDirecto)?.valor
  )
  afirmar(
    etiquetaTotal !== null &&
      textoEquivalente(etiquetaTotal, ETIQUETA_COSTO_DIRECTO),
    `se esperaba "${ETIQUETA_COSTO_DIRECTO}" y hay ${JSON.stringify(etiquetaTotal)}`,
    { ...ubicacion, celda: ITEM.etiquetaCostoDirecto }
  )
  // Los libros NO traen AIU y el proyecto no debe emitirlo (§3.5, no
  // negociable 2). Si algún día llegan con valor, el supuesto cambió.
  for (const celda of [ITEM.aiuSubtotal, ITEM.aiuPrecioTotal]) {
    const valor = celdas.get(celda)?.valor
    afirmar(
      valor === undefined || valor === null,
      `el bloque de costos indirectos trae valor (${JSON.stringify(valor)}); ` +
        `los APU de referencia son costo directo sin AIU`,
      { ...ubicacion, celda }
    )
  }
}

function leerSubtotal(
  libro: Libro,
  hoja: string,
  celdas: Celdas,
  seccion: SeccionItem
): number {
  return numeroObligatorio(
    libro,
    hoja,
    celdas,
    seccion.subtotal,
    `subtotal de ${seccion.componente}`
  )
}

function numeroObligatorio(
  libro: Libro,
  hoja: string,
  celdas: Celdas,
  celda: string,
  etiqueta: string
): number {
  const valor = celdas.get(celda)?.valor
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    throw new ParserError(
      `${etiqueta} no es numérico (${JSON.stringify(valor ?? null)})`,
      { archivo: libro.archivo, hoja, celda }
    )
  }
  return valor
}

function leerLineas(
  libro: Libro,
  hoja: string,
  celdas: Celdas,
  seccion: SeccionItem,
  sinResolver: LineaSinResolver[]
): ApuLinea[] {
  const lineas: ApuLinea[] = []
  const col = seccion.columnas
  for (let fila = seccion.primeraLinea; fila <= seccion.ultimaLinea; fila++) {
    // Línea vacía: las filas sin usar existen en el XML con fórmula y <v/>
    // (FORMATO.md §6.3). El detector es el código de insumo.
    const codigo = limpiarTexto(celdas.get(`${col.codigo}${fila}`)?.valor)
    if (codigo === null) continue
    // Hay código pero el libro no resolvió el insumo: sin valor unitario no
    // suma al subtotal y no hay nada que publicar (ver `LineaSinResolver`).
    if (typeof celdas.get(`${col.subtotal}${fila}`)?.valor !== "number") {
      sinResolver.push({
        hoja,
        componente: seccion.componente,
        fila,
        codigo,
      })
      continue
    }
    lineas.push(leerLinea(libro, hoja, celdas, seccion, fila, codigo))
  }
  return lineas
}

/** Nota visible para el usuario cuando la fuente dejó líneas sin resolver. */
function notaSinResolver(sinResolver: LineaSinResolver[]): string | undefined {
  if (sinResolver.length === 0) return undefined
  const codigos = sinResolver.map((l) => `${l.codigo} (${l.componente})`)
  return (
    `El libro fuente de INVIAS deja ${sinResolver.length} ` +
    `línea${sinResolver.length === 1 ? "" : "s"} sin resolver ` +
    `—${codigos.join(", ")}—: el código de insumo no existe en el listado ` +
    `regional, así que la fila viene sin descripción ni precio y no suma al ` +
    `costo directo. Se omite del desglose en vez de publicarla en cero.`
  )
}

function leerLinea(
  libro: Libro,
  hoja: string,
  celdas: Celdas,
  seccion: SeccionItem,
  fila: number,
  codigo: string
): ApuLinea {
  const col = seccion.columnas
  const ubicacion = { archivo: libro.archivo, hoja }
  const num = (columna: string, etiqueta: string) =>
    numeroObligatorio(libro, hoja, celdas, `${columna}${fila}`, etiqueta)

  const descripcion = limpiarTexto(
    celdas.get(`${col.descripcion}${fila}`)?.valor
  )
  afirmar(
    descripcion,
    `la línea de ${seccion.componente} con código "${codigo}" no trae descripción`,
    { ...ubicacion, celda: `${col.descripcion}${fila}` }
  )

  const unidad = unidadDeLinea(libro, celdas, seccion, fila, codigo)
  const linea: ApuLinea = {
    componente: seccion.componente,
    codigo,
    descripcion,
    unidad: unidad.unidad,
    cantidad: num(col.cantidad, "cantidad/rendimiento"),
    precioUnitario: num(col.precioUnitario, "precio unitario"),
    subtotal: num(col.subtotal, "valor unitario de la línea"),
  }
  if (unidad.cruda !== unidad.unidad) linea.unidadCruda = unidad.cruda
  if (col.distancia) linea.distancia = num(col.distancia, "distancia")
  if (col.jornal) linea.jornal = num(col.jornal, "jornal")
  if (col.factorPrestacional) {
    linea.factorPrestacional = num(
      col.factorPrestacional,
      "factor prestacional"
    )
  }
  return linea
}

/**
 * El formato imprime la unidad solo en MATERIALES y TRANSPORTE. Para EQUIPO se
 * resuelve contra el listado EQUIPO de la propia provincia (donde vale "h" o
 * "%"), y para MANO DE OBRA es siempre el jornal.
 */
function unidadDeLinea(
  libro: Libro,
  celdas: Celdas,
  seccion: SeccionItem,
  fila: number,
  codigo: string
): { unidad: string; cruda: string } {
  if (seccion.columnas.unidad) {
    const leida = normalizarUnidad(
      celdas.get(`${seccion.columnas.unidad}${fila}`)?.valor
    )
    if (leida) return leida
  }
  if (seccion.componente === "manoDeObra") {
    return { unidad: UNIDAD_MANO_DE_OBRA, cruda: UNIDAD_MANO_DE_OBRA }
  }
  const desdeListado = unidadesDeEquipo(libro).get(codigo)
  if (desdeListado) {
    const normalizada = normalizarUnidad(desdeListado)
    if (normalizada) return normalizada
  }
  return {
    unidad: UNIDAD_EQUIPO_POR_DEFECTO,
    cruda: UNIDAD_EQUIPO_POR_DEFECTO,
  }
}

/** Mapa código de equipo → unidad, tomado de la hoja visible EQUIPO. */
function unidadesDeEquipo(libro: Libro): ReadonlyMap<string, string> {
  return memo(libro, "unidadesEquipo", () => {
    const mapa = new Map<string, string>()
    if (!libro.tieneHoja(HOJA_EQUIPO)) return mapa
    const listado = LISTADOS_INSUMOS.find((l) => l.hoja === HOJA_EQUIPO)!
    const celdas = libro.celdas(HOJA_EQUIPO)
    for (let fila = listado.primeraFila; ; fila++) {
      const codigo = limpiarTexto(
        celdas.get(`${listado.columnas.codigo}${fila}`)?.valor
      )
      if (codigo === null) break
      const unidad = limpiarTexto(
        celdas.get(`${listado.columnas.unidad}${fila}`)?.valor
      )
      if (unidad !== null) mapa.set(codigo, unidad)
    }
    return mapa
  })
}

/**
 * Fila 52: herramienta menor. Se emite como línea de EQUIPO (entra en
 * `SUM(N38:N52)`) pero con `porcentaje` y `base` para que la UI pueda
 * explicarla: es el 5 % del subtotal de mano de obra, no un equipo.
 */
function leerHerramientaMenor(
  libro: Libro,
  hoja: string,
  celdas: Celdas
): ApuLinea | null {
  const codigo = limpiarTexto(celdas.get(HERRAMIENTA_MENOR.codigo)?.valor)
  if (codigo === null) return null
  const ubicacion = { archivo: libro.archivo, hoja }
  const descripcion = limpiarTexto(
    celdas.get(HERRAMIENTA_MENOR.descripcion)?.valor
  )
  afirmar(descripcion, "la fila de herramienta menor no trae descripción", {
    ...ubicacion,
    celda: HERRAMIENTA_MENOR.descripcion,
  })
  afirmar(
    codigo === CODIGO_HERRAMIENTA_MENOR,
    `se esperaba el código "${CODIGO_HERRAMIENTA_MENOR}" y hay "${codigo}"`,
    { ...ubicacion, celda: HERRAMIENTA_MENOR.codigo }
  )
  const base = numeroObligatorio(
    libro,
    hoja,
    celdas,
    HERRAMIENTA_MENOR.base,
    "base de herramienta menor (subtotal de mano de obra)"
  )
  const porcentaje = numeroObligatorio(
    libro,
    hoja,
    celdas,
    HERRAMIENTA_MENOR.porcentaje,
    "porcentaje de herramienta menor"
  )
  const subtotal = numeroObligatorio(
    libro,
    hoja,
    celdas,
    HERRAMIENTA_MENOR.subtotal,
    "valor de herramienta menor"
  )
  const tipo = limpiarTexto(celdas.get(HERRAMIENTA_MENOR.tipo)?.valor) ?? "%"
  return {
    componente: "equipo",
    codigo,
    descripcion,
    unidad: tipo,
    cantidad: porcentaje,
    precioUnitario: base,
    subtotal,
    porcentaje,
    base,
  }
}
