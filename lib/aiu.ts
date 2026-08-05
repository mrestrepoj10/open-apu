/**
 * AIU — administración, imprevistos y utilidad.
 *
 * ## Por qué esto vive aquí y no en el esquema
 *
 * El AIU **no es dato**: INVIAS publica el bloque de costos indirectos vacío
 * (`FORMATO.md` §3.5 — `N109` y `N111` sin valor, y `lib/parser/item.ts` lanza
 * si algún día vinieran con contenido), y `ApuSchema` es `strict` justamente
 * para que un porcentaje de administración no pueda colarse en un documento
 * publicado y acabar leyéndose como precio de mercado (no negociable 2).
 *
 * Lo que hay aquí es **aritmética sobre un porcentaje que aporta quien usa el
 * sitio**. Ningún número de este módulo entra en `data/`, ni en el JSON, ni en
 * el parquet, ni en el HTML del servidor: nace y muere en el cliente. Esa
 * separación es la que deja tener una calculadora útil sin romper la regla de
 * que todo número publicado carga su procedencia.
 *
 * ## Por qué el valor por defecto es cero
 *
 * Sería fácil arrancar la calculadora en «15 / 5 / 5» y sería exactamente el
 * error que el repo evita: nadie publica ese número, así que ponerlo de fábrica
 * lo convertiría en una recomendación nuestra. El AIU lo fija la entidad en el
 * pliego o el oferente en su propuesta, y varía por contrato. Se arranca en
 * cero —donde el resultado es literalmente el costo directo— y quien sabe su
 * AIU lo escribe.
 *
 * El día que exista el corpus de AIU reales de SECOP II (ver `BACKLOG.md`), lo
 * que irá aquí es una **distribución con fuente**, no una cifra inventada.
 *
 * Compatible con el navegador: sin `node:*` ni APIs de Bun, sin dependencias.
 */

/**
 * Los tres componentes del AIU, en **puntos porcentuales** sobre el costo
 * directo (`15` = 15 %, no `0.15`).
 *
 * Se guardan como porcentaje y no como fracción porque es la unidad en la que
 * se escriben en un pliego, la que teclea el usuario y la que viaja en la URL;
 * la conversión a fracción ocurre en un único sitio (`calcularAiu`).
 */
export type PorcentajesAiu = {
  administracion: number
  imprevistos: number
  utilidad: number
}

/** Punto de partida: sin AIU, el resultado es el costo directo tal cual. */
export const AIU_CERO: PorcentajesAiu = Object.freeze({
  administracion: 0,
  imprevistos: 0,
  utilidad: 0,
})

/**
 * Tope de cordura por componente. No es una regla legal —no existe un máximo
 * general— sino un límite de entrada: evita que un `?a=999999` pintado en la
 * URL produzca una cifra absurda con aire de cálculo.
 */
export const AIU_MAXIMO = 100

/** Tarifa general de IVA en Colombia. */
export const IVA_GENERAL = 0.19

/**
 * Base gravable del IVA cuando se factura un contrato de construcción de bien
 * inmueble: el impuesto recae sobre los honorarios o la **utilidad** del
 * constructor, no sobre el valor total del contrato (Decreto 1372 de 1992,
 * art. 3, hoy compilado en el DUR 1625 de 2016).
 *
 * Es la regla que casi todas las calculadoras de AIU de internet aplican mal
 * —cargan el 19 % sobre el total— y la razón por la que la calculadora ofrece
 * el interruptor en vez de decidir por su cuenta: el tratamiento depende del
 * tipo de contrato y no todo lo que se presupuesta con APU es construcción de
 * bien inmueble.
 */
export type BaseIva = "utilidad" | "ninguna"

export type OpcionesAiu = {
  /** Sobre qué se liquida el IVA. Por defecto, no se liquida. */
  baseIva?: BaseIva
  /** Tarifa como fracción (`0.19`). Por defecto `IVA_GENERAL`. */
  tarifaIva?: number
}

/**
 * El resultado completo, en COP. Todos los valores son crudos: el redondeo es
 * decisión de la capa de presentación (misma política que `CopSchema`).
 */
export type DetalleAiu = {
  /** El único número de la estructura que viene de la fuente. */
  costoDirecto: number
  administracion: number
  imprevistos: number
  utilidad: number
  /** A + I + U. */
  totalAiu: number
  /** Costo directo + AIU: el valor a ofertar, antes de impuestos. */
  subtotal: number
  iva: number
  /** Subtotal + IVA. */
  total: number
  /** AIU total como fracción del costo directo (`0.23` = 23 %). */
  fraccionAiu: number
}

/** Suma de los tres componentes, en puntos porcentuales. */
export function porcentajeTotal(porcentajes: PorcentajesAiu): number {
  return (
    porcentajes.administracion + porcentajes.imprevistos + porcentajes.utilidad
  )
}

/** `true` si no hay nada que aplicar (el resultado sería el costo directo). */
export function esAiuCero(porcentajes: PorcentajesAiu): boolean {
  return porcentajeTotal(porcentajes) === 0
}

/**
 * Aplica el AIU a un costo directo.
 *
 * Cada componente se calcula sobre el **costo directo**, no en cascada: los
 * imprevistos no se calculan sobre (costo directo + administración). Es como se
 * liquida en un presupuesto de obra pública colombiano y como se lee el bloque
 * del propio formato FR-APU-1, donde las tres filas comparten la misma base.
 */
export function calcularAiu(
  costoDirecto: number,
  porcentajes: PorcentajesAiu,
  opciones: OpcionesAiu = {}
): DetalleAiu {
  const { baseIva = "ninguna", tarifaIva = IVA_GENERAL } = opciones

  const administracion = costoDirecto * (porcentajes.administracion / 100)
  const imprevistos = costoDirecto * (porcentajes.imprevistos / 100)
  const utilidad = costoDirecto * (porcentajes.utilidad / 100)

  const totalAiu = administracion + imprevistos + utilidad
  const subtotal = costoDirecto + totalAiu
  const iva = baseIva === "utilidad" ? utilidad * tarifaIva : 0

  return {
    costoDirecto,
    administracion,
    imprevistos,
    utilidad,
    totalAiu,
    subtotal,
    iva,
    total: subtotal + iva,
    // Un costo directo de 0 significa «el ítem no aplica en esta región»
    // (FORMATO.md §6.5): no hay fracción que calcular, y 0/0 sería NaN.
    fraccionAiu: costoDirecto > 0 ? totalAiu / costoDirecto : 0,
  }
}

/**
 * Normaliza un porcentaje que llega de fuera (URL, teclado): recorta al rango
 * `[0, AIU_MAXIMO]` y descarta lo que no sea un número finito.
 *
 * Devuelve `0` ante cualquier basura en vez de lanzar: la entrada es una URL
 * que puede escribir cualquiera, y un `?a=perro` debe dar una calculadora en
 * cero, no una página rota.
 */
export function normalizarPorcentaje(valor: unknown): number {
  const numero =
    typeof valor === "number" ? valor : Number.parseFloat(String(valor ?? ""))
  if (!Number.isFinite(numero) || numero <= 0) return 0
  return Math.min(numero, AIU_MAXIMO)
}

/**
 * Forma mínima de `URLSearchParams` que este módulo necesita.
 *
 * Se declara la forma en vez de importar el tipo de `next/navigation`: `lib/`
 * no depende del framework, y así `leerAiu` acepta igual un `URLSearchParams`
 * nativo (pruebas) que el `ReadonlyURLSearchParams` de `useSearchParams()`.
 */
export type ParamsLeibles = { get(nombre: string): string | null }

/** Claves de la URL. Cortas porque van en un enlace que se comparte. */
export const PARAM_ADMINISTRACION = "a"
export const PARAM_IMPREVISTOS = "i"
export const PARAM_UTILIDAD = "u"
export const PARAM_IVA = "iva"

/**
 * Lee el AIU de la URL. Ausente o inválido ⇒ cero, nunca un error.
 */
export function leerAiu(params: ParamsLeibles): PorcentajesAiu {
  return {
    administracion: normalizarPorcentaje(params.get(PARAM_ADMINISTRACION)),
    imprevistos: normalizarPorcentaje(params.get(PARAM_IMPREVISTOS)),
    utilidad: normalizarPorcentaje(params.get(PARAM_UTILIDAD)),
  }
}

/** Lee el interruptor de IVA de la URL (`?iva=1`). */
export function leerBaseIva(params: ParamsLeibles): BaseIva {
  return params.get(PARAM_IVA) === "1" ? "utilidad" : "ninguna"
}

/**
 * Vuelca el AIU en una `URLSearchParams`, **borrando** las claves que quedan en
 * cero en vez de dejarlas como `?a=0`: la URL sin AIU debe ser la URL limpia,
 * que es también la canónica de la página.
 */
export function escribirAiu(
  params: URLSearchParams,
  porcentajes: PorcentajesAiu,
  baseIva: BaseIva = "ninguna"
): URLSearchParams {
  const claves: [string, number][] = [
    [PARAM_ADMINISTRACION, porcentajes.administracion],
    [PARAM_IMPREVISTOS, porcentajes.imprevistos],
    [PARAM_UTILIDAD, porcentajes.utilidad],
  ]

  for (const [clave, valor] of claves) {
    if (valor > 0) params.set(clave, String(valor))
    else params.delete(clave)
  }

  // El IVA solo tiene sentido si hay utilidad sobre la que liquidarlo.
  if (baseIva === "utilidad" && porcentajes.utilidad > 0)
    params.set(PARAM_IVA, "1")
  else params.delete(PARAM_IVA)

  return params
}

/** Un punto del barrido de sensibilidad. */
export type PuntoSensibilidad = {
  /** AIU total en puntos porcentuales. */
  porcentaje: number
  /** Costo directo + AIU, en COP. Sin IVA. */
  total: number
}

/**
 * Barrido de sensibilidad: cómo se mueve el precio a medida que crece el AIU
 * total, desde 0 hasta `hasta` puntos porcentuales.
 *
 * El barrido es sobre el AIU **total** y deliberadamente **sin IVA**: repartir
 * el total entre A, I y U exigiría suponer una proporción que nadie publica, y
 * el IVA depende de esa proporción (recae solo sobre la utilidad). Sin
 * supuestos, la curva es una recta exacta —`costoDirecto × (1 + aiu)`— y lo que
 * comunica es lo único que se quiere comunicar: que el costo directo no es el
 * precio, y cuánto lo separa del precio.
 */
export function barridoAiu(
  costoDirecto: number,
  { hasta = 40, paso = 2 }: { hasta?: number; paso?: number } = {}
): PuntoSensibilidad[] {
  const puntos: PuntoSensibilidad[] = []
  for (let porcentaje = 0; porcentaje <= hasta; porcentaje += paso) {
    puntos.push({
      porcentaje,
      total: costoDirecto * (1 + porcentaje / 100),
    })
  }
  return puntos
}
