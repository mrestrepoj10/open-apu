"use client"

/**
 * Mapa del costo: un rectángulo por línea del APU, con el área proporcional a
 * su subtotal y el color del componente al que pertenece (los mismos cuatro
 * colores de la dona).
 *
 * Es la vista que ningún .xlsx da: de un vistazo se ve que un solo material
 * pesa el 40 % del análisis, o que el equipo está repartido en ocho líneas
 * diminutas. La dona resume por componente; esto baja a la línea.
 *
 * Igual que `PrecioBar` y `DesgloseDonut`, la API no expone recharts: entran
 * líneas planas (descripción, componente, subtotal) y el `costoDirecto`
 * declarado. Los porcentajes se calculan contra el **costo directo declarado**,
 * no contra la suma de las líneas: si la fuente trae un descuadre de redondeo
 * se ve tal cual en vez de maquillarlo (misma regla que la dona).
 */
import { useMemo } from "react"
import { Treemap, type TreemapNode } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatearCOP, formatearPorcentaje } from "@/lib/format"
import { COMPONENTES, type Componente } from "@/lib/schema"
import { cn } from "@/lib/utils"

/** Una línea del análisis, reducida a lo que el gráfico necesita. */
export type LineaTreemap = {
  descripcion: string
  componente: Componente
  /** Subtotal en COP. El llamador garantiza que es > 0. */
  subtotal: number
}

export type DesgloseTreemapProps = {
  lineas: LineaTreemap[]
  /** Costo directo declarado — divisor de los porcentajes (regla de la dona). */
  costoDirecto: number
  /** Unidad de la obra analizada, p. ej. "m3". */
  unidad: string
  titulo?: string
  descripcion?: string
  className?: string
  altura?: number
}

const config = {
  size: { label: "Costo directo" },
  equipo: { label: "Equipo", color: "var(--chart-1)" },
  materiales: { label: "Materiales", color: "var(--chart-2)" },
  transporte: { label: "Transporte", color: "var(--chart-3)" },
  manoDeObra: { label: "Mano de obra", color: "var(--chart-4)" },
} satisfies ChartConfig

/**
 * Color del componente. Se lee de `config` y no de `var(--color-<componente>)`
 * porque esa variable solo existe dentro del `<ChartContainer>` (la inyecta
 * `ChartStyle` en `[data-chart=…]`), y la leyenda vive fuera del contenedor.
 * El valor es el mismo `var(--chart-N)`, que ya cambia con el tema.
 */
function colorDe(componente: Componente): string {
  return config[componente].color
}

/** Un rectángulo por debajo de esto no cabe una etiqueta legible. */
const ANCHO_MINIMO_ETIQUETA = 60
const ALTO_MINIMO_ETIQUETA = 24
/** Ancho medio de carácter a `fontSize: 11`, para recortar sin medir el DOM. */
const ANCHO_CARACTER = 5.6

function recortar(texto: string, ancho: number): string {
  const maximo = Math.floor((ancho - 12) / ANCHO_CARACTER)
  if (maximo <= 1) return ""
  if (texto.length <= maximo) return texto
  return `${texto.slice(0, maximo - 1).trimEnd()}…`
}

/**
 * Celda: rectángulo + etiqueta solo si el rectángulo da para leerla. Las celdas
 * pequeñas se quedan sin texto — el tooltip las cubre, y una etiqueta recortada
 * a dos letras no informa de nada.
 *
 * El texto va blanco con contorno oscuro (`paint-order: stroke`) porque los
 * cuatro colores del tema van de muy claro (--chart-1) a muy oscuro
 * (--chart-4), y en modo oscuro además se intercambian: un único color de
 * texto no contrasta en las cuatro celdas.
 */
function Celda(nodo: TreemapNode) {
  const { x, y, width, height, name, depth } = nodo

  // El nodo raíz (depth 0) cubre todo el lienzo: no se pinta.
  if (depth === 0) return <g />

  const fill = typeof nodo.fill === "string" ? nodo.fill : "var(--chart-1)"
  const etiqueta =
    width > ANCHO_MINIMO_ETIQUETA && height > ALTO_MINIMO_ETIQUETA
      ? recortar(name, width)
      : ""

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="var(--background)"
        strokeWidth={2}
        rx={2}
      />
      {etiqueta ? (
        <text
          x={x + 6}
          y={y + height / 2 + 4}
          fontSize={11}
          fill="#fff"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={2.5}
          paintOrder="stroke"
          pointerEvents="none"
        >
          {etiqueta}
        </text>
      ) : null}
    </g>
  )
}

export function DesgloseTreemap({
  lineas,
  costoDirecto,
  unidad,
  titulo,
  descripcion,
  className,
  altura = 340,
}: DesgloseTreemapProps) {
  // `Treemap` recalcula el layout cuando cambia la identidad de `data`, así que
  // la referencia tiene que ser estable entre renders.
  const datos = useMemo(
    () =>
      lineas
        .filter((linea) => linea.subtotal > 0)
        .map((linea) => ({
          name: linea.descripcion,
          size: linea.subtotal,
          componente: linea.componente,
          fill: colorDe(linea.componente),
        })),
    [lineas]
  )

  const porcentaje = (valor: number) =>
    costoDirecto > 0 ? formatearPorcentaje(valor / costoDirecto) : "—"

  return (
    <figure className={cn("w-full", className)}>
      {titulo || descripcion ? (
        <figcaption className="mb-2 space-y-0.5">
          {titulo ? <p className="text-sm font-medium">{titulo}</p> : null}
          {descripcion ? (
            <p className="text-xs text-muted-foreground">{descripcion}</p>
          ) : null}
        </figcaption>
      ) : null}

      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height: altura }}
      >
        <Treemap
          data={datos}
          dataKey="size"
          nameKey="name"
          type="flat"
          content={Celda}
          isAnimationActive={false}
        >
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                hideIndicator
                formatter={(value, name, item) => {
                  const componente = item.payload?.componente as
                    | Componente
                    | undefined
                  return (
                    <div className="grid max-w-64 gap-0.5">
                      <span className="font-medium text-pretty">{name}</span>
                      <span className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-[2px]"
                            style={{
                              backgroundColor: componente
                                ? colorDe(componente)
                                : undefined,
                            }}
                          />
                          {componente ? config[componente].label : ""}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatearCOP(Number(value))} ·{" "}
                          {porcentaje(Number(value))}
                        </span>
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
        </Treemap>
      </ChartContainer>

      {/*
        Leyenda propia y no `<ChartLegend />`: `Legend` de recharts se pinta
        dentro del `<Surface>` del Treemap (los `children` van al SVG) y no
        sobrevive ahí. Cuatro fichas estáticas dicen lo mismo.
      */}
      <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
        {COMPONENTES.map((componente) => (
          <li key={componente} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: colorDe(componente) }}
            />
            {config[componente].label}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-muted-foreground">
        Área proporcional al subtotal de cada línea sobre el costo directo (
        {formatearCOP(costoDirecto)} por {unidad}), sin AIU.
      </p>
    </figure>
  )
}
