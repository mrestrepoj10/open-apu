/**
 * Capítulos constructivos del ÍNDICE INVIAS (2…9): agrupación y navegación.
 *
 * Las dos tablas largas del sitio —el catálogo (526 ítems) y el hub de
 * provincia (los mismos 526 resueltos)— se parten por capítulo y se navegan con
 * anclas. Aquí vive lo común: el orden, el `id` del ancla y las fichas de
 * navegación.
 *
 * Ojo con la nomenclatura de la fuente, que usa "capítulo" para dos cosas:
 * - `capitulo` = primer segmento del código de pago ("630"), agrupador fino;
 * - `capituloNumero`/`capituloNombre` = capítulo constructivo del ÍNDICE
 *   (6 · Estructuras y drenajes), que es el que se muestra.
 * El artefacto de provincia solo trae el primero, así que se traduce con el
 * catálogo (`mapaDeCapitulos`).
 */
import type { Catalogo } from "@/lib/schema"

export type Capitulo = {
  numero: number
  nombre: string
}

/** `id` del ancla de un capítulo; también el destino de las fichas. */
export function idCapitulo(numero: number): string {
  return `capitulo-${numero}`
}

/**
 * Traducción `capitulo` (3 dígitos) → capítulo constructivo, tomada del
 * catálogo. Cuando la fuente no trae el número se deduce del primer dígito del
 * código, igual que en `lib/data/leer.ts`.
 */
export function mapaDeCapitulos(catalogo: Catalogo): Map<string, Capitulo> {
  const mapa = new Map<string, Capitulo>()
  for (const item of catalogo.items) {
    if (mapa.has(item.capitulo)) continue
    const numero = item.capituloNumero ?? Number(item.capitulo[0])
    mapa.set(item.capitulo, {
      numero,
      nombre: item.capituloNombre ?? `Capítulo ${numero}`,
    })
  }
  return mapa
}

/** Primera línea de una descripción INVIAS (el título, sin el alcance). */
export function primeraLinea(texto: string): string {
  const salto = texto.indexOf("\n")
  return salto === -1 ? texto : texto.slice(0, salto)
}

/**
 * El alcance: lo que la fuente escribe entre paréntesis debajo del título.
 *
 * No es adorno. 106 de los 526 títulos traen un espacio en blanco a rellenar
 * ("TIPO DE CONCRETO____", "RELLENO TIPO _____") y el alcance es lo único que
 * distingue un ítem de su vecino. Se devuelve sin los paréntesis exteriores;
 * cadena vacía si el ítem no tiene alcance.
 */
export function alcance(texto: string): string {
  const salto = texto.indexOf("\n")
  if (salto === -1) return ""
  const resto = texto.slice(salto + 1).trim()
  return resto.startsWith("(") && resto.endsWith(")")
    ? resto.slice(1, -1).trim()
    : resto
}

/**
 * Agrupa cualquier lista de ítems por capítulo constructivo, conservando el
 * orden de entrada dentro de cada grupo y ordenando los grupos por número.
 */
export function agruparPorCapitulo<T>(
  items: readonly T[],
  capituloDe: (item: T) => Capitulo
): Array<Capitulo & { items: T[] }> {
  const grupos = new Map<number, Capitulo & { items: T[] }>()

  for (const item of items) {
    const capitulo = capituloDe(item)
    const grupo = grupos.get(capitulo.numero)
    if (grupo) grupo.items.push(item)
    else grupos.set(capitulo.numero, { ...capitulo, items: [item] })
  }

  return [...grupos.values()].sort((a, b) => a.numero - b.numero)
}

/**
 * Fichas de navegación por capítulo. Enlaces `<a>` a anclas de la misma
 * página: cero JavaScript, funcionan sin hidratar.
 */
export function NavCapitulos({
  capitulos,
}: {
  capitulos: ReadonlyArray<Capitulo & { items: readonly unknown[] }>
}) {
  return (
    <nav aria-label="Capítulos">
      <ul className="flex flex-wrap gap-2">
        {capitulos.map((capitulo) => (
          <li key={capitulo.numero}>
            <a
              href={`#${idCapitulo(capitulo.numero)}`}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
            >
              <span className="font-mono text-muted-foreground">
                {capitulo.numero}
              </span>
              <span>{capitulo.nombre}</span>
              <span className="text-muted-foreground tabular-nums">
                {capitulo.items.length}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
