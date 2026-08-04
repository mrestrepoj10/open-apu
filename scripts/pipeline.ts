#!/usr/bin/env bun
/**
 * Pipeline de datos: 140 libros .xlsx de INVIAS → artefactos estáticos.
 *
 *   bun scripts/pipeline.ts            # los 140 libros (~2 min)
 *   bun scripts/pipeline.ts --libros=3 # solo los 3 primeros, para diagnosticar
 *
 * `--libros` es únicamente para desarrollo: los artefactos que produce están
 * incompletos (menos provincias) y hay que regenerarlos con una corrida
 * completa antes de publicar.
 *
 * Tres etapas, en este orden:
 *
 * 1. **Parseo** — recorre `data/archivo/2026-1/*.xlsx` (un libro a la vez,
 *    FORMATO.md §6.1) y escribe NDJSON plano en `data/.staging/` (gitignored).
 *    Todo pasa por los validadores de `lib/schema` vía `lib/parser`.
 * 2. **DuckDB** — `scripts/sql/*.sql` lee el NDJSON y escribe Parquet zstd en
 *    `data/parquet/vigencia=2026-1/`.
 * 3. **JSON** — a partir de `apus.ndjson` escribe los artefactos que consume
 *    el explorador en `data/json/2026-1/` (catálogo, ítem × provincia,
 *    provincia, stats), cada uno con `procedencia` y `schemaVersion`.
 *
 * Determinismo: dos ejecuciones producen JSON byte a byte idéntico. No hay
 * `Date.now()` ni marcas de tiempo en los artefactos; la única fecha es
 * `fechaDescarga`, que viene del manifiesto del archivo. Los libros se
 * procesan en orden alfabético y toda colección se ordena antes de escribir.
 *
 * Solo de desarrollo: usa `node:fs` y `Bun.spawnSync`. `lib/` sigue siendo
 * compatible con el navegador; nada de esto se importa desde la app.
 */
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join, resolve } from "node:path"
import {
  abrirLibro,
  parseInsumos,
  parseItem,
  parseRegion,
  type LineaSinResolver,
} from "../lib/parser"
import { partirDescripcion } from "../lib/parser/normalizar"
import {
  CatalogoSchema,
  ItemRegionalSchema,
  NOTA_COSTO_DIRECTO,
  ProcedenciaSchema,
  ProvinciaResumenSchema,
  SCHEMA_VERSION,
  StatsSchema,
  nombreDepartamentoDane,
  type Agregados,
  type Apu,
  type Catalogo,
  type CatalogoItem,
  type ItemRegional,
  type ListaInsumos,
  type Procedencia,
  type ProvinciaResumen,
  type Stats,
} from "../lib/schema"

// ——————————————————————————— rutas ———————————————————————————

export const RAIZ = resolve(import.meta.dir, "..")
export const VIGENCIA = "2026-1"

const DIR_ARCHIVO = join(RAIZ, "data/archivo", VIGENCIA)
const MANIFIESTO = join(RAIZ, "data/archivo/manifest.json")
const DIR_STAGING = join(RAIZ, "data/.staging")
const DIR_PARQUET = join(RAIZ, "data/parquet", `vigencia=${VIGENCIA}`)
const DIR_JSON = join(RAIZ, "data/json", VIGENCIA)
const DIR_SQL = join(RAIZ, "scripts/sql")

const GENERADO_POR = "scripts/pipeline.ts"

/** Cada cuántos libros se imprime una línea de progreso. */
const CADA = 10

// ——————————————————————— filas de staging ———————————————————————
// Planas y con las mismas claves en todas las filas (incluidos los `null`),
// para que DuckDB lea un esquema estable. El orden de las claves de estos
// objetos es el orden de las columnas del Parquet.

export interface FilaApu {
  vigencia: string
  archivo: string
  regionCodigo: string
  regionCodigoDane: string
  departamento: string
  provincia: string
  slug: string
  codigo: string
  capitulo: string
  capituloNumero: number | null
  capituloNombre: string | null
  articulo: string | null
  clasificacion: string | null
  descripcion: string
  unidad: string
  unidadCruda: string | null
  equipo: number
  materiales: number
  transporte: number
  manoDeObra: number
  costoDirecto: number
  notaFuente: string | null
}

export interface FilaLinea {
  vigencia: string
  regionCodigo: string
  slug: string
  departamento: string
  provincia: string
  codigo: string
  orden: number
  componente: string
  codigoInsumo: string | null
  descripcion: string
  unidad: string
  unidadCruda: string | null
  cantidad: number
  precioUnitario: number
  subtotal: number
  porcentaje: number | null
  base: number | null
  distancia: number | null
  jornal: number | null
  factorPrestacional: number | null
}

export interface FilaInsumo {
  vigencia: string
  regionCodigo: string
  slug: string
  departamento: string
  provincia: string
  codigoInsumo: string | null
  componente: string
  descripcion: string
  unidad: string
  unidadCruda: string | null
  categoria: string | null
  precio: number
  factorPrestacional: number | null
}

// ————————————————————————— helpers puros —————————————————————————

/**
 * Redondea a 2 decimales, que es como INVIAS publica los importes.
 *
 * Solo se aplica a los valores que **la propia hoja ya redondea** con
 * `ROUND(x, 2)` —subtotales de sección, costo directo y valor unitario de
 * línea— y cuyo valor cacheado llega con ruido IEEE-754
 * (`5792090.8600000003`, FORMATO.md §6.8). No se toca lo que la fuente publica
 * sin redondear (tarifas, cantidades, factores prestacionales): ahí redondear
 * sí falsearía el dato.
 */
export function redondearCop(valor: number): number {
  const redondeado = Math.round(valor * 100) / 100
  return Object.is(redondeado, -0) ? 0 : redondeado
}

/**
 * Compara códigos de ítem segmento a segmento y **numéricamente**:
 * `200.1.1 < 200.2 < 200.12`. El orden lexicográfico pondría `200.12` antes de
 * `200.2`, que no es lo que espera nadie mirando una tabla.
 */
export function compararCodigo(a: string, b: string): number {
  const pa = a.split(".")
  const pb = b.split(".")
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i] ?? -1)
    const nb = Number(pb[i] ?? -1)
    if (na !== nb) return na - nb
  }
  return 0
}

/** Capítulo = primer segmento del código de pago: `"630.1.1"` → `"630"`. */
export function capituloDeCodigo(codigo: string): string {
  return codigo.split(".")[0] ?? codigo
}

/**
 * Descompone el capítulo constructivo del ÍNDICE
 * (`"Capitulo 2\nExplanaciones"`) en número y nombre. `null` si no encaja:
 * el agrupador que siempre funciona es `capituloDeCodigo`.
 */
export function partirCapituloIndice(
  texto: string | undefined
): { numero: number; nombre: string } | null {
  if (!texto) return null
  // `[\s\S]` en vez de la bandera `s`: el nombre va tras un salto de línea.
  const coincide = /^cap[íi]tulo\s+(\d+)\s*([\s\S]*)$/i.exec(texto.trim())
  if (!coincide) return null
  const nombre = (coincide[2] ?? "").replace(/\s+/g, " ").trim()
  if (nombre === "") return null
  return { numero: Number(coincide[1]), nombre }
}

/** Mediana de una lista no vacía (promedio de los dos centrales si es par). */
export function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0
  const orden = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(orden.length / 2)
  return orden.length % 2 === 1
    ? orden[medio]!
    : (orden[medio - 1]! + orden[medio]!) / 2
}

/**
 * Agregados de una lista de costos directos, **omitiendo los ceros**: un 0 es
 * "no aplica en esta región", no un precio (FORMATO.md §6.5). Devuelve también
 * cuántos valores aportaron dato.
 */
export function agregados(valores: readonly number[]): {
  agregados: Agregados
  conDato: number
} {
  const positivos = valores.filter((v) => v > 0)
  if (positivos.length === 0) {
    return {
      agregados: { min: 0, max: 0, mediana: 0, promedio: 0 },
      conDato: 0,
    }
  }
  const suma = positivos.reduce((acc, v) => acc + v, 0)
  return {
    agregados: {
      min: redondearCop(Math.min(...positivos)),
      max: redondearCop(Math.max(...positivos)),
      mediana: redondearCop(mediana(positivos)),
      promedio: redondearCop(suma / positivos.length),
    },
    conDato: positivos.length,
  }
}

/** Fila plana de `apus.ndjson` a partir de un APU ya validado. */
export function filaApu(apu: Apu, archivo: string): FilaApu {
  const capituloIndice = partirCapituloIndice(apu.capitulo)
  return {
    vigencia: apu.vigencia,
    archivo,
    regionCodigo: apu.region.codigo,
    regionCodigoDane: apu.region.codigoDane,
    departamento: apu.region.departamento,
    provincia: apu.region.provincia,
    slug: apu.region.slug,
    codigo: apu.codigo,
    capitulo: capituloDeCodigo(apu.codigo),
    capituloNumero: capituloIndice?.numero ?? null,
    capituloNombre: capituloIndice?.nombre ?? null,
    articulo: apu.articulo ?? null,
    clasificacion: apu.clasificacion ?? null,
    descripcion: apu.descripcion,
    unidad: apu.unidad,
    unidadCruda: apu.unidadCruda ?? null,
    equipo: redondearCop(apu.totales.equipo),
    materiales: redondearCop(apu.totales.materiales),
    transporte: redondearCop(apu.totales.transporte),
    manoDeObra: redondearCop(apu.totales.manoDeObra),
    costoDirecto: redondearCop(apu.costoDirecto),
    notaFuente: apu.nota ?? null,
  }
}

/** Filas planas de `apu_lineas.ndjson`. `orden` conserva el orden de la hoja. */
export function filasDeLineas(apu: Apu): FilaLinea[] {
  return apu.lineas.map((linea, indice) => ({
    vigencia: apu.vigencia,
    regionCodigo: apu.region.codigo,
    slug: apu.region.slug,
    departamento: apu.region.departamento,
    provincia: apu.region.provincia,
    codigo: apu.codigo,
    orden: indice + 1,
    componente: linea.componente,
    codigoInsumo: linea.codigo ?? null,
    descripcion: linea.descripcion,
    unidad: linea.unidad,
    unidadCruda: linea.unidadCruda ?? null,
    cantidad: linea.cantidad,
    precioUnitario: linea.precioUnitario,
    subtotal: redondearCop(linea.subtotal),
    porcentaje: linea.porcentaje ?? null,
    base: linea.base === undefined ? null : redondearCop(linea.base),
    distancia: linea.distancia ?? null,
    jornal: linea.jornal ?? null,
    factorPrestacional: linea.factorPrestacional ?? null,
  }))
}

/** Filas planas de `insumos.ndjson`. */
export function filasDeInsumos(lista: ListaInsumos): FilaInsumo[] {
  return lista.insumos.map((insumo) => ({
    vigencia: lista.procedencia.vigencia,
    regionCodigo: insumo.region.codigo,
    slug: insumo.region.slug,
    departamento: insumo.region.departamento,
    provincia: insumo.region.provincia,
    codigoInsumo: insumo.codigo ?? null,
    componente: insumo.componente,
    descripcion: insumo.descripcion,
    unidad: insumo.unidad,
    unidadCruda: insumo.unidadCruda ?? null,
    categoria: insumo.categoria ?? null,
    precio: insumo.precio,
    factorPrestacional: insumo.factorPrestacional ?? null,
  }))
}

/**
 * Serialización estable y amable con git: objetos indentados a 2 espacios,
 * pero **cada elemento de un arreglo en una sola línea**.
 *
 * Con `JSON.stringify(x, null, 2)` una fila de `regiones` ocupa 18 líneas y
 * 620 bytes; en una línea ocupa 245. Sobre 526 ítems × 140 provincias eso son
 * ~25 MB de diferencia, y a cambio el diff sigue siendo legible: cambiar el
 * precio de una provincia cambia exactamente una línea.
 *
 * El orden de las claves es el de construcción del objeto (nunca se ordenan
 * alfabéticamente), así que dos corridas dan bytes idénticos.
 */
export function serializarJson(valor: unknown): string {
  return escribirValor(valor, "") + "\n"
}

function escribirValor(valor: unknown, sangria: string): string {
  if (Array.isArray(valor)) {
    if (valor.length === 0) return "[]"
    const dentro = sangria + "  "
    return (
      "[\n" +
      valor.map((el) => dentro + JSON.stringify(el)).join(",\n") +
      "\n" +
      sangria +
      "]"
    )
  }
  if (valor !== null && typeof valor === "object") {
    const entradas = Object.entries(valor as Record<string, unknown>).filter(
      ([, v]) => v !== undefined
    )
    if (entradas.length === 0) return "{}"
    const dentro = sangria + "  "
    return (
      "{\n" +
      entradas
        .map(
          ([clave, v]) =>
            `${dentro}${JSON.stringify(clave)}: ${escribirValor(v, dentro)}`
        )
        .join(",\n") +
      "\n" +
      sangria +
      "}"
    )
  }
  return JSON.stringify(valor) ?? "null"
}

/** Una línea NDJSON por fila, con las claves en el orden del objeto. */
export function serializarNdjson(filas: readonly unknown[]): string {
  return filas.map((fila) => JSON.stringify(fila)).join("\n") + "\n"
}

// ————————————————————————— procedencia —————————————————————————

export interface Manifiesto {
  vigencia: string
  /** URL de la publicación oficial (el manifiesto la llama `fuente`). */
  fuente: string
  fechaDescarga: string
  licencia: string
  archivos: number
}

export function leerManifiesto(ruta = MANIFIESTO): Manifiesto {
  const datos = JSON.parse(readFileSync(ruta, "utf8")) as Manifiesto
  for (const campo of [
    "vigencia",
    "fuente",
    "fechaDescarga",
    "licencia",
  ] as const) {
    if (typeof datos[campo] !== "string" || datos[campo] === "") {
      throw new Error(`${ruta}: falta el campo "${campo}"`)
    }
  }
  return datos
}

/**
 * Procedencia canónica de la vigencia. La entidad (`fuente`) es INVIAS; el
 * manifiesto guarda la URL de la publicación en su campo `fuente`.
 */
export function procedenciaDesdeManifiesto(
  manifiesto: Manifiesto
): Procedencia {
  return ProcedenciaSchema.parse({
    fuente: "INVIAS",
    url: manifiesto.fuente,
    vigencia: manifiesto.vigencia,
    fechaDescarga: manifiesto.fechaDescarga,
    licencia: manifiesto.licencia,
  })
}

// ————————————————————————— etapa 1: parseo —————————————————————————

interface Fallo {
  archivo: string
  item?: string
  error: string
}

interface ResumenParseo {
  libros: number
  librosOk: number
  apus: number
  lineas: number
  insumos: number
  fallos: Fallo[]
  sinResolver: Array<LineaSinResolver & { archivo: string }>
}

const NDJSON = {
  apus: join(DIR_STAGING, "apus.ndjson"),
  lineas: join(DIR_STAGING, "apu_lineas.ndjson"),
  insumos: join(DIR_STAGING, "insumos.ndjson"),
} as const

function etapaParseo(procedencia: Procedencia): ResumenParseo {
  rmSync(DIR_STAGING, { recursive: true, force: true })
  mkdirSync(DIR_STAGING, { recursive: true })
  for (const ruta of Object.values(NDJSON)) writeFileSync(ruta, "")

  let archivos = readdirSync(DIR_ARCHIVO)
    .filter((nombre) => nombre.toLowerCase().endsWith(".xlsx"))
    .sort()
  const limite = leerLimite()
  if (limite !== null) {
    console.warn(
      `\n⚠ --libros=${limite}: corrida parcial, los artefactos quedarán incompletos.`
    )
    archivos = archivos.slice(0, limite)
  }
  if (archivos.length === 0) {
    throw new Error(
      `no hay libros en ${DIR_ARCHIVO}. Los .xlsx de INVIAS no se ` +
        `redistribuyen: descárgalos de la fuente oficial (ver data/archivo/manifest.json).`
    )
  }

  const resumen: ResumenParseo = {
    libros: archivos.length,
    librosOk: 0,
    apus: 0,
    lineas: 0,
    insumos: 0,
    fallos: [],
    sinResolver: [],
  }

  console.log(
    `\n[1/3] Parseo de ${archivos.length} libros → ${rel(DIR_STAGING)}`
  )
  const t0 = Bun.nanoseconds()

  for (const [indice, archivo] of archivos.entries()) {
    try {
      procesarLibro(archivo, procedencia, resumen)
      resumen.librosOk++
    } catch (error) {
      resumen.fallos.push({ archivo, error: mensaje(error) })
    }
    const n = indice + 1
    if (n % CADA === 0 || n === archivos.length) {
      console.log(
        `  ${String(n).padStart(3)}/${archivos.length}  ` +
          `${resumen.apus} APU · ${resumen.lineas} líneas · ` +
          `${resumen.insumos} insumos · ${segundos(t0)} s`
      )
    }
  }
  return resumen
}

/** Un libro a la vez: se abre, se vuelca a NDJSON y se suelta (§6.1). */
function procesarLibro(
  archivo: string,
  procedencia: Procedencia,
  resumen: ResumenParseo
): void {
  const bytes = readFileSync(join(DIR_ARCHIVO, archivo))
  const datos = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const libro = abrirLibro(datos, { archivo, exigirLibroCompleto: true })
  const region = parseRegion(libro)

  const filasApus: FilaApu[] = []
  const filasLineas: FilaLinea[] = []

  for (const hoja of libro.hojasDeItem) {
    try {
      const apu = parseItem(libro, hoja, {
        procedencia,
        region,
        alDetectarLineaSinResolver: (linea) =>
          resumen.sinResolver.push({ archivo, ...linea }),
      })
      filasApus.push(filaApu(apu, archivo))
      filasLineas.push(...filasDeLineas(apu))
    } catch (error) {
      resumen.fallos.push({ archivo, item: hoja, error: mensaje(error) })
    }
  }

  const lista = parseInsumos(libro, { procedencia, region })
  const filasInsumos = filasDeInsumos(lista)

  appendFileSync(NDJSON.apus, serializarNdjson(filasApus))
  appendFileSync(NDJSON.lineas, serializarNdjson(filasLineas))
  appendFileSync(NDJSON.insumos, serializarNdjson(filasInsumos))

  resumen.apus += filasApus.length
  resumen.lineas += filasLineas.length
  resumen.insumos += filasInsumos.length
}

// ———————————————————————— etapa 2: DuckDB ————————————————————————

const SQL = ["apus.sql", "apu_lineas.sql", "insumos.sql"] as const

function etapaDuckdb(
  procedencia: Procedencia,
  parseo: ResumenParseo
): string[] {
  const duckdb = Bun.which("duckdb") ?? "/opt/homebrew/bin/duckdb"
  const version = Bun.spawnSync({ cmd: [duckdb, "--version"] })
  if (!version.success) {
    console.error(
      `\nNo se encontró el CLI de DuckDB (${duckdb}).\n` +
        `Instálalo con:  brew install duckdb`
    )
    process.exit(1)
  }

  console.log(
    `\n[2/3] DuckDB ${version.stdout.toString().trim()} → ${rel(DIR_PARQUET)}`
  )
  mkdirSync(DIR_PARQUET, { recursive: true })

  for (const nombre of SQL) {
    const sql = readFileSync(join(DIR_SQL, nombre), "utf8")
    // Las rutas de los .sql son relativas a la raíz del repo.
    const proc = Bun.spawnSync({
      cmd: [duckdb, "-c", sql],
      cwd: RAIZ,
      stdout: "pipe",
      stderr: "pipe",
    })
    if (!proc.success) {
      console.error(`\nscripts/sql/${nombre} falló:`)
      console.error(proc.stderr.toString().trim())
      process.exit(1)
    }
    console.log(`  scripts/sql/${nombre}`)
  }

  // AGENTS.md: todo directorio de datos lleva su propia procedencia.
  writeFileSync(
    join(DIR_PARQUET, "README.md"),
    readmeParquet(procedencia, parseo)
  )

  return [
    join(DIR_PARQUET, "apus.parquet"),
    join(DIR_PARQUET, "apu_lineas.parquet"),
    join(DIR_PARQUET, "insumos.parquet"),
  ]
}

// ————————————————————————— etapa 3: JSON —————————————————————————

interface ResumenJson {
  archivos: number
  bytes: number
  mayor: { ruta: string; bytes: number }
}

function etapaJson(
  procedencia: Procedencia,
  resumenParseo: ResumenParseo
): ResumenJson {
  console.log(`\n[3/3] JSON → ${rel(DIR_JSON)}`)
  rmSync(DIR_JSON, { recursive: true, force: true })
  mkdirSync(join(DIR_JSON, "items"), { recursive: true })
  mkdirSync(join(DIR_JSON, "provincias"), { recursive: true })

  const filas = leerNdjson<FilaApu>(NDJSON.apus)

  // Agrupaciones. Las filas se comparten entre ambos mapas: no se copian.
  const porCodigo = new Map<string, FilaApu[]>()
  const porSlug = new Map<string, FilaApu[]>()
  for (const fila of filas) {
    agregarA(porCodigo, fila.codigo, fila)
    agregarA(porSlug, fila.slug, fila)
  }

  const codigos = [...porCodigo.keys()].sort(compararCodigo)
  const slugs = [...porSlug.keys()].sort()

  const escritos: Array<{ ruta: string; bytes: number }> = []
  const escribir = (ruta: string, contenido: string) => {
    writeFileSync(ruta, contenido)
    escritos.push({ ruta, bytes: Buffer.byteLength(contenido) })
  }

  // — items/{codigo}.json —
  const itemsCatalogo: CatalogoItem[] = []
  for (const codigo of codigos) {
    const grupo = [...porCodigo.get(codigo)!].sort((a, b) =>
      a.slug.localeCompare(b.slug, "en")
    )
    const cabeza = grupo[0]!
    const resumen = agregados(grupo.map((f) => f.costoDirecto))

    const documento: ItemRegional = {
      schemaVersion: SCHEMA_VERSION,
      vigencia: cabeza.vigencia,
      procedencia,
      generadoPor: GENERADO_POR,
      nota: NOTA_COSTO_DIRECTO,
      codigo,
      descripcion: cabeza.descripcion,
      unidad: cabeza.unidad,
      ...opcional("unidadCruda", cabeza.unidadCruda),
      capitulo: cabeza.capitulo,
      ...opcional("capituloNumero", cabeza.capituloNumero),
      ...opcional("capituloNombre", cabeza.capituloNombre),
      ...opcional("articulo", cabeza.articulo),
      ...opcional("clasificacion", cabeza.clasificacion),
      ...opcional("notaFuente", cabeza.notaFuente),
      agregados: resumen.agregados,
      provinciasConDato: resumen.conDato,
      regiones: grupo.map((fila) => ({
        region: {
          codigo: fila.regionCodigo,
          codigoDane: fila.regionCodigoDane,
          departamento: fila.departamento,
          provincia: fila.provincia,
          slug: fila.slug,
        },
        totales: {
          equipo: fila.equipo,
          materiales: fila.materiales,
          transporte: fila.transporte,
          manoDeObra: fila.manoDeObra,
        },
        costoDirecto: fila.costoDirecto,
      })),
    }
    validar(ItemRegionalSchema, documento, `items/${codigo}.json`)
    escribir(
      join(DIR_JSON, "items", `${codigo}.json`),
      serializarJson(documento)
    )

    itemsCatalogo.push({
      codigo,
      descripcion: cabeza.descripcion,
      unidad: cabeza.unidad,
      ...opcional("unidadCruda", cabeza.unidadCruda),
      capitulo: cabeza.capitulo,
      ...opcional("capituloNumero", cabeza.capituloNumero),
      ...opcional("capituloNombre", cabeza.capituloNombre),
      ...opcional("clasificacion", cabeza.clasificacion),
      costoDirecto: resumen.agregados,
      provinciasConDato: resumen.conDato,
    })
  }

  // — catalogo.json —
  const catalogo: Catalogo = {
    schemaVersion: SCHEMA_VERSION,
    vigencia: VIGENCIA,
    procedencia,
    generadoPor: GENERADO_POR,
    nota: NOTA_COSTO_DIRECTO,
    provincias: slugs.length,
    items: itemsCatalogo,
  }
  validar(CatalogoSchema, catalogo, "catalogo.json")
  escribir(join(DIR_JSON, "catalogo.json"), serializarJson(catalogo))

  // — provincias/{slug}.json —
  const medianasPorProvincia: Array<{
    slug: string
    departamento: string
    provincia: string
    medianaCostoDirecto: number
  }> = []
  for (const slug of slugs) {
    const grupo = [...porSlug.get(slug)!].sort((a, b) =>
      compararCodigo(a.codigo, b.codigo)
    )
    const cabeza = grupo[0]!
    const resumen = agregados(grupo.map((f) => f.costoDirecto))

    const documento: ProvinciaResumen = {
      schemaVersion: SCHEMA_VERSION,
      vigencia: cabeza.vigencia,
      procedencia,
      generadoPor: GENERADO_POR,
      nota: NOTA_COSTO_DIRECTO,
      region: {
        codigo: cabeza.regionCodigo,
        codigoDane: cabeza.regionCodigoDane,
        departamento: cabeza.departamento,
        provincia: cabeza.provincia,
        slug: cabeza.slug,
      },
      agregados: resumen.agregados,
      itemsConDato: resumen.conDato,
      items: grupo.map((fila) => ({
        codigo: fila.codigo,
        titulo: partirDescripcion(fila.descripcion).titulo,
        unidad: fila.unidad,
        capitulo: fila.capitulo,
        costoDirecto: fila.costoDirecto,
      })),
    }
    validar(ProvinciaResumenSchema, documento, `provincias/${slug}.json`)
    escribir(
      join(DIR_JSON, "provincias", `${slug}.json`),
      serializarJson(documento)
    )

    medianasPorProvincia.push({
      slug,
      departamento: cabeza.departamento,
      provincia: cabeza.provincia,
      medianaCostoDirecto: resumen.agregados.mediana,
    })
  }

  // — stats.json —
  const stats = construirStats(
    filas,
    codigos,
    slugs,
    medianasPorProvincia,
    procedencia,
    resumenParseo
  )
  validar(StatsSchema, stats, "stats.json")
  escribir(join(DIR_JSON, "stats.json"), serializarJson(stats))

  // — README.md (procedencia y licencia del directorio de datos) —
  escribir(join(DIR_JSON, "README.md"), readmeJson(stats, procedencia))

  const bytes = escritos.reduce((acc, f) => acc + f.bytes, 0)
  const mayor = escritos.reduce((a, b) => (b.bytes > a.bytes ? b : a))
  console.log(
    `  ${escritos.length} archivos · ${mb(bytes)} · mayor ${rel(mayor.ruta)} (${mb(mayor.bytes)})`
  )
  return { archivos: escritos.length, bytes, mayor }
}

function construirStats(
  filas: readonly FilaApu[],
  codigos: readonly string[],
  slugs: readonly string[],
  medianas: ReadonlyArray<{
    slug: string
    departamento: string
    provincia: string
    medianaCostoDirecto: number
  }>,
  procedencia: Procedencia,
  parseo: ResumenParseo
): Stats {
  const porCapitulo = new Map<string, Set<string>>()
  const porCapituloInvias = new Map<
    number,
    { nombre: string; items: Set<string> }
  >()
  const porDepartamento = new Map<
    string,
    { nombre: string; slugs: Set<string> }
  >()

  for (const fila of filas) {
    conjunto(porCapitulo, fila.capitulo).add(fila.codigo)
    if (fila.capituloNumero !== null && fila.capituloNombre !== null) {
      const entrada = porCapituloInvias.get(fila.capituloNumero) ?? {
        nombre: fila.capituloNombre,
        items: new Set<string>(),
      }
      entrada.items.add(fila.codigo)
      porCapituloInvias.set(fila.capituloNumero, entrada)
    }
    const depto = porDepartamento.get(fila.regionCodigoDane) ?? {
      nombre:
        nombreDepartamentoDane(fila.regionCodigoDane) ?? fila.departamento,
      slugs: new Set<string>(),
    }
    depto.slugs.add(fila.slug)
    porDepartamento.set(fila.regionCodigoDane, depto)
  }

  const ordenadas = [...medianas].sort(
    (a, b) =>
      a.medianaCostoDirecto - b.medianaCostoDirecto ||
      a.slug.localeCompare(b.slug, "en")
  )

  return {
    schemaVersion: SCHEMA_VERSION,
    vigencia: VIGENCIA,
    procedencia,
    generadoPor: GENERADO_POR,
    nota: NOTA_COSTO_DIRECTO,
    conteos: {
      items: codigos.length,
      provincias: slugs.length,
      departamentos: porDepartamento.size,
      apus: filas.length,
      lineas: parseo.lineas,
      insumos: parseo.insumos,
      lineasSinResolver: parseo.sinResolver.length,
    },
    costoDirecto: agregados(filas.map((f) => f.costoDirecto)).agregados,
    capitulos: [...porCapitulo.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([capitulo, items]) => ({ capitulo, items: items.size })),
    capitulosInvias: [...porCapituloInvias.entries()]
      .sort(([a], [b]) => a - b)
      .map(([numero, entrada]) => ({
        numero,
        nombre: entrada.nombre,
        items: entrada.items.size,
      })),
    departamentos: [...porDepartamento.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([codigoDane, entrada]) => ({
        codigoDane,
        nombre: entrada.nombre,
        provincias: entrada.slugs.size,
      })),
    notables: {
      provinciaMasCara: ordenadas[ordenadas.length - 1]!,
      provinciaMasBarata: ordenadas[0]!,
    },
  }
}

// ————————————————————————— README de datos —————————————————————————

function readmeParquet(
  procedencia: Procedencia,
  parseo: ResumenParseo
): string {
  return `# APU Stack — Parquet, vigencia ${VIGENCIA}

Generado por \`${GENERADO_POR}\` (\`bun run pipeline\`) con el CLI de DuckDB; el
SQL, comentado, está en \`scripts/sql/\`. **No se editan a mano**: para
regenerarlos hay que descargar los ${parseo.libros} libros \`.xlsx\` oficiales a
\`data/archivo/${VIGENCIA}/\` y volver a ejecutar el pipeline.

## Procedencia

| Campo | Valor |
| ----- | ----- |
| Fuente | ${procedencia.fuente} |
| Publicación | <${procedencia.url}> |
| Vigencia | ${procedencia.vigencia} |
| Fecha de descarga | ${procedencia.fechaDescarga} |
| Versión de esquema | ${SCHEMA_VERSION} |

## Licencia

${procedencia.licencia}

Los valores son **costo directo de referencia**: no incluyen AIU
(administración, imprevistos, utilidad) ni IVA y **no son precios de mercado**.
Un \`costoDirecto\` de \`0\` significa "el ítem no aplica en esta región", no que
cueste cero.

## Archivos

| Archivo | Filas | Orden | Grupo de fila | SQL |
| ------- | ----- | ----- | ------------- | --- |
| \`apus.parquet\` | ${formatoNumero(parseo.apus)} | \`codigo\`, \`slug\` | 16 384 | \`scripts/sql/apus.sql\` |
| \`apu_lineas.parquet\` | ${formatoNumero(parseo.lineas)} | \`codigo\`, \`slug\`, \`orden\` | 8 192 | \`scripts/sql/apu_lineas.sql\` |
| \`insumos.parquet\` | ${formatoNumero(parseo.insumos)} | \`codigoInsumo\`, \`slug\` | 16 384 | \`scripts/sql/insumos.sql\` |

Compresión zstd en los tres. El orden no es cosmético: ordenar
\`apu_lineas.parquet\` por \`codigo\` hace que las ~1 260 filas de un ítem (sus
líneas × ${parseo.libros} provincias) caigan en **un solo grupo de fila**, así que
un lector como hyparquet resuelve el desglose de un ítem leyendo un fragmento
del archivo en vez de los ${formatoNumero(parseo.lineas)} registros.

Por eso el desglose se sirve desde aquí y no como JSON: las
${formatoNumero(parseo.lineas)} líneas ocupan pocos MB en Parquet y cientos en
JSON.

## Semántica de las columnas

\`cantidad\` y \`precioUnitario\` significan cosas distintas según el
\`componente\` (FORMATO.md §3.3):

| Componente | \`cantidad\` | Cálculo del subtotal |
| ---------- | ---------- | -------------------- |
| \`equipo\` | horas de equipo por unidad de obra | \`cantidad × precioUnitario\` |
| \`materiales\` | insumo por unidad de obra | \`cantidad × precioUnitario\` |
| \`transporte\` | cantidad transportada | \`cantidad × distancia × precioUnitario\`, con \`distancia\` **siempre 1** (la tarifa es por unidad-kilómetro) |
| \`manoDeObra\` | **rendimiento** (unidades de obra por jornal) | \`precioUnitario ÷ cantidad\` |

La herramienta menor es una línea de \`equipo\` con \`porcentaje\` (0.05) y
\`base\` (el subtotal de mano de obra): no es un equipo real.

Se redondean a 2 decimales solo los valores que la propia hoja INVIAS calcula
con \`ROUND(x, 2)\` —\`subtotal\`, \`base\`, los totales por componente y
\`costoDirecto\`—, cuyo valor cacheado llega con ruido IEEE-754. Las tarifas,
cantidades y factores prestacionales se publican con todos sus decimales.
`
}

function readmeJson(stats: Stats, procedencia: Procedencia): string {
  const { conteos } = stats
  return `# APU Stack — datos JSON, vigencia ${stats.vigencia}

Artefactos estáticos generados por \`${GENERADO_POR}\` (\`bun run pipeline\`) a
partir de los ${conteos.provincias} libros \`.xlsx\` oficiales de INVIAS.
**No se editan a mano**: para regenerarlos hay que descargar el archivo oficial
a \`data/archivo/${stats.vigencia}/\` y volver a ejecutar el pipeline.

## Procedencia

| Campo | Valor |
| ----- | ----- |
| Fuente | ${procedencia.fuente} |
| Publicación | <${procedencia.url}> |
| Vigencia | ${procedencia.vigencia} |
| Fecha de descarga | ${procedencia.fechaDescarga} |
| Versión de esquema | ${stats.schemaVersion} |

Cada archivo de este directorio embebe ese mismo bloque \`procedencia\` y su
\`schemaVersion\`, para que siga siendo autodescriptivo si se sirve suelto
(no negociable 1 de \`AGENTS.md\`).

## Licencia y advertencias

${procedencia.licencia}

- Los valores son **costo directo de referencia**: no incluyen AIU
  (administración, imprevistos, utilidad) ni IVA, y **no son precios de
  mercado**.
- Un \`costoDirecto\` de \`0\` significa que el ítem **no aplica** en esa región
  (p. ej. transporte marítimo tierra adentro), no que cueste cero. Por eso los
  agregados (\`min\`, \`max\`, \`mediana\`, \`promedio\`) se calculan omitiendo los
  ceros y se acompañan de \`provinciasConDato\`.
- En transporte la distancia es **1 por definición**: la tarifa es por
  unidad-kilómetro y el usuario multiplica por su distancia real.
- **Bogotá D.C. no está**: está fuera del alcance de INVIAS (32 departamentos,
  ${conteos.provincias} provincias). La referencia para Bogotá es el IDU.
- Los libros \`.xlsx\` de origen **no se redistribuyen** en este repositorio.

## Artefactos

| Archivo | Cantidad | Contenido | Esquema (\`lib/schema\`) |
| ------- | -------- | --------- | ---------------------- |
| \`catalogo.json\` | 1 | los ${conteos.items} ítems de pago con agregados nacionales de costo directo | \`CatalogoSchema\` |
| \`items/{codigo}.json\` | ${conteos.items} | un ítem con su costo directo y totales por componente en las ${conteos.provincias} provincias | \`ItemRegionalSchema\` |
| \`provincias/{slug}.json\` | ${conteos.provincias} | una provincia con el resumen de sus ${conteos.items} ítems | \`ProvinciaResumenSchema\` |
| \`stats.json\` | 1 | cifras globales para la portada | \`StatsSchema\` |

El nombre de los archivos de ítem usa el código con **puntos**
(\`630.1.1.json\`), que es la forma normalizada del esquema; el libro fuente lo
escribe con comas (\`630,1,1\`).

En \`provincias/{slug}.json\` cada ítem trae \`titulo\` (la primera línea de la
descripción INVIAS) en vez de la descripción completa: la lista de ítems se
repite en las ${conteos.provincias} provincias, y el texto íntegro —con el
alcance del análisis entre paréntesis— está en \`catalogo.json\` y en
\`items/{codigo}.json\`.

## Lo que NO está aquí

El **desglose de insumos** y el **catálogo regional de insumos**
(${formatoNumero(conteos.lineas)} y ${formatoNumero(conteos.insumos)} filas) no
se publican como JSON: viven en \`data/parquet/vigencia=${stats.vigencia}/\`
(\`apu_lineas.parquet\`, \`insumos.parquet\`), ordenados por ítem y provincia para
poder consultarlos por rangos desde el navegador.

${
  conteos.lineasSinResolver > 0
    ? `## Líneas sin resolver

El libro fuente deja ${formatoNumero(conteos.lineasSinResolver)} líneas sin
resolver: un código de insumo que no existe en el listado regional, así que la
fila llega sin descripción ni precio y no suma al costo directo. Se omiten del
desglose en vez de publicarlas en cero, y los ítems afectados lo declaran en su
campo \`notaFuente\`.
`
    : ""
}`
}

// ————————————————————————— utilidades —————————————————————————

/** `--libros=N`: solo de diagnóstico (ver la cabecera del archivo). */
export function leerLimite(
  argv: readonly string[] = process.argv
): number | null {
  const bandera = argv.find((a) => a.startsWith("--libros="))
  if (!bandera) return null
  const valor = Number(bandera.slice("--libros=".length))
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new Error(`--libros espera un entero positivo, no "${bandera}"`)
  }
  return valor
}

function agregarA<T>(mapa: Map<string, T[]>, clave: string, valor: T): void {
  const lista = mapa.get(clave)
  if (lista) lista.push(valor)
  else mapa.set(clave, [valor])
}

function conjunto(mapa: Map<string, Set<string>>, clave: string): Set<string> {
  const existente = mapa.get(clave)
  if (existente) return existente
  const nuevo = new Set<string>()
  mapa.set(clave, nuevo)
  return nuevo
}

/** Incluye la clave solo si hay valor: los campos opcionales no van como `null`. */
function opcional<K extends string, V>(
  clave: K,
  valor: V | null | undefined
): Record<K, V> | Record<string, never> {
  return valor === null || valor === undefined
    ? {}
    : ({ [clave]: valor } as Record<K, V>)
}

function leerNdjson<T>(ruta: string): T[] {
  const texto = readFileSync(ruta, "utf8")
  const filas: T[] = []
  for (const linea of texto.split("\n")) {
    if (linea === "") continue
    filas.push(JSON.parse(linea) as T)
  }
  return filas
}

function validar(
  esquema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } },
  documento: unknown,
  nombre: string
): void {
  const resultado = esquema.safeParse(documento)
  if (!resultado.success) {
    const issues = (resultado.error as { issues?: unknown })?.issues
    throw new Error(
      `${nombre} no valida contra el esquema: ${JSON.stringify(issues)}`
    )
  }
}

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function rel(ruta: string): string {
  return ruta.startsWith(RAIZ) ? ruta.slice(RAIZ.length + 1) : ruta
}

function mb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function segundos(desde: number): string {
  return ((Bun.nanoseconds() - desde) / 1e9).toFixed(1)
}

function formatoNumero(valor: number): string {
  return valor.toLocaleString("es-CO")
}

// ————————————————————————— informe final —————————————————————————

function informe(
  parseo: ResumenParseo,
  parquet: readonly string[],
  json: ResumenJson,
  t0: number
): void {
  console.log("\n" + "—".repeat(72))
  console.log(
    `Libros: ${parseo.librosOk}/${parseo.libros} · ` +
      `${formatoNumero(parseo.apus)} APU · ${formatoNumero(parseo.lineas)} líneas · ` +
      `${formatoNumero(parseo.insumos)} insumos · ${segundos(t0)} s`
  )

  console.log("\nParquet:")
  let totalParquet = 0
  for (const ruta of parquet) {
    const bytes = statSync(ruta).size
    totalParquet += bytes
    console.log(`  ${rel(ruta).padEnd(46)} ${mb(bytes).padStart(10)}`)
  }
  console.log(`  ${"total".padEnd(46)} ${mb(totalParquet).padStart(10)}`)
  console.log(
    `\nJSON: ${json.archivos} archivos · ${mb(json.bytes)} · ` +
      `mayor ${rel(json.mayor.ruta)} (${mb(json.mayor.bytes)})`
  )

  if (parseo.sinResolver.length > 0) {
    const porItem = new Map<string, number>()
    for (const linea of parseo.sinResolver) {
      porItem.set(linea.hoja, (porItem.get(linea.hoja) ?? 0) + 1)
    }
    console.log(
      `\nLíneas sin resolver en el libro fuente: ${parseo.sinResolver.length} ` +
        `(esperado; se omiten del desglose, no suman al costo directo)`
    )
    for (const [hoja, cuenta] of [...porItem].sort()) {
      console.log(`  ítem ${hoja}: ${cuenta} líneas`)
    }
  }

  if (parseo.fallos.length > 0) {
    console.error(`\n${parseo.fallos.length} fallos:`)
    for (const fallo of parseo.fallos.slice(0, 40)) {
      console.error(
        `  ${fallo.archivo}${fallo.item ? ` · ítem ${fallo.item}` : ""}: ${fallo.error}`
      )
    }
    if (parseo.fallos.length > 40) {
      console.error(`  … y ${parseo.fallos.length - 40} más`)
    }
    process.exitCode = 1
  } else {
    console.log(
      `\nSin fallos: los ${parseo.libros} libros parsearon completos ` +
        `(${formatoNumero(parseo.apus)} APU).`
    )
  }
}

// ————————————————————————————— main —————————————————————————————

function main(): void {
  const t0 = Bun.nanoseconds()
  const procedencia = procedenciaDesdeManifiesto(leerManifiesto())
  console.log(
    `APU Stack · pipeline de datos · vigencia ${procedencia.vigencia} ` +
      `(descarga ${procedencia.fechaDescarga})`
  )

  const parseo = etapaParseo(procedencia)
  const parquet = etapaDuckdb(procedencia, parseo)
  const json = etapaJson(procedencia, parseo)
  informe(parseo, parquet, json, t0)
}

if (import.meta.main) main()
