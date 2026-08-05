"use client"

/**
 * Los ítems que más varían entre provincias: una barra por ítem con la razón
 * max ÷ mediana nacional (cuántas veces la mediana cuesta en la provincia más
 * cara). La razón no tiene unidad, así que SÍ es comparable entre ítems — a
 * diferencia de sus precios, que mezclan COP/m3 con COP/kg-km.
 *
 * El eje muestra el código de pago (corto y monoespaciado); el título completo,
 * la unidad y las tres cifras (mín, mediana, máx) van en el tooltip. Clic en la
 * barra → la página del ítem, donde está la curva completa y la tabla de las
 * 140 provincias.
 *
 * Igual que el resto de `components/charts/`, la API no expone recharts y la
 * página compone el contenedor y la procedencia.
 */
import { useRouter } from "next/navigation"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatearCOP, formatearNumero } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { ItemDisperso } from "@/app/_ui/agregados"

export type DispersionItemsProps = {
  /** Ítems ya ordenados de mayor a menor razón. */
  datos: ItemDisperso[]
  titulo?: string
  descripcion?: string
  className?: string
  altura?: number
}

const config = {
  razon: { label: "Máximo sobre la mediana", color: "var(--chart-2)" },
} satisfies ChartConfig

const ALTO_POR_BARRA = 30

/** ×2,4 — la forma corta de una razón. */
function formatearRazon(razon: number): string {
  return `×${formatearNumero(razon, 1)}`
}

export function DispersionItems({
  datos,
  titulo,
  descripcion,
  className,
  altura,
}: DispersionItemsProps) {
  const router = useRouter()
  const alto = altura ?? datos.length * ALTO_POR_BARRA + 40

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
          margin={{ left: 4, right: 40, top: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickFormatter={formatearRazon}
          />
          <YAxis
            dataKey="codigo"
            type="category"
            width={88}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            tick={{ className: "fill-foreground font-mono text-xs" }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                hideIndicator
                formatter={(value, _nombre, item) => {
                  const fila = item.payload as ItemDisperso
                  return (
                    <span className="grid w-full max-w-64 gap-1">
                      <span className="font-medium whitespace-normal">
                        {fila.titulo}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatearRazon(Number(value))} la mediana en la
                        provincia más cara
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        mín {formatearCOP(fila.min)} · mediana{" "}
                        {formatearCOP(fila.mediana)} · máx{" "}
                        {formatearCOP(fila.max)} por {fila.unidad}
                      </span>
                    </span>
                  )
                }}
              />
            }
          />
          <Bar
            dataKey="razon"
            fill="var(--color-razon)"
            radius={4}
            className="cursor-pointer"
            onClick={(data) => {
              const fila = data.payload as ItemDisperso | undefined
              if (fila) router.push(`/items/${fila.codigo}`)
            }}
            label={{
              position: "right",
              formatter: (valor) => formatearRazon(Number(valor)),
              className: "fill-muted-foreground text-xs font-mono",
            }}
          />
        </BarChart>
      </ChartContainer>
    </figure>
  )
}
