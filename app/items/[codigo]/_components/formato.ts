/**
 * Formateadores locales de las rutas de ítem. Complementan `lib/format.ts`
 * (que es compartido) con dos casos propios de estas páginas.
 */
import { formatearCOP, formatearNumero } from "@/lib/format"

/**
 * Precio en COP para las tablas de ítem y desglose.
 *
 * Delega en `formatearCOP`: la política de decimales (centavos por debajo de
 * los 100 pesos, para no borrar los ítems de transporte en kg-km) es del sitio
 * entero, no de estas rutas. Se mantiene el nombre para que las páginas de
 * ítem importen todos sus formateadores de un solo módulo.
 */
export const formatearPrecio = formatearCOP

/**
 * Cantidad / rendimiento de una línea de APU.
 *
 * Las cantidades de la fuente van de `14` (jornales) a
 * `0.013082207282341525` (horas de volqueta por m3-km): un número fijo de
 * decimales o redondea a cero los rendimientos pequeños o llena la tabla de
 * ceros inútiles. Se escalan los decimales por magnitud y se recortan los
 * ceros finales.
 */
export function formatearCantidad(valor: number): string {
  if (valor === 0) return "0"
  const absoluto = Math.abs(valor)
  const decimales =
    absoluto >= 100 ? 2 : absoluto >= 1 ? 2 : absoluto >= 0.01 ? 4 : 6
  return formatearNumero(valor, decimales)
    .replace(/(,\d*?)0+$/, "$1")
    .replace(/,$/, "")
}

/**
 * Primera línea de la descripción INVIAS: el título del ítem sin el alcance
 * entre paréntesis (que va en la segunda línea, separado por `\n`). Es lo que
 * cabe en un `<title>`, un breadcrumb o una tarjeta.
 */
export function tituloCorto(descripcion: string): string {
  return descripcion.split("\n")[0].trim()
}

/**
 * Resto de la descripción (el alcance), o `undefined` si el ítem no lo trae.
 */
export function alcance(descripcion: string): string | undefined {
  const resto = descripcion.split("\n").slice(1).join(" ").trim()
  return resto.length > 0 ? resto : undefined
}
