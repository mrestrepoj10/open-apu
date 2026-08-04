/**
 * Ayudantes puros de búsqueda de texto, compartidos por todas las tablas
 * interactivas (`/buscar`, la tabla de provincias de un ítem, el hub de
 * provincia). Sin `"use client"` y sin DOM: se pueden probar con `bun test`
 * e importar desde servidor o cliente.
 */

/**
 * Minúsculas y sin tildes: "Excavación" y "excavacion" deben encontrarse.
 *
 * `NFD` separa la letra de su diacrítico y `\p{Diacritic}` los borra, así que
 * también cae la diéresis y la tilde de la ñ (buscar "muniz" encuentra
 * "Muñiz"). Es un compromiso deliberado: en un catálogo técnico en español
 * pesa más tolerar el teclado sin tildes que distinguir la ñ.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/**
 * ¿La fila coincide con la consulta? Se busca en el código y en el título.
 * Consulta vacía = todo coincide (no es un filtro, es «aún no hay búsqueda»).
 */
export function coincide(
  fila: { codigo: string; titulo: string },
  consulta: string
): boolean {
  const aguja = normalizar(consulta.trim())
  if (!aguja) return true
  return (
    normalizar(fila.codigo).includes(aguja) ||
    normalizar(fila.titulo).includes(aguja)
  )
}

/**
 * ¿Alguno de los textos contiene la consulta? Variante para tablas cuyas
 * columnas buscables no son código+título (p. ej. provincia y departamento).
 */
export function coincideEn(
  textos: readonly string[],
  consulta: string
): boolean {
  const aguja = normalizar(consulta.trim())
  if (!aguja) return true
  return textos.some((texto) => normalizar(texto).includes(aguja))
}
