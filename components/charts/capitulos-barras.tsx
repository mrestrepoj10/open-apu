"use client"

/**
 * Barras agrupadas por capítulo constructivo: la mediana de esta provincia
 * contra la mediana nacional de los mismos ítems.
 *
 * Responde a "¿en qué capítulos se nota la diferencia?". El dato lo prepara
 * `compararCapitulos` en el servidor; aquí solo entra su salida (≈ 8 filas), de
 * ahí que el tipo se importe con `import type`: no arrastra el módulo al bundle
 * del cliente.
 *
 * Un capítulo cuya provincia no cotiza ningún ítem llega con
 * `medianaProvincia === 0`. La barra mide cero —no hay nada que dibujar— pero
 * el tooltip dice "No aplica aquí", nunca "$ 0": un 0 es ausencia de dato, no
 * un precio (FORMATO.md §6.5).
 */
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { CapituloComparado } from "@/app/provincias/[slug]/_components/comparar-capitulos"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatearCOP, formatearNumero } from "@/lib/format"
import { cn } from "@/lib/utils"

export type CapitulosBarrasProps = {
  capitulos: CapituloComparado[]
  titulo?: string
  descripcion?: string
  className?: string
}

const config = {
  medianaProvincia: { label: "Esta provincia", color: "var(--chart-1)" },
  medianaNacional: { label: "Mediana nacional", color: "var(--chart-3)" },
} satisfies ChartConfig

/** Alto por capítulo + margen para el eje y la leyenda. */
const ALTO_POR_CAPITULO = 44
const ALTO_EXTRA = 40

type Fila = CapituloComparado & { etiqueta: string }

export function CapitulosBarras({
  capitulos,
  titulo,
  descripcion,
  className,
}: CapitulosBarrasProps) {
  const datos: Fila[] = capitulos.map((capitulo) => ({
    ...capitulo,
    etiqueta: `${capitulo.numero} ${capitulo.nombre}`,
  }))

  const alto = capitulos.length * ALTO_POR_CAPITULO + ALTO_EXTRA

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
          <XAxis type="number" hide />
          <YAxis
            dataKey="etiqueta"
            type="category"
            tickLine={false}
            axisLine={false}
            width={150}
            tickMargin={4}
            className="text-[0.65rem]"
          />

          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_etiqueta, payload) => {
                  const fila = payload?.[0]?.payload as Fila | undefined
                  if (!fila) return null
                  return (
                    <span className="grid gap-0.5">
                      <span>
                        {fila.numero} {fila.nombre}
                      </span>
                      <span className="font-normal text-muted-foreground">
                        {formatearNumero(fila.conDato)} de{" "}
                        {formatearNumero(fila.total)} ítems con dato
                      </span>
                    </span>
                  )
                }}
                formatter={(value, name, item) => {
                  const clave = String(item?.dataKey ?? name)
                  const numero = Number(value)
                  // El 0 de la provincia es "no aplica", no un precio.
                  const sinDato = clave === "medianaProvincia" && numero <= 0
                  return (
                    <span className="flex w-full items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: item?.color }}
                        />
                        <span className="text-muted-foreground">
                          {config[clave as keyof typeof config]?.label ?? clave}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums">
                        {sinDato ? "No aplica aquí" : formatearCOP(numero)}
                      </span>
                    </span>
                  )
                }}
              />
            }
          />

          <Bar
            dataKey="medianaProvincia"
            fill="var(--color-medianaProvincia)"
            radius={4}
          />
          <Bar
            dataKey="medianaNacional"
            fill="var(--color-medianaNacional)"
            radius={4}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    </figure>
  )
}
