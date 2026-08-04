/**
 * Datos derivados del hub de provincia: la comparación por capítulo y el puesto
 * de la provincia entre las 140.
 *
 * Módulo puro, sin JSX y sin `"use client"`: eso es lo que permite que el hub
 * (Server Component) lo llame. Los helpers que la página necesita **antes** de
 * hidratar viven aquí y no en los módulos de gráfico, que son de cliente y no
 * se pueden importar desde el servidor.
 *
 * ---
 *
 * Comparación por capítulo constructivo: la mediana de esta provincia frente a
 * la mediana nacional del mismo capítulo.
 *
 * Es la respuesta a "¿en qué capítulos se nota que esta provincia es cara?".
 * Módulo puro y sin JSX: se ejecuta en el ámbito cacheado del hub (servidor) y
 * lo único que cruza la frontera al cliente es su salida (≈ 8 filas), nunca los
 * 526 ítems de entrada.
 *
 * Dos reglas cargan todo el peso:
 *
 * 1. Un costo directo de 0 significa "el ítem no aplica en esta región"
 *    (FORMATO.md §6.5), no "cuesta cero". Se excluye de la mediana provincial;
 *    si ningún ítem del capítulo aplica, `medianaProvincia` vale 0 y quien
 *    dibuje debe rotularlo "No aplica", jamás "$ 0".
 * 2. La mediana nacional se restringe a **los mismos códigos que sí tienen dato
 *    en la provincia**. Sin esa restricción la comparación miente: un capítulo
 *    donde la provincia solo cotiza los ítems baratos parecería barato frente a
 *    una nacional calculada sobre el capítulo completo. Cuando la provincia no
 *    tiene ningún ítem con dato no hay con qué restringir y se cae de vuelta al
 *    capítulo entero.
 */
import { mapaDeCapitulos, type Capitulo } from "@/app/_ui/capitulos"
import type { Catalogo, ProvinciaItem } from "@/lib/schema"

export type CapituloComparado = {
  numero: number
  nombre: string
  /** Mediana del costo directo en la provincia; 0 ⇒ ningún ítem aplica aquí. */
  medianaProvincia: number
  /** Mediana nacional de los mismos ítems (ver regla 2). */
  medianaNacional: number
  /** Ítems del capítulo con dato en la provincia. */
  conDato: number
  /** Ítems del capítulo en la provincia. */
  total: number
}

/** Una provincia en la franja: lo mínimo para situarla y navegar hasta ella. */
export type PuntoFranja = {
  slug: string
  provincia: string
  departamento: string
  /** Mediana del costo directo en COP. */
  mediana: number
}

/**
 * Puesto de una provincia entre las demás, de más barata a más cara.
 *
 * Vive aquí, y no junto al gráfico, porque el hub lo necesita en el servidor:
 * la franja se carga en diferido (`ssr: false`) y la frase del puesto tiene que
 * estar en el HTML estático, no aparecer solo tras hidratar.
 *
 * Los puntos sin mediana positiva se descartan antes de ordenar: un 0 no es un
 * precio, es "sin dato", y colarlo regalaría el puesto 1.
 */
export function puesto(
  puntos: readonly PuntoFranja[],
  slugActual: string
): { puesto: number; total: number } | null {
  const ordenados = puntos
    .filter((punto) => punto.mediana > 0)
    .sort((a, b) => a.mediana - b.mediana)

  const indice = ordenados.findIndex((punto) => punto.slug === slugActual)
  if (indice === -1) return null
  return { puesto: indice + 1, total: ordenados.length }
}

/**
 * Mediana de una lista de números (0 si está vacía).
 *
 * `app/_ui/regiones.ts` tiene la suya, privada; duplicar cinco líneas cuesta
 * menos que exportar un helper desde un módulo que solo corre en servidor.
 */
function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0
  const ordenados = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 0
    ? (ordenados[medio - 1] + ordenados[medio]) / 2
    : ordenados[medio]
}

type GrupoProvincia = {
  nombre: string
  /** Costos directos positivos, para la mediana. */
  valores: number[]
  /** Códigos con dato: la llave de la restricción apples-to-apples. */
  codigosConDato: Set<string>
  total: number
}

export function compararCapitulos(
  items: readonly ProvinciaItem[],
  catalogo: Catalogo
): CapituloComparado[] {
  const capitulosPorCodigo = mapaDeCapitulos(catalogo)

  // Mismo reparto de reserva que usa el hub cuando el catálogo no traduce el
  // capítulo de 3 dígitos: el primer dígito manda.
  const capituloDe = (codigo: string): Capitulo =>
    capitulosPorCodigo.get(codigo) ?? {
      numero: Number(codigo[0]),
      nombre: `Capítulo ${codigo[0]}`,
    }

  const provincia = new Map<number, GrupoProvincia>()
  for (const item of items) {
    const capitulo = capituloDe(item.capitulo)
    let grupo = provincia.get(capitulo.numero)
    if (!grupo) {
      grupo = {
        nombre: capitulo.nombre,
        valores: [],
        codigosConDato: new Set(),
        total: 0,
      }
      provincia.set(capitulo.numero, grupo)
    }
    grupo.total += 1
    if (item.costoDirecto > 0) {
      grupo.valores.push(item.costoDirecto)
      grupo.codigosConDato.add(item.codigo)
    }
  }

  const nacional = new Map<number, Array<{ codigo: string; mediana: number }>>()
  for (const item of catalogo.items) {
    const capitulo = capituloDe(item.capitulo)
    const lista = nacional.get(capitulo.numero)
    const fila = { codigo: item.codigo, mediana: item.costoDirecto.mediana }
    if (lista) lista.push(fila)
    else nacional.set(capitulo.numero, [fila])
  }

  return [...provincia.entries()]
    .map(([numero, grupo]) => {
      const todos = nacional.get(numero) ?? []
      const restringidos = todos.filter((fila) =>
        grupo.codigosConDato.has(fila.codigo)
      )
      const base = restringidos.length > 0 ? restringidos : todos

      return {
        numero,
        nombre: grupo.nombre,
        medianaProvincia: mediana(grupo.valores),
        medianaNacional: mediana(base.map((fila) => fila.mediana)),
        conDato: grupo.codigosConDato.size,
        total: grupo.total,
      }
    })
    .sort((a, b) => a.numero - b.numero)
}
