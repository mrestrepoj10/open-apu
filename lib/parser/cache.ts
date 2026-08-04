/**
 * Memoización por libro.
 *
 * Un libro se procesa entero de una vez (526 ítems), y varias piezas —el
 * índice, el mapa de unidades de equipo, la región— se necesitan en cada ítem.
 * Recalcularlas 526 veces sería lento; guardarlas dentro de la clase `Libro`
 * crearía un ciclo de imports entre `libro.ts` y los parsers. Un `WeakMap`
 * resuelve las dos cosas y no retiene el libro en memoria.
 */
const cachesPorLibro = new WeakMap<object, Map<string, unknown>>()

export function memo<T>(libro: object, clave: string, calcular: () => T): T {
  let cache = cachesPorLibro.get(libro)
  if (!cache) {
    cache = new Map()
    cachesPorLibro.set(libro, cache)
  }
  if (cache.has(clave)) return cache.get(clave) as T
  const valor = calcular()
  cache.set(clave, valor)
  return valor
}
