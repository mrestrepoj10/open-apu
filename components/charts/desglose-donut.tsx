"use client"

/**
 * Dona con la participación de los cuatro componentes del costo directo
 * (equipo, materiales, transporte, mano de obra) en el orden del formato
 * FR-APU-1.
 *
 * Igual que `PrecioBar`, la API no expone recharts: entra `totales` (el objeto
 * `TotalesPorComponente` del esquema) y el `costoDirecto` declarado. Se usa el
 * costo directo declarado —no la suma de los totales— para calcular los
 * porcentajes: si la fuente trae un descuadre de redondeo, se muestra tal cual
 * en vez de maquillarlo (`revisarCoherencia` es quien debe hacer ruido).
 */
import { Cell, Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatearCOP, formatearPorcentaje } from "@/lib/format"
import { COMPONENTES, type TotalesPorComponente } from "@/lib/schema"
import { cn } from "@/lib/utils"

export type DesgloseDonutProps = {
  totales: TotalesPorComponente
  /** Costo directo declarado en COP (base de los porcentajes). */
  costoDirecto: number
  /** Unidad de la obra analizada, p. ej. "m3". */
  unidad: string
  titulo?: string
  descripcion?: string
  className?: string
  altura?: number
}

const config = {
  valor: { label: "Costo directo" },
  equipo: { label: "Equipo", color: "var(--chart-1)" },
  materiales: { label: "Materiales", color: "var(--chart-2)" },
  transporte: { label: "Transporte", color: "var(--chart-3)" },
  manoDeObra: { label: "Mano de obra", color: "var(--chart-4)" },
} satisfies ChartConfig

export function DesgloseDonut({
  totales,
  costoDirecto,
  unidad,
  titulo,
  descripcion,
  className,
  altura = 240,
}: DesgloseDonutProps) {
  const datos = COMPONENTES.map((componente) => ({
    componente,
    valor: totales[componente],
    fill: `var(--color-${componente})`,
  })).filter((dato) => dato.valor > 0)

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

      <div className="relative w-full">
        <ChartContainer
          config={config}
          className="mx-auto aspect-auto w-full"
          style={{ height: altura }}
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="componente"
                  hideLabel
                  formatter={(value, name) => (
                    <span className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {config[name as keyof typeof config]?.label ?? name}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatearCOP(Number(value))} ·{" "}
                        {porcentaje(Number(value))}
                      </span>
                    </span>
                  )}
                />
              }
            />
            <Pie
              data={datos}
              dataKey="valor"
              nameKey="componente"
              innerRadius="58%"
              outerRadius="88%"
              strokeWidth={4}
            >
              {datos.map((dato) => (
                <Cell key={dato.componente} fill={dato.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="componente" />}
            />
          </PieChart>
        </ChartContainer>

        {/*
          El total va en un div superpuesto y no en un <Label> de recharts: el
          texto queda seleccionable, hereda las utilidades del tema y no depende
          de la API de la librería.
        */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 pb-10 text-center">
          <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
            Costo directo
          </span>
          <span className="font-mono text-base font-medium tabular-nums">
            {formatearCOP(costoDirecto)}
          </span>
          <span className="text-[0.65rem] text-muted-foreground">
            por {unidad}
          </span>
        </div>
      </div>
    </figure>
  )
}
