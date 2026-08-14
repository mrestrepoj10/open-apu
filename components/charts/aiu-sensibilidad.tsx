"use client"

/**
 * Sensibilidad al AIU: cómo se separa el precio del costo directo a medida que
 * crece el AIU total.
 *
 * Es el gráfico que dice, sin texto de advertencia, lo que el no negociable 2
 * lleva diciendo en prosa por todo el sitio: **el costo directo no es el
 * precio**. La línea base punteada es el número que sí publica INVIAS; todo lo
 * que hay por encima es aritmética sobre un porcentaje que INVIAS no publica.
 *
 * Igual que el resto de gráficos del repo, la API no expone recharts: entran un
 * costo directo, una unidad y, si el usuario ya escribió su AIU, la marca donde
 * cae. Todas las props son serializables.
 *
 * ## Qué NO hace
 *
 * No dibuja el IVA y no reparte el AIU entre administración, imprevistos y
 * utilidad. Las dos cosas exigirían suponer una proporción que nadie publica
 * (el IVA de un contrato de construcción recae solo sobre la utilidad, así que
 * sin la proporción no hay curva de IVA honesta). El barrido es sobre el AIU
 * total y es una recta exacta — ver `barridoAiu` en `lib/aiu.ts`.
 */
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { barridoAiu } from "@/lib/aiu"
import { formatearCOP, formatearNumero } from "@/lib/format"
import { cn } from "@/lib/utils"

export type AiuSensibilidadProps = {
  /** Costo directo en COP: el punto de partida de la curva (AIU = 0). */
  costoDirecto: number
  /** Unidad de la obra analizada, p. ej. "m3". */
  unidad: string
  /**
   * AIU total del usuario, en puntos porcentuales. Si es > 0 se marca en la
   * curva con una vertical. `0` (por defecto) no dibuja marca: nadie ha
   * escrito un AIU todavía y no hay nada que señalar.
   */
  marca?: number
  /** Tope del barrido, en puntos porcentuales. */
  hasta?: number
  titulo?: string
  descripcion?: string
  className?: string
  altura?: number
}

const config = {
  total: { label: "Costo directo + AIU", color: "var(--chart-1)" },
} satisfies ChartConfig

/** Color de las dos referencias: la base publicada y la marca del usuario. */
const COLOR_REFERENCIA = "var(--chart-4)"

export function AiuSensibilidad({
  costoDirecto,
  unidad,
  marca = 0,
  hasta = 40,
  titulo,
  descripcion,
  className,
  altura = 280,
}: AiuSensibilidadProps) {
  // Paso fino para que la curva se lea continua, y para que la marca del
  // usuario caiga sobre un punto real salvo medios puntos porcentuales.
  const datos = barridoAiu(costoDirecto, { hasta, paso: 1 })

  return (
    <figure
      className={cn("w-full", className)}
      role="img"
      aria-label={
        titulo ??
        `Precio resultante al aplicar un AIU de 0 % a ${hasta} % sobre un costo directo de ${formatearCOP(costoDirecto)} por ${unidad}`
      }
    >
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
        <AreaChart
          data={datos}
          margin={{ left: 4, right: 12, top: 12, bottom: 4 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="porcentaje"
            type="number"
            domain={[0, hasta]}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tickFormatter={(valor: number) => `${valor} %`}
          />
          <YAxis
            type="number"
            width={80}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            // El eje arranca en el costo directo, no en cero: lo que interesa
            // es la distancia entre la base y el precio, y un eje desde cero la
            // aplastaría contra el borde superior.
            domain={[costoDirecto, "auto"]}
            tickFormatter={(valor: number) => formatearCOP(valor)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideIndicator
                labelFormatter={(_etiqueta, carga) => {
                  const punto = carga?.[0]?.payload as
                    | { porcentaje: number }
                    | undefined
                  return `AIU ${formatearNumero(punto?.porcentaje ?? 0)} %`
                }}
                formatter={(value) => (
                  <span className="font-mono tabular-nums">
                    {formatearCOP(Number(value))}/{unidad}
                  </span>
                )}
              />
            }
          />
          <Area
            dataKey="total"
            type="linear"
            stroke="var(--color-total)"
            strokeWidth={2}
            fill="var(--color-total)"
            fillOpacity={0.12}
            dot={false}
            isAnimationActive={false}
          />

          {/*
            La base publicada. Es el único número del gráfico que viene de la
            fuente, así que va rotulado como tal.
          */}
          <ReferenceLine
            y={costoDirecto}
            stroke={COLOR_REFERENCIA}
            strokeDasharray="4 4"
            label={{
              value: "costo directo INVIAS",
              position: "insideBottomLeft",
              className: "fill-muted-foreground text-xs",
            }}
          />

          {marca > 0 && marca <= hasta ? (
            <ReferenceLine
              x={marca}
              stroke={COLOR_REFERENCIA}
              strokeDasharray="2 3"
              label={{
                value: "tu AIU",
                position: "top",
                className: "fill-muted-foreground text-xs",
              }}
            />
          ) : null}
        </AreaChart>
      </ChartContainer>
    </figure>
  )
}
