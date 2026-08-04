/**
 * Una sección del desglose de un APU: las líneas de un componente y su
 * subtotal, con la forma del formato FR-APU-1 (I. Equipo, II. Materiales,
 * III. Transporte, IV. Mano de obra).
 *
 * ## El significado de `cantidad` cambia por componente
 *
 * `ApuLinea.cantidad` es un solo campo con cuatro lecturas (ver `lib/schema/
 * apu.ts`), así que el encabezado de esa columna se rotula por componente en
 * vez de poner un genérico "Cantidad" que sería falso en tres de los cuatro
 * casos:
 *
 * - `equipo`: horas de uso por unidad de obra ⇒ "Rendimiento (h)".
 * - `materiales`: cantidad de insumo por unidad de obra ⇒ "Cantidad".
 * - `transporte`: cantidad transportada, que se multiplica por la distancia
 *   ⇒ "Cantidad" + columna "Distancia (km)".
 * - `manoDeObra`: unidades de obra por jornal ⇒ "Rendimiento". Aquí el
 *   subtotal DIVIDE (jornal de la cuadrilla ÷ rendimiento), lo cual se explica
 *   bajo la tabla: un lector que multiplique no llegará al subtotal.
 *
 * Las líneas de herramienta menor (`porcentaje` presente) son un porcentaje
 * del subtotal de mano de obra, no una cantidad: se muestran como porcentaje.
 */
import { formatearPorcentaje } from "@/lib/format"
import type { Componente } from "@/lib/schema"
import type { LineaDesglose } from "@/lib/data"

import { formatearCantidad, formatearPrecio } from "./formato"
import { Tabla } from "./tabla"

type Config = {
  /** Rótulo de la sección, en el orden del FR-APU-1. */
  titulo: string
  /** Encabezado de la primera columna. */
  insumo: string
  /** Encabezado de la columna de cantidad / rendimiento. */
  cantidad: string
  /** Encabezado de la columna de precio unitario. */
  precio: string
  /** El componente lleva columna de distancia (solo transporte). */
  distancia?: true
  /** Aclaración bajo la tabla, cuando el cálculo no es evidente. */
  nota?: string
}

export const CONFIG: Record<Componente, Config> = {
  equipo: {
    titulo: "I. Equipo",
    insumo: "Equipo",
    cantidad: "Rendimiento (h)",
    precio: "Tarifa",
  },
  materiales: {
    titulo: "II. Materiales",
    insumo: "Material",
    cantidad: "Cantidad",
    precio: "Precio unitario",
  },
  transporte: {
    titulo: "III. Transporte",
    insumo: "Transporte",
    cantidad: "Cantidad",
    precio: "Tarifa",
    distancia: true,
    nota: "Subtotal = cantidad × distancia × tarifa.",
  },
  manoDeObra: {
    titulo: "IV. Mano de obra",
    insumo: "Cuadrilla",
    cantidad: "Rendimiento",
    precio: "Jornal total",
    nota:
      "El rendimiento son unidades de obra por jornal, así que aquí el " +
      "subtotal divide: jornal total de la cuadrilla ÷ rendimiento. El jornal " +
      "total ya incluye el factor prestacional.",
  },
}

const CLASES = [
  "[&_th:nth-child(n+3)]:text-right [&_td:nth-child(n+3)]:text-right",
  "[&_td:nth-child(n+3)]:tabular-nums [&_td:nth-child(n+3)]:whitespace-nowrap",
  "[&_tfoot_td:last-child]:tabular-nums",
].join(" ")

export function TablaDesglose({
  componente,
  lineas,
  subtotal,
  costoDirecto,
}: {
  componente: Componente
  lineas: LineaDesglose[]
  subtotal: number
  costoDirecto: number
}) {
  const config = CONFIG[componente]
  const conParticipacion = costoDirecto > 0
  const columnas = (config.distancia ? 6 : 5) + (conParticipacion ? 1 : 0)

  return (
    <section aria-label={config.titulo} className="space-y-2">
      <h3 className="text-base font-medium">{config.titulo}</h3>

      <Tabla className={CLASES}>
        <caption className="sr-only">
          Líneas de {config.titulo} del análisis de precios unitarios, en pesos
          colombianos. Costo directo, sin AIU.
        </caption>
        <thead>
          <tr>
            <th scope="col">{config.insumo}</th>
            <th scope="col">Unidad</th>
            <th scope="col">{config.cantidad}</th>
            {config.distancia ? <th scope="col">Distancia (km)</th> : null}
            <th scope="col">{config.precio}</th>
            <th scope="col">Subtotal</th>
            {conParticipacion ? <th scope="col">Participación</th> : null}
          </tr>
        </thead>
        <tbody>
          {lineas.length === 0 ? (
            <tr>
              <td colSpan={columnas} className="text-muted-foreground italic">
                Sin líneas en esta sección
              </td>
            </tr>
          ) : (
            lineas.map((linea) => (
              <Fila
                key={`${linea.orden}-${linea.codigo ?? linea.descripcion}`}
                linea={linea}
                config={config}
                costoDirecto={conParticipacion ? costoDirecto : undefined}
              />
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={columnas - (conParticipacion ? 2 : 1)}>
              Subtotal {config.titulo}
            </td>
            <td className="text-right whitespace-nowrap">
              {formatearPrecio(subtotal)}
            </td>
            {conParticipacion ? (
              <td className="text-right whitespace-nowrap">
                {formatearPorcentaje(subtotal / costoDirecto)}
              </td>
            ) : null}
          </tr>
        </tfoot>
      </Tabla>

      {config.nota ? (
        <p className="text-xs text-muted-foreground">{config.nota}</p>
      ) : null}
    </section>
  )
}

function Fila({
  linea,
  config,
  costoDirecto,
}: {
  linea: LineaDesglose
  config: Config
  costoDirecto: number | undefined
}) {
  // Herramienta menor y similares: `cantidad` es una fracción del subtotal de
  // mano de obra, no un rendimiento. Se lee como porcentaje o no se entiende.
  const esPorcentaje = linea.porcentaje !== undefined

  return (
    <tr>
      <td className="max-w-[28rem] text-wrap whitespace-normal">
        {linea.descripcion}
        {linea.codigo ? (
          <span className="ml-1.5 font-mono text-xs text-muted-foreground">
            {linea.codigo}
          </span>
        ) : null}
        {esPorcentaje ? (
          <span className="block text-xs text-muted-foreground">
            Porcentaje del subtotal de mano de obra.
          </span>
        ) : null}
        {linea.jornal !== undefined ? (
          <span className="block text-xs text-muted-foreground tabular-nums">
            Jornal base {formatearPrecio(linea.jornal)}
            {linea.factorPrestacional !== undefined
              ? ` · factor prestacional ${formatearCantidad(linea.factorPrestacional)}`
              : ""}
          </span>
        ) : null}
      </td>
      <td>
        {linea.unidad}
        {linea.unidadCruda && linea.unidadCruda !== linea.unidad ? (
          <span
            className="ml-1 text-xs text-muted-foreground"
            title={`En el archivo fuente: «${linea.unidadCruda}»`}
          >
            ({linea.unidadCruda})
          </span>
        ) : null}
      </td>
      <td>
        {esPorcentaje
          ? formatearPorcentaje(linea.porcentaje!)
          : formatearCantidad(linea.cantidad)}
      </td>
      {config.distancia ? (
        <td>
          {linea.distancia !== undefined
            ? formatearCantidad(linea.distancia)
            : "—"}
        </td>
      ) : null}
      <td title={esPorcentaje ? "Base: subtotal de mano de obra" : undefined}>
        {formatearPrecio(linea.precioUnitario)}
      </td>
      <td>{formatearPrecio(linea.subtotal)}</td>
      {costoDirecto !== undefined ? (
        <td>
          {linea.subtotal === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <>
              <span className="whitespace-nowrap tabular-nums">
                {formatearPorcentaje(linea.subtotal / costoDirecto)}
              </span>
              <div className="mt-1 h-1.5 w-full max-w-24 rounded-full bg-muted">
                <div
                  aria-hidden="true"
                  className="h-1.5 rounded-full bg-amber-500 dark:bg-amber-600"
                  style={{
                    width: `${Math.min(100, (linea.subtotal / costoDirecto) * 100)}%`,
                  }}
                />
              </div>
            </>
          )}
        </td>
      ) : null}
    </tr>
  )
}
