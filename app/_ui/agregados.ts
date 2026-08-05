/**
 * Agregados derivados para las historias de la portada. Funciones puras, sin
 * `"use client"` y sin `next/cache`: los bucles de lectura viven en el ámbito
 * cacheado de la portada (que ya es `"use cache"` entero) y aquí solo se
 * reduce — igual que `comparar-capitulos.ts` en el hub de provincia. Puras
 * para poder probarlas con `bun test` sin infraestructura.
 *
 * Los tipos de entrada son estructurales (lo mínimo que cada función lee), no
 * los tipos zod completos: las pruebas construyen accesorios pequeños sin
 * arrastrar todo el esquema.
 *
 * ## La regla que gobierna estos agregados
 *
 * El catálogo mezcla unidades (COP/m3, COP/kg-km…): comparar precios ENTRE
 * ítems solo es honesto con medidas sin unidad — participaciones, razones,
 * conteos. Por eso:
 * - la composición promedia PARTICIPACIONES (subtotal ÷ costo directo), nunca
 *   suma pesos de unidades distintas;
 * - el nivel relativo normaliza cada APU por la mediana nacional DE SU ÍTEM
 *   antes de agregar (una razón sin unidad);
 * - un costo directo de 0 significa "no aplica" (FORMATO.md §6.5) y queda
 *   fuera de todos los agregados.
 */
import type { Capitulo } from "@/app/_ui/capitulos"
import { COMPONENTES, type Componente } from "@/lib/schema"

/** Mediana de una lista (0 si está vacía). Duplicarla cuesta menos que
 * exportarla desde los módulos que ya tienen la suya (ver comparar-capitulos). */
function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0
  const ordenados = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 0
    ? (ordenados[medio - 1] + ordenados[medio]) / 2
    : ordenados[medio]
}

// ---------------------------------------------------------------------------
// Composición por capítulo constructivo
// ---------------------------------------------------------------------------

/** Lo que la composición necesita de un `ItemRegional`. */
export type ItemParaComposicion = {
  capitulo: string
  capituloNumero?: number
  capituloNombre?: string
  regiones: ReadonlyArray<{
    costoDirecto: number
    totales: Record<Componente, number>
  }>
}

export type ComposicionCapitulo = {
  numero: number
  nombre: string
  /** APU (ítem × provincia) con dato que entran en el promedio. */
  apus: number
  /** Participación media de cada componente, en [0, 1]. */
  equipo: number
  materiales: number
  transporte: number
  manoDeObra: number
}

/**
 * Participación media de los cuatro componentes por capítulo constructivo,
 * sobre todos los APU con dato. Se promedian participaciones (cada APU pesa
 * igual), no pesos absolutos: sumar COP de unidades distintas no significa
 * nada. La base es el costo directo declarado, como en la dona (los
 * descuadres, si los hubiera, se muestran, no se maquillan).
 */
export function acumularComposicion(
  items: readonly ItemParaComposicion[]
): ComposicionCapitulo[] {
  type Acumulado = ComposicionCapitulo
  const grupos = new Map<number, Acumulado>()

  for (const item of items) {
    const numero = item.capituloNumero ?? Number(item.capitulo[0])
    let grupo = grupos.get(numero)
    if (!grupo) {
      grupo = {
        numero,
        nombre: item.capituloNombre ?? `Capítulo ${numero}`,
        apus: 0,
        equipo: 0,
        materiales: 0,
        transporte: 0,
        manoDeObra: 0,
      }
      grupos.set(numero, grupo)
    }
    for (const region of item.regiones) {
      if (region.costoDirecto <= 0) continue
      grupo.apus += 1
      for (const componente of COMPONENTES)
        grupo[componente] += region.totales[componente] / region.costoDirecto
    }
  }

  return [...grupos.values()]
    .filter((grupo) => grupo.apus > 0)
    .map((grupo) => ({
      ...grupo,
      equipo: grupo.equipo / grupo.apus,
      materiales: grupo.materiales / grupo.apus,
      transporte: grupo.transporte / grupo.apus,
      manoDeObra: grupo.manoDeObra / grupo.apus,
    }))
    .sort((a, b) => a.numero - b.numero)
}

// ---------------------------------------------------------------------------
// Nivel relativo por departamento × capítulo
// ---------------------------------------------------------------------------

/** Lo que el nivel relativo necesita de un resumen de provincia. */
export type ProvinciaParaNivel = {
  region: { codigoDane: string; departamento: string }
  items: ReadonlyArray<{
    codigo: string
    /** Capítulo de 3 dígitos del código de pago ("630"). */
    capitulo: string
    costoDirecto: number
  }>
}

export type CeldaNivel = {
  numero: number
  /** Mediana de (costo del APU ÷ mediana nacional de su ítem); 0 ⇒ sin dato. */
  razon: number
  /** APU con dato detrás de la celda. */
  apus: number
}

export type NivelDepartamento = {
  codigoDane: string
  departamento: string
  celdas: CeldaNivel[]
}

/**
 * Nivel de precio relativo por departamento × capítulo constructivo.
 *
 * Cada APU con dato se normaliza por la mediana nacional de su ítem (una razón
 * sin unidad: ×1 = "lo que el ítem cuesta en la mitad del país") y la celda es
 * la MEDIANA de esas razones sobre todas las provincias del departamento. La
 * mediana, y no el promedio, para que un ítem con un pico no arrastre la celda.
 */
export function nivelPorDepartamento(
  resumenes: readonly ProvinciaParaNivel[],
  medianaNacionalDe: ReadonlyMap<string, number>,
  capituloDe: (capitulo3: string) => Capitulo
): NivelDepartamento[] {
  const razones = new Map<string, Map<number, number[]>>()
  const nombres = new Map<string, string>()

  for (const resumen of resumenes) {
    const { codigoDane, departamento } = resumen.region
    nombres.set(codigoDane, departamento)
    let fila = razones.get(codigoDane)
    if (!fila) {
      fila = new Map()
      razones.set(codigoDane, fila)
    }
    for (const item of resumen.items) {
      const nacional = medianaNacionalDe.get(item.codigo)
      if (item.costoDirecto <= 0 || !nacional) continue
      const { numero } = capituloDe(item.capitulo)
      const lista = fila.get(numero)
      if (lista) lista.push(item.costoDirecto / nacional)
      else fila.set(numero, [item.costoDirecto / nacional])
    }
  }

  return [...razones.entries()]
    .map(([codigoDane, fila]) => ({
      codigoDane,
      departamento: nombres.get(codigoDane)!,
      celdas: [...fila.entries()]
        .map(([numero, valores]) => ({
          numero,
          razon: mediana(valores),
          apus: valores.length,
        }))
        .sort((a, b) => a.numero - b.numero),
    }))
    .sort((a, b) => a.departamento.localeCompare(b.departamento, "es-CO"))
}

// ---------------------------------------------------------------------------
// Sankey de un APU
// ---------------------------------------------------------------------------

/** Lo que el sankey necesita de un `Desglose`. */
export type DesgloseParaSankey = {
  componentes: ReadonlyArray<{
    componente: Componente
    subtotal: number
    lineas: ReadonlyArray<{ descripcion: string; subtotal: number }>
  }>
}

export type SankeyComponente = {
  componente: Componente
  subtotal: number
  /** Las líneas de mayor subtotal, de mayor a menor. */
  lineas: Array<{ nombre: string; valor: number }>
  /** Resto agrupado; `null` cuando todas las líneas caben. */
  otras: { n: number; valor: number } | null
}

/**
 * Reduce un desglose a los flujos del sankey: por componente, las `maxLineas`
 * líneas de mayor subtotal y el resto agrupado en "otras". Las líneas y los
 * componentes en cero se omiten: no hay flujo que dibujar (y un cero no es un
 * precio, FORMATO.md §6.5).
 */
export function prepararSankey(
  desglose: DesgloseParaSankey,
  maxLineas = 3
): SankeyComponente[] {
  return desglose.componentes
    .filter((grupo) => grupo.subtotal > 0)
    .map((grupo) => {
      const lineas = grupo.lineas
        .filter((linea) => linea.subtotal > 0)
        .sort((a, b) => b.subtotal - a.subtotal)
      const visibles = lineas.slice(0, maxLineas)
      const resto = lineas.slice(maxLineas)
      return {
        componente: grupo.componente,
        subtotal: grupo.subtotal,
        lineas: visibles.map((linea) => ({
          nombre: linea.descripcion,
          valor: linea.subtotal,
        })),
        otras:
          resto.length > 0
            ? {
                n: resto.length,
                valor: resto.reduce((suma, linea) => suma + linea.subtotal, 0),
              }
            : null,
      }
    })
}

// ---------------------------------------------------------------------------
// Dispersión regional por ítem
// ---------------------------------------------------------------------------

/** Lo que la dispersión necesita de un `CatalogoItem`. */
export type ItemParaDispersion = {
  codigo: string
  descripcion: string
  unidad: string
  provinciasConDato: number
  costoDirecto: { min: number; max: number; mediana: number }
}

export type ItemDisperso = {
  codigo: string
  titulo: string
  unidad: string
  /** max ÷ mediana nacional: cuántas veces la mediana cuesta en el extremo. */
  razon: number
  min: number
  max: number
  mediana: number
}

/**
 * Los ítems que más varían entre provincias: razón max ÷ mediana (sin unidad,
 * comparable entre ítems). Piden al menos `minProvincias` provincias con dato
 * para que la razón no salga de una muestra anecdótica.
 */
export function itemsMasDispersos(
  items: readonly ItemParaDispersion[],
  primeraLinea: (descripcion: string) => string,
  cuantos = 10,
  minProvincias = 10
): ItemDisperso[] {
  return items
    .filter(
      (item) =>
        item.costoDirecto.mediana > 0 && item.provinciasConDato >= minProvincias
    )
    .map((item) => ({
      codigo: item.codigo,
      titulo: primeraLinea(item.descripcion),
      unidad: item.unidad,
      razon: item.costoDirecto.max / item.costoDirecto.mediana,
      min: item.costoDirecto.min,
      max: item.costoDirecto.max,
      mediana: item.costoDirecto.mediana,
    }))
    .sort((a, b) => b.razon - a.razon)
    .slice(0, cuantos)
}
