/**
 * Parser de los libros .xlsx de APU de referencia de INVIAS (vigencia 2026-1).
 *
 * Compatible con navegador: sin `node:*` ni APIs de Bun. La entrada siempre son
 * bytes (`ArrayBuffer`/`Uint8Array`); quien llama decide de dónde salen.
 *
 * Flujo típico:
 *
 * ```ts
 * const libro = abrirLibro(bytes, { archivo: nombre })
 * const filas = parseIndice(libro)                       // 526 ítems, 1 hoja leída
 * const apu   = parseItem(libro, "630,1,1", { procedencia })
 * const lista = parseInsumos(libro, { procedencia })
 * ```
 *
 * Reglas del formato y trampas conocidas: ver `FORMATO.md` en esta carpeta.
 * Todo lo que se emite pasa por los validadores de `lib/schema`, y todo error
 * nombra archivo, hoja y celda.
 */
export { ParserError, afirmar, type UbicacionParser } from "./errores"

export {
  Libro,
  abrirLibro,
  verificarEstructura,
  type EstadoHoja,
  type HojaInfo,
  type OpcionesAbrir,
} from "./libro"

export {
  ES_HOJA_ITEM,
  HOJAS_DE_APOYO,
  HOJAS_ESPERADAS,
  HOJA_APUS,
  HOJA_APU_BASE,
  HOJA_CALCULOS,
  HOJA_CLASIFICACION,
  HOJA_CONSIDERACIONES,
  HOJA_EQUIPO,
  HOJA_IMAGENES,
  HOJA_INDICE,
  HOJA_INSUMO_EQUIPO,
  HOJA_INSUMO_MANO_DE_OBRA,
  HOJA_INSUMO_MATERIALES,
  HOJA_INSUMO_TRANSPORTE,
  HOJA_MANO_DE_OBRA,
  HOJA_MATERIALES,
  HOJA_MENU,
  HOJA_PORTADA,
  HOJA_PROVINCIAS,
  HOJA_TRANSPORTE,
  ITEMS_ESPERADOS,
  SECCIONES,
  TOLERANCIA_INVIAS,
  type SeccionItem,
} from "./coordenadas"

export {
  FilaIndiceSchema,
  indicePorHoja,
  parseIndice,
  type FilaIndice,
} from "./indice"

export {
  parseItem,
  parseItems,
  type LineaSinResolver,
  type OpcionesItem,
} from "./item"

export {
  parseInsumos,
  parseReferenciaSalarial,
  type OpcionesInsumos,
  type ReferenciaSalarial,
} from "./insumos"

export {
  NOMBRE_ARCHIVO_APU,
  parsePortada,
  parseRegion,
  parseRegionDesdeNombreArchivo,
  partirNombreArchivo,
  type DatosNombreArchivo,
  type DatosPortada,
} from "./region"

export {
  UNIDADES_CANONICAS,
  capitalizarNombre,
  codigoConComas,
  codigoDesdeNombreHoja,
  limpiarTexto,
  nombreHojaDesdeCodigo,
  normalizarUnidad,
  partirDescripcion,
} from "./normalizar"

export {
  ArchivoZip,
  leerCadenasCompartidas,
  leerCeldas,
  type Celda,
  type Celdas,
  type EntradaZip,
  type TipoCelda,
} from "./xlsx"
