/**
 * Coordenadas fijas del formato INVIAS FR-APU-1 (vigencia 2026-1).
 *
 * Los 140 libros son estructuralmente idénticos (FORMATO.md §1, §6.11): mismas
 * 544 hojas, mismos 526 ítems, mismas celdas. El parser **afirma** estas
 * coordenadas en vez de buscarlas; si un libro futuro se desvía, falla con un
 * `ParserError` que nombra hoja y celda.
 *
 * Este archivo es la única fuente de verdad de las coordenadas: si INVIAS
 * cambia el formato, se cambia aquí.
 */
import type { Componente } from "../schema"

// —— Nombres de hoja ——
// Copiados literalmente del libro: llevan tildes y, en dos casos, espacio final
// (FORMATO.md §1.2). Nunca escribirlos a mano.
export const HOJA_PORTADA = "PORTADA"
export const HOJA_INDICE = "ÍNDICE"
export const HOJA_MENU = "MENÚ"
export const HOJA_APUS = "APU´S" // U+00B4 ACUTE ACCENT, no apóstrofo
export const HOJA_INSUMO_EQUIPO = "INSUMO_EQUIPO"
export const HOJA_INSUMO_MATERIALES = "INSUMO MATERIALES" // espacio, no guion bajo
export const HOJA_INSUMO_TRANSPORTE = "INSUMO_TRANSPORTE"
export const HOJA_INSUMO_MANO_DE_OBRA = "INSUMO_MANO DE OBRA"
export const HOJA_IMAGENES = "IMAGENES_PROVINCIAS"
export const HOJA_CLASIFICACION = "CLASIFICACIÓN_APU"
export const HOJA_CALCULOS = "HOJA DE CALCULOS " // espacio final
export const HOJA_PROVINCIAS = "LISTADO DE PROVINCIAS"
export const HOJA_MATERIALES = "MATERIALES"
export const HOJA_EQUIPO = "EQUIPO"
export const HOJA_MANO_DE_OBRA = "MANO DE OBRA"
export const HOJA_TRANSPORTE = "TRANSPORTE"
export const HOJA_APU_BASE = "APU BASE"
export const HOJA_CONSIDERACIONES = "CONSIDERACIONES " // espacio final

/** Las 18 hojas de apoyo, en el orden en que aparecen en `workbook.xml`. */
export const HOJAS_DE_APOYO: readonly string[] = [
  HOJA_PORTADA,
  HOJA_INDICE,
  HOJA_MENU,
  HOJA_APUS,
  HOJA_INSUMO_EQUIPO,
  HOJA_INSUMO_MATERIALES,
  HOJA_INSUMO_TRANSPORTE,
  HOJA_INSUMO_MANO_DE_OBRA,
  HOJA_IMAGENES,
  HOJA_CLASIFICACION,
  HOJA_CALCULOS,
  HOJA_PROVINCIAS,
  HOJA_MATERIALES,
  HOJA_EQUIPO,
  HOJA_MANO_DE_OBRA,
  HOJA_TRANSPORTE,
  HOJA_APU_BASE,
  HOJA_CONSIDERACIONES,
]

/**
 * Aísla exactamente las 526 hojas de ítem y excluye `APU BASE` y las demás de
 * apoyo (FORMATO.md §1.1). La identidad canónica del ítem es el **nombre de la
 * hoja**, no `B33` ni `ÍNDICE!E` (§6.4, §8.1).
 */
export const ES_HOJA_ITEM = /^\d+(,\d+)*$/

// —— Cifras de control del libro completo (FORMATO.md §6.11) ——
export const HOJAS_ESPERADAS = 544
export const ITEMS_ESPERADOS = 526

// —— Hoja ÍNDICE (FORMATO.md §2) ——
export const INDICE = {
  filaEncabezados: 4,
  primeraFila: 5,
  /** 526 filas contiguas, 5…530. No hay fila de totales ni marcador de fin. */
  ultimaFila: 530,
  columnas: {
    consecutivo: "A",
    capitulo: "B",
    articulo: "C",
    clasificacion: "D",
    /** ÍTEM DE PAGO — el código; `t="n"` en los 6 ítems numéricos (§6.4). */
    codigo: "E",
    descripcion: "F",
    unidad: "G",
    equipo: "H",
    materiales: "I",
    transporte: "J",
    manoDeObra: "K",
    costoDirecto: "L",
  },
  /** Departamento y provincia del encabezado (fórmulas a PORTADA). */
  departamento: "L1",
  provincia: "L3",
} as const

// —— Hoja PORTADA (FORMATO.md §5.6) ——
export const PORTADA = {
  departamento: "D24",
  /** Celda combinada muy ancha: unos libros la escriben en F24, otros en CL24. */
  provincia: ["F24", "CL24"] as const,
  factorHorario: "G24",
  altitud: "D27",
  factorAltitud: "E27",
  temperatura: "F27",
  factorManoDeObra: "G27",
} as const

// —— Hojas de ítem (FORMATO.md §3) ——
export const ITEM = {
  /** "2026-1, Julio de 2025" — vigencia legible. */
  publicacion: "H10",
  /** Código del ítem (literal). Verificación cruzada del nombre de la hoja. */
  codigo: "B33",
  descripcion: "C33",
  unidad: "L33",
  costoDirecto: "N101",
  etiquetaCostoDirecto: "B101",
  /** Bloque AIU: debe venir vacío (§3.5). Emitir AIU está prohibido. */
  aiuSubtotal: "N109",
  aiuPrecioTotal: "N111",
  notaLegal: "B140",
} as const

export const ETIQUETA_COSTO_DIRECTO = "TOTAL COSTO DIRECTO $"
export const ETIQUETA_SUBTOTAL = "SUBTOTAL $"
export const CODIGO_HERRAMIENTA_MENOR = "HERMENINV"

/** Descripción de una de las cuatro secciones de una hoja de ítem. */
export interface SeccionItem {
  componente: Componente
  /** Celda del banner y su texto exacto (ojo: "III. TRANSPORTES", plural). */
  banner: string
  textoBanner: string
  filaEncabezados: number
  primeraLinea: number
  ultimaLinea: number
  /** Celda del subtotal de la sección. */
  subtotal: string
  /** Celda con la etiqueta "SUBTOTAL $". */
  etiquetaSubtotal: string
  /** Columnas de datos de cada línea. */
  columnas: {
    codigo: string
    descripcion: string
    /** Unidad impresa; equipo y mano de obra no la imprimen. */
    unidad?: string
    /** CANTIDAD / RENDIMIENTO. */
    cantidad: string
    /** TARIFA / PRECIO UNIT. / JR. TOTAL. */
    precioUnitario: string
    subtotal: string
    /** Solo transporte: DISTANCIA (2), siempre 1. */
    distancia?: string
    /** Solo mano de obra: JORNAL diario. */
    jornal?: string
    /** Solo mano de obra: factor prestacional (≈2.05, no un porcentaje). */
    factorPrestacional?: string
  }
}

/**
 * Las cuatro secciones, en el orden del formato.
 *
 * Ojo con las asimetrías (FORMATO.md §3.3):
 * - EQUIPO y MATERIALES multiplican (`N = ROUND(L*K, 2)`).
 * - TRANSPORTE multiplica cantidad × distancia × tarifa, y la distancia es
 *   siempre 1 (el precio es por unidad-kilómetro).
 * - MANO DE OBRA **divide**: `N = ROUND(K / L, 2)`, donde `L` es el
 *   rendimiento (unidades de obra por jornal).
 */
export const SECCIONES: readonly SeccionItem[] = [
  {
    componente: "equipo",
    banner: "B35",
    textoBanner: "I. EQUIPO",
    filaEncabezados: 37,
    primeraLinea: 38,
    ultimaLinea: 51,
    subtotal: "N53",
    etiquetaSubtotal: "B53",
    columnas: {
      codigo: "B",
      descripcion: "C",
      cantidad: "L", // RENDIMIENTO (horas por unidad de obra)
      precioUnitario: "K", // TARIFA/HORA
      subtotal: "N",
    },
  },
  {
    componente: "materiales",
    banner: "B55",
    textoBanner: "II. MATERIALES",
    filaEncabezados: 57,
    primeraLinea: 58,
    ultimaLinea: 73,
    subtotal: "N74",
    etiquetaSubtotal: "B74",
    columnas: {
      codigo: "B",
      descripcion: "C",
      unidad: "J",
      cantidad: "K",
      precioUnitario: "L",
      subtotal: "N",
    },
  },
  {
    componente: "transporte",
    banner: "B76",
    textoBanner: "III. TRANSPORTES",
    filaEncabezados: 78,
    primeraLinea: 79,
    ultimaLinea: 83,
    subtotal: "N84",
    etiquetaSubtotal: "B84",
    columnas: {
      codigo: "B",
      descripcion: "C",
      unidad: "I",
      cantidad: "J",
      distancia: "K",
      precioUnitario: "M", // TARIFA
      subtotal: "N",
    },
  },
  {
    componente: "manoDeObra",
    banner: "B86",
    textoBanner: "IV. MANO DE OBRA",
    filaEncabezados: 88,
    primeraLinea: 89,
    ultimaLinea: 98,
    subtotal: "N99",
    etiquetaSubtotal: "B99",
    columnas: {
      codigo: "B",
      descripcion: "C",
      jornal: "I",
      factorPrestacional: "J",
      precioUnitario: "K", // JR. TOTAL = jornal × factor
      cantidad: "L", // RENDIMIENTO (unidades de obra por jornal)
      subtotal: "N",
    },
  },
]

/**
 * Fila de herramienta menor, dentro de la sección de EQUIPO (FORMATO.md §3.3).
 * No es un equipo: es el 5 % del subtotal de mano de obra, contabilizado dentro
 * del subtotal de equipo.
 */
export const HERRAMIENTA_MENOR = {
  fila: 52,
  codigo: "B52",
  descripcion: "C52",
  tipo: "J52",
  /** Base = subtotal de mano de obra (`=IF(B52="","",N99)`). */
  base: "K52",
  porcentaje: "L52",
  subtotal: "N52",
} as const

// —— Hojas visibles de listados de insumos (FORMATO.md §4) ——
export interface HojaInsumos {
  hoja: string
  componente: Componente
  filaEncabezados: number
  primeraFila: number
  columnas: {
    codigo: string
    descripcion: string
    /** Ausente en MANO DE OBRA: esa hoja no imprime unidad. */
    unidad?: string
    precio: string
    categoria?: string
    factorPrestacional?: string
  }
  /** Unidad fija cuando la hoja no la imprime. */
  unidadPorDefecto?: string
}

export const LISTADOS_INSUMOS: readonly HojaInsumos[] = [
  {
    hoja: HOJA_EQUIPO,
    componente: "equipo",
    filaEncabezados: 5,
    primeraFila: 6,
    columnas: {
      codigo: "C",
      unidad: "D",
      descripcion: "E",
      categoria: "F",
      precio: "G",
    },
  },
  {
    hoja: HOJA_MATERIALES,
    componente: "materiales",
    filaEncabezados: 6,
    primeraFila: 7,
    columnas: {
      codigo: "C",
      unidad: "D",
      descripcion: "E",
      precio: "F",
      categoria: "G",
    },
  },
  {
    hoja: HOJA_TRANSPORTE,
    componente: "transporte",
    filaEncabezados: 6,
    primeraFila: 7,
    columnas: { codigo: "C", unidad: "D", descripcion: "E", precio: "F" },
  },
  {
    hoja: HOJA_MANO_DE_OBRA,
    componente: "manoDeObra",
    filaEncabezados: 10,
    primeraFila: 12,
    columnas: {
      codigo: "C",
      descripcion: "D",
      // Precio Base (COP): salario MENSUAL. La hoja de ítem lo divide entre 30
      // para obtener el jornal (FORMATO.md §4.4).
      precio: "E",
      factorPrestacional: "G",
    },
    unidadPorDefecto: "mes",
  },
]

/** Unidad de las líneas de equipo cuando el listado EQUIPO no la resuelve. */
export const UNIDAD_EQUIPO_POR_DEFECTO = "h"
/** El formato no imprime unidad en mano de obra; el valor unitario es el jornal. */
export const UNIDAD_MANO_DE_OBRA = "jornal"

/**
 * Tolerancia aritmética para cuadrar líneas contra subtotales y subtotales
 * contra el costo directo (FORMATO.md §7): la desviación máxima observada sobre
 * 526 ítems × 7 libros fue 5.8 × 10⁻¹¹ (ruido IEEE-754), y cuatro subtotales ya
 * redondeados a 2 decimales dan como mucho 0.01 de holgura.
 */
export const TOLERANCIA_INVIAS = 0.011
