/**
 * Formateadores compartidos (es-CO).
 *
 * Compatible con el navegador: sin `node:*` ni APIs de Bun. Se usan tanto en
 * componentes de servidor (HTML estático) como de cliente (gráficos), así que
 * el resultado debe ser idéntico en ambos lados: todos los formateadores fijan
 * el locale y, cuando hay fechas de por medio, la zona horaria (UTC).
 */

/**
 * Los formateadores de `Intl` son caros de construir; se crean una vez por
 * módulo y se reutilizan.
 */
const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})

const COP_CENTAVOS = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Umbral por debajo del cual el redondeo a peso entero deforma la cifra. */
const UMBRAL_CENTAVOS = 100

const NUMERO = new Intl.NumberFormat("es-CO")

const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  // Las fechas del esquema son ISO sin hora (AAAA-MM-DD) y se interpretan como
  // medianoche UTC: sin fijar la zona, un navegador en Bogotá (UTC-5) mostraría
  // el día anterior.
  timeZone: "UTC",
})

/**
 * Pesos colombianos, p. ej. `1034000` → `"$ 1.034.000"`.
 *
 * Los precios del esquema son costo directo en COP y pueden traer muchos
 * decimales; redondear es decisión de presentación (ver `CopSchema`).
 *
 * Se redondea a peso entero, que es lo correcto para el 99,4 % del catálogo,
 * salvo por debajo de los 100 pesos: hay tres ítems de transporte medidos en
 * kg-km cuyo costo directo vive ahí —650.3 (1,21 a 3,58), 650.5 y 650.9 (13,51
 * a 14,49)— y para ellos redondear no es presentación, es borrar el dato: las
 * 140 filas de la tabla saldrían todas como "$ 14". Bajo el umbral se muestran
 * centavos. El cero se deja entero porque nunca es un precio: significa "el
 * ítem no aplica en esta región" (FORMATO.md §6.5) y las páginas lo rotulan
 * como tal.
 */
export function formatearCOP(valor: number): string {
  if (valor === 0 || Math.abs(valor) >= UMBRAL_CENTAVOS) return COP.format(valor)
  return COP_CENTAVOS.format(valor)
}

/**
 * Número con separadores es-CO, p. ej. `1234.5` → `"1.234,5"`.
 * `decimales` fija dígitos mínimos y máximos cuando se necesita una cantidad
 * exacta (rendimientos, distancias).
 */
export function formatearNumero(valor: number, decimales?: number): string {
  if (decimales === undefined) return NUMERO.format(valor)
  return valor.toLocaleString("es-CO", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

/**
 * Porcentaje a partir de una fracción, p. ej. `0.062` → `"6,2 %"`.
 */
export function formatearPorcentaje(fraccion: number, decimales = 1): string {
  return `${formatearNumero(fraccion * 100, decimales)} %`
}

/**
 * Fecha ISO (`AAAA-MM-DD`) en es-CO, p. ej. `"2026-01-15"` →
 * `"15 de enero de 2026"`. Si la cadena no es una fecha válida se devuelve tal
 * cual: es preferible mostrar el dato crudo que un "Invalid Date".
 */
export function formatearFecha(fechaIso: string): string {
  const fecha = new Date(fechaIso)
  if (Number.isNaN(fecha.getTime())) return fechaIso
  return FECHA_LARGA.format(fecha)
}
