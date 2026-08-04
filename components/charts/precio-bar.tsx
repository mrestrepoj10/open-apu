"use client"

/**
 * Barras horizontales de precio por región / provincia.
 *
 * La API es agnóstica de la librería: entra `datos` (etiqueta + valor) y sale
 * un gráfico. Recharts es un detalle de implementación y no aparece en las
 * props, así que se puede cambiar sin tocar las páginas.
 *
 * No lleva `Card`: la página compone el contenedor y pone la procedencia
 * (`<ProcedenciaBox />`) debajo, que es obligatoria en toda superficie de
 * precio.
 */
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatearCOP } from "@/lib/format"
import { cn } from "@/lib/utils"

export type DatoBarra = {
  /** Nombre del eje: provincia, departamento, vigencia… */
  etiqueta: string
  /** Costo directo en COP. */
  valor: number
  /** Resalta la barra (p. ej. la región que el usuario está viendo). */
  destacado?: boolean
}

export type PrecioBarProps = {
  datos: DatoBarra[]
  /**
   * Unidad de la obra analizada, p. ej. "m3". Se muestra como COP/<unidad>.
   * Se omite cuando las barras agregan ítems de unidades distintas (p. ej. la
   * mediana provincial): inventar una unidad común sería mentir.
   */
  unidad?: string
  titulo?: string
  descripcion?: string
  className?: string
  /** Alto en px. Por defecto crece con el número de barras. */
  altura?: number
}

const config = {
  valor: { label: "Costo directo", color: "var(--chart-1)" },
  destacado: { label: "Costo directo", color: "var(--chart-4)" },
} satisfies ChartConfig

/** Alto por barra + margen para ejes; suficiente para que no se aplasten. */
const ALTO_POR_BARRA = 28
const ALTO_MINIMO = 160

export function PrecioBar({
  datos,
  unidad,
  titulo,
  descripcion,
  className,
  altura,
}: PrecioBarProps) {
  const alto =
    altura ?? Math.max(ALTO_MINIMO, datos.length * ALTO_POR_BARRA + 24)

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
        style={{ height: alto }}
      >
        <BarChart
          data={datos}
          layout="vertical"
          margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} />
          <XAxis type="number" dataKey="valor" hide />
          <YAxis
            dataKey="etiqueta"
            type="category"
            tickLine={false}
            axisLine={false}
            width={128}
            tickMargin={4}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideIndicator
                formatter={(value) => (
                  <span className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">Costo directo</span>
                    <span className="font-mono tabular-nums">
                      {formatearCOP(Number(value))}
                      {unidad ? `/${unidad}` : ""}
                    </span>
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="valor" radius={4}>
            {/* La clave lleva el índice: hay provincias homónimas ("Norte"). */}
            {datos.map((dato, indice) => (
              <Cell
                key={`${dato.etiqueta}-${indice}`}
                fill={
                  dato.destacado
                    ? "var(--color-destacado)"
                    : "var(--color-valor)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </figure>
  )
}
