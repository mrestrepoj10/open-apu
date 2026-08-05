"use client"

/**
 * Calculadora de AIU: el costo directo publicado + los porcentajes que aporta
 * quien usa el sitio.
 *
 * ## La regla que hace que esto sea legítimo
 *
 * El no negociable 2 prohíbe presentar los precios de referencia como precios
 * de mercado. No prohíbe que alguien calcule su propio precio — prohíbe que el
 * sitio se invente el AIU y que el resultado se confunda con la fuente. De ahí
 * las tres reglas de esta isla:
 *
 * 1. **Los porcentajes son del usuario.** Se arranca en cero (ver
 *    `lib/aiu.ts`); el sitio no sugiere un AIU «típico» porque nadie publica
 *    uno con fuente.
 * 2. **Lo calculado se ve distinto de lo publicado.** El costo directo va en
 *    la tarjeta sólida de siempre; todo lo derivado va sobre borde punteado,
 *    con su propia nota de procedencia («lo pusiste tú, no INVIAS»).
 * 3. **Nada de esto llega al servidor.** No toca `lib/data/`, no entra en el
 *    JSON ni en el parquet, y `ApuSchema` sigue siendo `strict` para que no
 *    pueda entrar por la puerta de atrás.
 *
 * ## Por qué se carga con `ssr: false`
 *
 * Dos razones que apuntan al mismo sitio:
 *
 * - **Corrección**: la página que la aloja es un componente cacheado
 *   (`"use cache"` + vigencia). Leer la URL dentro de ese ámbito es
 *   exactamente lo que Cache Components prohíbe. Sin SSR, este componente solo
 *   existe en el cliente y el ámbito cacheado nunca ve una API de petición.
 * - **Honestidad**: el HTML del servidor —lo que se indexa, lo que se cita, lo
 *   que ve alguien sin JavaScript— debe contener el costo directo y su
 *   procedencia, y **no** un precio con AIU. Que la calculadora no exista en el
 *   HTML estático no es una limitación, es la propiedad que se quiere. Mismo
 *   criterio que los gráficos (`components/charts/lazy.tsx`).
 *
 * ## El estado se refleja en la URL
 *
 * `?a=15&i=3&u=5&iva=1` acompaña siempre a lo que hay en pantalla, así que un
 * presupuesto a medio hacer se puede compartir o marcar. Se escribe con routing
 * superficial (`window.history.replaceState`, `single-page-applications.md`),
 * nunca con el router: no hay nada que pedirle al servidor.
 *
 * A diferencia de `/buscar` —donde la URL ES el estado— aquí la URL es el
 * espejo y el estado del componente es la fuente de verdad; la URL solo se lee
 * al montar. El motivo está en la cabecera de `useState` más abajo: siempre
 * `replaceState` y nunca `pushState`, así que no hay historial dentro de la
 * página que sincronizar de vuelta. Nadie quiere que Atrás deshaga los dígitos
 * de un porcentaje uno a uno.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import { AiuSensibilidad } from "@/components/charts/aiu-sensibilidad"
import {
  AIU_MAXIMO,
  IVA_GENERAL,
  calcularAiu,
  escribirAiu,
  esAiuCero,
  leerAiu,
  leerBaseIva,
  normalizarPorcentaje,
  porcentajeTotal,
  type BaseIva,
  type PorcentajesAiu,
} from "@/lib/aiu"
import {
  formatearCOP,
  formatearNumero,
  formatearPorcentaje,
} from "@/lib/format"
import { cn } from "@/lib/utils"

/** Retardo del `replaceState` mientras se teclea (mismo que `/buscar`). */
const RETARDO_MS = 200

type CampoAiu = keyof PorcentajesAiu

const CAMPOS: readonly {
  clave: CampoAiu
  etiqueta: string
  ayuda: string
}[] = [
  {
    clave: "administracion",
    etiqueta: "Administración",
    ayuda: "Costos indirectos de operar la obra y la empresa.",
  },
  {
    clave: "imprevistos",
    etiqueta: "Imprevistos",
    ayuda: "Colchón para riesgos previsibles pero no cuantificables.",
  },
  {
    clave: "utilidad",
    etiqueta: "Utilidad",
    ayuda: "El margen del contratista. Base del IVA en obra.",
  },
]

export type CalculadoraAiuProps = {
  /** Costo directo en COP sobre el que se aplica el AIU. */
  costoDirecto: number
  /** Unidad de la obra analizada, p. ej. "m3". */
  unidad: string
  /**
   * De dónde sale `costoDirecto`, en una línea. Va bajo la cifra base: el no
   * negociable 1 vale también dentro de una herramienta.
   */
  notaBase: string
  className?: string
}

export function CalculadoraAiu({
  costoDirecto,
  unidad,
  notaBase,
  className,
}: CalculadoraAiuProps) {
  const searchParams = useSearchParams()
  const idBase = useId()

  /**
   * El estado manda y la URL es su espejo — no al revés.
   *
   * La URL se lee **una sola vez**, al montar, para que un enlace compartido
   * (`?a=15&i=3&u=5`) abra la calculadora con esos porcentajes ya puestos. A
   * partir de ahí la fuente de verdad es este estado, y cada cambio se vuelca
   * en la barra de direcciones con `replaceState`.
   *
   * No hay efecto de resincronización URL → estado, y no hace falta: como aquí
   * SIEMPRE se usa `replaceState` y nunca `pushState`, la calculadora no crea
   * entradas de historial. No existe un «Atrás» dentro de la página que pudiera
   * traer unos porcentajes distintos a los que ya hay en pantalla; Atrás sale
   * de la página. Sincronizar en esa dirección sería resolver un caso que no
   * ocurre, a cambio de pisarle al usuario el separador decimal a medio teclear
   * («12,» normalizado a «12» entre pulsación y pulsación).
   *
   * El borrador guarda **cadenas**, no números: "", "0.", "12," son estados
   * legítimos de un campo a medio escribir que aún no son un porcentaje.
   */
  const [borrador, setBorrador] = useState<Record<CampoAiu, string>>(() => {
    const inicial = leerAiu(searchParams)
    return {
      administracion: textoDe(inicial.administracion),
      imprevistos: textoDe(inicial.imprevistos),
      utilidad: textoDe(inicial.utilidad),
    }
  })
  const [baseIva, setBaseIva] = useState<BaseIva>(() =>
    leerBaseIva(searchParams)
  )

  /** Los números con los que se calcula salen del borrador, ya normalizados. */
  const porcentajes = porcentajesDe(borrador)

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    },
    []
  )

  /** Vuelca unos porcentajes en la URL, conservando lo que ya hubiera. */
  const publicar = useCallback((nuevos: PorcentajesAiu, iva: BaseIva) => {
    const params = escribirAiu(
      new URLSearchParams(window.location.search),
      nuevos,
      iva
    )
    const cadena = params.toString()
    window.history.replaceState(
      null,
      "",
      cadena
        ? `${window.location.pathname}?${cadena}`
        : window.location.pathname
    )
  }, [])

  /**
   * Se publica el borrador ENTERO, no solo el campo tocado.
   *
   * Hay un único temporizador para los tres campos, así que teclear en
   * administración y saltar a utilidad antes de que venza cancela el primer
   * volcado. Si cada volcado escribiera solo su campo sobre lo que hubiera en
   * la URL, la administración recién tecleada se perdería. El borrador ya tiene
   * los tres valores; publicarlo completo hace el volcado idempotente.
   */
  const alEscribir = useCallback(
    (clave: CampoAiu, valor: string) => {
      const siguiente = { ...borrador, [clave]: valor }
      setBorrador(siguiente)
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => {
        publicar(porcentajesDe(siguiente), baseIva)
      }, RETARDO_MS)
    },
    [baseIva, borrador, publicar]
  )

  /**
   * El interruptor de IVA no espera al retardo, y arrastra consigo lo que haya
   * pendiente en el borrador: si publicara solo lo suyo, un clic aquí desharía
   * el porcentaje recién tecleado que aún no se ha volcado.
   */
  const alCambiarIva = useCallback(
    (activo: boolean) => {
      const iva: BaseIva = activo ? "utilidad" : "ninguna"
      if (temporizador.current) clearTimeout(temporizador.current)
      setBaseIva(iva)
      publicar(porcentajesDe(borrador), iva)
    },
    [borrador, publicar]
  )

  const restablecer = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    setBorrador({ administracion: "", imprevistos: "", utilidad: "" })
    setBaseIva("ninguna")
    publicar({ administracion: 0, imprevistos: 0, utilidad: 0 }, "ninguna")
  }, [publicar])

  const detalle = calcularAiu(costoDirecto, porcentajes, { baseIva })
  const vacia = esAiuCero(porcentajes)
  const total = porcentajeTotal(porcentajes)

  return (
    <section
      aria-label="Calculadora de AIU"
      className={cn("space-y-4", className)}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* ---- Entrada: los porcentajes del usuario ---- */}
        <div className="space-y-4 rounded-lg border border-dashed p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Tu AIU</h3>
            <p className="text-xs text-pretty text-muted-foreground">
              INVIAS no publica estos porcentajes: los fija la entidad en el
              pliego o el proponente en su oferta. Escribe los tuyos.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {CAMPOS.map((campo) => {
              const id = `${idBase}-${campo.clave}`
              return (
                <div key={campo.clave} className="space-y-1">
                  <label
                    htmlFor={id}
                    className="block text-xs font-medium"
                    title={campo.ayuda}
                  >
                    {campo.etiqueta}
                  </label>
                  <div className="relative">
                    <input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={AIU_MAXIMO}
                      step="0.1"
                      placeholder="0"
                      value={borrador[campo.clave]}
                      onChange={(evento) =>
                        alEscribir(campo.clave, evento.target.value)
                      }
                      aria-describedby={`${id}-ayuda`}
                      className="h-9 w-full rounded-md border bg-transparent px-2 py-1 pr-7 text-sm tabular-nums shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground"
                    >
                      %
                    </span>
                  </div>
                  <p id={`${id}-ayuda`} className="sr-only">
                    {campo.ayuda}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={baseIva === "utilidad"}
                onChange={(evento) => alCambiarIva(evento.target.checked)}
                disabled={porcentajes.utilidad === 0}
                className="mt-0.5 size-4 shrink-0 accent-primary disabled:opacity-40"
              />
              <span
                className={cn(
                  "text-pretty",
                  porcentajes.utilidad === 0 && "text-muted-foreground"
                )}
              >
                Liquidar IVA ({formatearPorcentaje(IVA_GENERAL, 0)}){" "}
                <strong className="font-medium">solo sobre la utilidad</strong>
                {porcentajes.utilidad === 0 ? (
                  <span className="text-muted-foreground">
                    {" "}
                    — escribe una utilidad para activarlo
                  </span>
                ) : null}
              </span>
            </label>

            {vacia ? null : (
              <button
                type="button"
                onClick={restablecer}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Restablecer
              </button>
            )}
          </div>
        </div>

        {/* ---- Salida: la cuenta ---- */}
        <div className="rounded-lg border border-dashed p-4">
          <dl className="space-y-1.5 text-sm">
            <Fila
              etiqueta="Costo directo"
              valor={`${formatearCOP(detalle.costoDirecto)}/${unidad}`}
              fuente
            />

            {CAMPOS.map((campo) => (
              <Fila
                key={campo.clave}
                etiqueta={campo.etiqueta}
                nota={
                  porcentajes[campo.clave] > 0
                    ? `${formatearNumero(porcentajes[campo.clave])} %`
                    : undefined
                }
                valor={`+ ${formatearCOP(detalle[campo.clave])}`}
                apagada={porcentajes[campo.clave] === 0}
              />
            ))}

            <Fila
              etiqueta="Subtotal"
              nota={vacia ? undefined : `AIU ${formatearNumero(total)} %`}
              valor={`${formatearCOP(detalle.subtotal)}/${unidad}`}
              destacada
            />

            {baseIva === "utilidad" ? (
              <Fila
                etiqueta="IVA sobre la utilidad"
                nota={formatearPorcentaje(IVA_GENERAL, 0)}
                valor={`+ ${formatearCOP(detalle.iva)}`}
              />
            ) : null}

            {baseIva === "utilidad" ? (
              <Fila
                etiqueta="Total con IVA"
                valor={`${formatearCOP(detalle.total)}/${unidad}`}
                destacada
              />
            ) : null}
          </dl>

          <p className="mt-3 border-t pt-3 text-xs text-pretty text-muted-foreground">
            <span className="text-foreground/80">
              {vacia
                ? "Sin AIU el resultado es el costo directo publicado."
                : "Cifras calculadas con los porcentajes que escribiste tú."}
            </span>{" "}
            {notaBase} INVIAS no publica AIU y este sitio no lo estima: el
            cálculo no se guarda ni se publica en ninguna parte.
          </p>
        </div>
      </div>

      {costoDirecto > 0 ? (
        <AiuSensibilidad
          costoDirecto={costoDirecto}
          unidad={unidad}
          marca={total}
          titulo="Cuánto separa el AIU al costo directo del precio"
          descripcion={`Barrido de 0 % a 40 % de AIU total sobre ${formatearCOP(costoDirecto)}/${unidad}. Sin IVA: el impuesto depende de cómo se reparta el AIU entre administración, imprevistos y utilidad.`}
        />
      ) : null}
    </section>
  )
}

/** Una línea de la cuenta. */
function Fila({
  etiqueta,
  nota,
  valor,
  fuente,
  destacada,
  apagada,
}: {
  etiqueta: string
  nota?: string
  valor: string
  /** Marca la única cifra que viene de INVIAS. */
  fuente?: boolean
  destacada?: boolean
  apagada?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5",
        destacada && "border-t pt-1.5 font-medium",
        apagada && "text-muted-foreground"
      )}
    >
      <dt className="flex items-baseline gap-1.5">
        {etiqueta}
        {nota ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {nota}
          </span>
        ) : null}
        {fuente ? (
          <span className="rounded-full border px-1.5 text-[0.65rem] text-muted-foreground">
            INVIAS
          </span>
        ) : null}
      </dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  )
}

/** Un porcentaje en cero se muestra como campo vacío, no como "0". */
function textoDe(valor: number): string {
  return valor > 0 ? String(valor) : ""
}

/**
 * Borrador (cadenas a medio teclear) → porcentajes.
 *
 * La coma se traduce a punto antes de normalizar: en es-CO el separador
 * decimal es la coma, y un `<input type="number">` en un teclado latino la
 * produce con naturalidad.
 */
function porcentajesDe(borrador: Record<CampoAiu, string>): PorcentajesAiu {
  return {
    administracion: normalizarPorcentaje(
      borrador.administracion.replace(",", ".")
    ),
    imprevistos: normalizarPorcentaje(borrador.imprevistos.replace(",", ".")),
    utilidad: normalizarPorcentaje(borrador.utilidad.replace(",", ".")),
  }
}
