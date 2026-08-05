"use client"

/**
 * Barras apiladas al 100 %: la participación media de los cuatro componentes
 * del costo (equipo, materiales, transporte, mano de obra) por capítulo
 * constructivo del ÍNDICE.
 *
 * Se apilan PARTICIPACIONES medias (sin unidad), nunca pesos en COP: el
 * catálogo mezcla unidades y sumar COP/m3 con COP/kg-km no significa nada
 * (ver `app/_ui/agregados.ts`). Cada barra suma ≈ 1; el pequeño resto que
 * pueda dejar un descuadre de la fuente se muestra tal cual, no se estira.
 *
 * Los colores por componente son LOS MISMOS de la dona y el treemap del
 * desglose (`--chart-1..4` en el orden FR-APU-1): el color sigue a la entidad
 * en todo el sitio, no al gráfico.
 *
 * Igual que el resto de `components/charts/`, la API no expone recharts y no
 * lleva `Card` ni procedencia: la página compone el contenedor y pone
 * `<ProcedenciaBox />` debajo.
 */
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatearNumero, formatearPorcentaje } from "@/lib/format"
import { COMPONENTES } from "@/lib/schema"
import { cn } from "@/lib/utils"

import type { ComposicionCapitulo } from "@/app/_ui/agregados"

export type ComposicionCapitulosProps = {
  /** Capítulos con su participación media, ya ordenados por número. */
  capitulos: ComposicionCapitulo[]
  titulo?: string
  descripcion?: string
  className?: string
  altura?: number
}

/** Mismo mapa componente → token que la dona y el treemap del desglose. */
const config = {
  equipo: { label: "Equipo", color: "var(--chart-1)" },
  materiales: { label: "Materiales", color: "var(--chart-2)" },
  transporte: { label: "Transporte", color: "var(--chart-3)" },
  manoDeObra: { label: "Mano de obra", color: "var(--chart-4)" },
} satisfies ChartConfig

/** Alto por capítulo + sitio para el eje y la leyenda. */
const ALTO_POR_FILA = 36
const ALTO_EXTRA = 64

export function ComposicionCapitulos({
  capitulos,
  titulo,
  descripcion,
  className,
  altura,
}: ComposicionCapitulosProps) {
  const alto = altura ?? capitulos.length * ALTO_POR_FILA + ALTO_EXTRA

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
          data={capitulos}
          layout="vertical"
          margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
          barCategoryGap={6}
        >
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickLine={false}
            axisLine={false}
            tickFormatter={(valor: number) => formatearPorcentaje(valor)}
          />
          <YAxis
            dataKey="nombre"
            type="category"
            width={168}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            tick={{ className: "fill-foreground" }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item, indice) => (
                  <span className="flex w-full items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2.5 shrink-0 rounded-[2px]"
                        style={{
                          background:
                            config[name as keyof typeof config]?.color,
                        }}
                      />
                      <span className="text-muted-foreground">
                        {config[name as keyof typeof config]?.label ?? name}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatearPorcentaje(Number(value))}
                    </span>
                    {/* La base del promedio, una sola vez, al final. */}
                    {indice === COMPONENTES.length - 1 ? (
                      <span className="sr-only">
                        sobre{" "}
                        {formatearNumero(
                          (item.payload as ComposicionCapitulo).apus
                        )}{" "}
                        APU
                      </span>
                    ) : null}
                  </span>
                )}
              />
            }
          />
          {COMPONENTES.map((componente) => (
            <Bar
              key={componente}
              dataKey={componente}
              stackId="participacion"
              fill={`var(--color-${componente})`}
              // Separador de 1 px entre segmentos, del color de la superficie.
              stroke="var(--background)"
              strokeWidth={1}
            />
          ))}
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    </figure>
  )
}
