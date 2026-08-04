/**
 * Lectores puros de los artefactos JSON publicados (`data/json/<vigencia>/`).
 *
 * **Solo servidor.** Este archivo importa `node:fs/promises`: corre en build
 * (prerender de `generateStaticParams`) y en ISR, nunca en el navegador. El
 * paquete `server-only` no está instalado (la política del repo es tocar
 * `package.json` lo mínimo), así que la garantía es doble y suficiente:
 * el import de `node:*` hace fallar el build si alguien lo mete en un
 * componente `"use client"`, y el único punto de entrada público —`index.ts`—
 * está documentado como servidor.
 *
 * **Puros a propósito.** Aquí no hay `"use cache"` ni imports de `next/cache`:
 * estas funciones son `fs` + `JSON.parse` + zod y nada más, así que se pueden
 * probar con `bun test` contra los datos reales sin levantar Next. Los
 * envoltorios cacheados viven en `index.ts` (ver la nota de arquitectura ahí).
 *
 * **Validación siempre encendida.** Medido sobre los datos reales: zod cuesta
 * ~0,4 ms por `items/{codigo}.json` en caliente y ~1,9 ms el catálogo entero,
 * o sea ~0,2 s sumados sobre las 526 páginas. No compensa apagarla en
 * producción: es la red que hace ruidoso un pipeline que publicó basura.
 */
import { readdir, readFile } from "node:fs/promises"
import {
  CatalogoSchema,
  CodigoApuSchema,
  ItemRegionalSchema,
  ProvinciaResumenSchema,
  SlugSchema,
  StatsSchema,
  type Catalogo,
  type CatalogoItem,
  type ItemRegional,
  type ProvinciaResumen,
  type Stats,
} from "@/lib/schema"
import {
  CAPITULO_DESTACADO,
  dirJson,
  N_DESTACADOS,
  RUTA_CATALOGO,
  RUTA_ITEM,
  RUTA_PROVINCIA,
  RUTA_STATS,
} from "./constantes"

/**
 * Lee y parsea un JSON. Devuelve `null` si el archivo no existe; cualquier
 * otro error de E/S se propaga (un disco caído no es "no encontrado").
 */
async function leerJson(ruta: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(ruta, "utf8")) as unknown
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null
    throw error
  }
}

/**
 * `catalogo.json`: los 526 ítems con sus agregados nacionales.
 *
 * Lanza si falta o no valida: sin catálogo no hay aplicación, y un artefacto
 * corrupto debe romper el build, no servirse a medias.
 */
export async function leerCatalogo(): Promise<Catalogo> {
  const crudo = await leerJson(RUTA_CATALOGO())
  if (crudo === null) {
    throw new Error(`No existe ${RUTA_CATALOGO()} — corre \`bun run pipeline\``)
  }
  return CatalogoSchema.parse(crudo)
}

/** `stats.json`: las cifras globales de la portada. Lanza si falta (ver arriba). */
export async function leerStats(): Promise<Stats> {
  const crudo = await leerJson(RUTA_STATS())
  if (crudo === null) {
    throw new Error(`No existe ${RUTA_STATS()} — corre \`bun run pipeline\``)
  }
  return StatsSchema.parse(crudo)
}

/**
 * `items/{codigo}.json`: un ítem de pago con su precio en las 140 provincias.
 * `null` si el código no existe (la página hará `notFound()`).
 *
 * El código se valida contra `CodigoApuSchema` ANTES de componer la ruta: es
 * un segmento de URL que llega del usuario y `"../../etc/passwd"` no puede
 * convertirse en una lectura de disco.
 */
export async function leerItem(codigo: string): Promise<ItemRegional | null> {
  if (!CodigoApuSchema.safeParse(codigo).success) return null
  const crudo = await leerJson(RUTA_ITEM(codigo))
  return crudo === null ? null : ItemRegionalSchema.parse(crudo)
}

/**
 * `provincias/{slug}.json`: los 526 ítems resueltos para una provincia.
 * `null` si el slug no existe. Mismo blindaje de ruta que `leerItem`.
 */
export async function leerProvincia(
  slug: string
): Promise<ProvinciaResumen | null> {
  if (!SlugSchema.safeParse(slug).success) return null
  const crudo = await leerJson(RUTA_PROVINCIA(slug))
  return crudo === null ? null : ProvinciaResumenSchema.parse(crudo)
}

/**
 * Los 526 códigos en forma de puntos (`"630.1.1"`), en el orden del catálogo
 * (numérico por segmentos, no lexicográfico).
 *
 * Sale del catálogo y no de un `readdir`: el catálogo ES la lista canónica de
 * ítems publicados y ya viene ordenado; un `readdir` ordenaría "630.10" antes
 * de "630.2" y dependería de que el directorio no tenga sobras.
 */
export async function listarCodigos(): Promise<string[]> {
  const catalogo = await leerCatalogo()
  return catalogo.items.map((item) => item.codigo)
}

/**
 * Los 140 slugs de provincia, ordenados alfabéticamente.
 *
 * Aquí sí se lista el directorio: no hay ningún artefacto que publique los 140
 * slugs juntos (`stats.json` solo trae conteos por departamento) y leer un
 * `items/*.json` completo para sacar 140 cadenas es desperdiciar 1 MB. Se
 * filtra por sufijo `.json` y se valida cada slug, así que un `.DS_Store` o un
 * archivo suelto no entra en `generateStaticParams`.
 */
export async function listarSlugs(): Promise<string[]> {
  const archivos = await readdir(`${dirJson()}/provincias`)
  return archivos
    .filter((nombre) => nombre.endsWith(".json"))
    .map((nombre) => nombre.slice(0, -".json".length))
    .filter((slug) => SlugSchema.safeParse(slug).success)
    .sort()
}

/**
 * Los ~30 códigos "destacados": el corte de ítems para los que SÍ se
 * prerrenderiza el desglose en las 140 provincias (30 × 140 ≈ 4 200 páginas).
 * El resto se genera bajo demanda por ISR.
 *
 * Criterio, en dos pasos y determinista (no hay analítica todavía; esto es una
 * apuesta declarada, no una medición):
 *
 * 1. **Toda la familia 630** (9 ítems, concretos estructurales). Es la familia
 *    de referencia del repo —los goldens del parser son 630.x— y la más
 *    consultada de la fuente: cualquier presupuesto de puente o alcantarilla
 *    pasa por ahí.
 * 2. **Ronda por capítulo INVIAS.** Los 526 ítems se agrupan en los 8
 *    capítulos constructivos del ÍNDICE (`capituloNumero`); dentro de cada uno
 *    se ordenan por **mediana** de costo directo descendente y se van tomando
 *    por turnos (uno de cada capítulo, luego el segundo de cada uno, …) hasta
 *    completar 30. La mediana —y no el promedio ni el máximo— porque es la
 *    cifra representativa cuando hay 140 provincias con dispersión alta
 *    (`AgregadosSchema`).
 *
 * El turno por capítulo evita que los 30 destacados sean todos del capítulo
 * más caro (estructuras): se quiere cobertura, no un ranking de precio.
 * Se ignoran los ítems sin dato (`mediana === 0` = el ítem no aplica en
 * ninguna región): prerrenderizar un desglose vacío no sirve a nadie.
 *
 * Es una función pura sobre el catálogo para poder probarla y cambiar el
 * criterio sin tocar E/S.
 */
export function elegirDestacados(
  catalogo: Catalogo,
  limite: number = N_DESTACADOS
): string[] {
  const conDato = catalogo.items.filter((item) => item.costoDirecto.mediana > 0)

  const elegidos: string[] = []
  const vistos = new Set<string>()
  const agregar = (codigo: string) => {
    if (vistos.has(codigo)) return
    vistos.add(codigo)
    elegidos.push(codigo)
  }

  // 1. La familia de referencia, completa y en orden de catálogo.
  for (const item of conDato) {
    if (item.capitulo === CAPITULO_DESTACADO) agregar(item.codigo)
  }

  // 2. Ronda por capítulo INVIAS, cada uno ordenado por mediana descendente.
  const porCapitulo = new Map<number, CatalogoItem[]>()
  for (const item of conDato) {
    const capitulo = capituloInvias(item)
    const lista = porCapitulo.get(capitulo)
    if (lista) lista.push(item)
    else porCapitulo.set(capitulo, [item])
  }
  const capitulos = [...porCapitulo.keys()].sort((a, b) => a - b)
  for (const capitulo of capitulos) {
    porCapitulo
      .get(capitulo)!
      .sort((a, b) => b.costoDirecto.mediana - a.costoDirecto.mediana)
  }

  const masLargo = Math.max(...capitulos.map((c) => porCapitulo.get(c)!.length))
  for (
    let vuelta = 0;
    vuelta < masLargo && elegidos.length < limite;
    vuelta++
  ) {
    for (const capitulo of capitulos) {
      if (elegidos.length >= limite) break
      const item = porCapitulo.get(capitulo)![vuelta]
      if (item) agregar(item.codigo)
    }
  }

  return elegidos.slice(0, limite)
}

/**
 * La familia destacada (630) con dato: el corte cuyo desglose SÍ se
 * prerrenderiza en las 140 provincias (9 × 140 = 1 260 páginas). Es el paso 1
 * de `elegirDestacados`, separado en su propia función.
 *
 * El corte prerrenderizado y el corte editorial de la portada dejaron de ser
 * el mismo a propósito: prerrenderizar los 30 destacados (30 × 140 = 4 200
 * desgloses) mataba el build en Vercel (4 núcleos / 8 GB, 3 workers de
 * prerender) — la memoria de los workers crece con las páginas generadas y el
 * contenedor moría por OOM hacia la página ~3 700 de 4 910 (medido
 * 2026-08-04). Subirles el montón desde fuera no es posible: Next borra
 * `--max-old-space-size` del NODE_OPTIONS de los workers (ver la nota de
 * `.github/workflows/ci.yml`). Los 21 destacados que salen del corte los
 * cubre ISR igual que al resto de la cola larga.
 */
export function elegirFamiliaDestacada(catalogo: Catalogo): string[] {
  return catalogo.items
    .filter(
      (item) =>
        item.capitulo === CAPITULO_DESTACADO && item.costoDirecto.mediana > 0
    )
    .map((item) => item.codigo)
}

/**
 * Capítulo constructivo del ÍNDICE INVIAS (2…9). `capituloNumero` es opcional
 * en el esquema; cuando falta se deduce del primer dígito del código de pago
 * ("630" → 6), que es exactamente la correspondencia que usa la fuente.
 */
function capituloInvias(item: CatalogoItem): number {
  return item.capituloNumero ?? Number(item.capitulo[0])
}
