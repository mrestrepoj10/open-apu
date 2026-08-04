"use client"

/**
 * Curva nacional de precios: una barra por provincia con dato, ordenadas de la
 * más barata a la más cara, con la mediana nacional como línea de referencia.
 *
 * Igual que `PrecioBar` y `DesgloseDonut`, la API no expone recharts: entran
 * puntos planos (`PuntoCurva`) y una función `href`, y sale un gráfico. La
 * librería es un detalle de implementación y se puede cambiar sin tocar las
 * páginas.
 *
 * A diferencia de `PrecioBar` —que crece 28 px por barra y por eso solo admite
 * una veintena— aquí el alto es fijo (~300 px) y las barras se estrechan: con
 * 140 provincias lo que se lee es la dispersión, no cada etiqueta. Por eso el
 * eje X no dibuja rótulos; el nombre de la provincia aparece en el tooltip.
 *
 * Accesibilidad: la figura se anuncia como imagen (`role="img"`) y no expone
 * una parada de tabulación por barra. No es la única vía al dato: la página del
 * ítem lleva encima la tabla completa de las 140 provincias, con sus enlaces al
 * desglose, que es la ruta accesible y sin JavaScript. Este gráfico es una
 * vista duplicada.
 *
 * No lleva `Card` ni procedencia: la página compone el contenedor y pone
 * `<ProcedenciaBox />`, obligatoria en toda superficie de precio.
 */
import { useRouter } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { formatearCOP } from "@/lib/format"
import { cn } from "@/lib/utils"

export type PuntoCurva = {
  slug: string
  provincia: string
  departamento: string
  /** Costo directo en COP; siempre > 0 (las provincias sin dato no entran). */
  valor: number
}

export type CurvaPreciosProps = {
  /** Provincias con dato, YA ordenadas ascendente por valor. */
  datos: PuntoCurva[]
  /** Unidad de la obra analizada, p. ej. "m3". Se muestra como COP/<unidad>. */
  unidad: string
  /** Mediana nacional — se dibuja como línea de referencia. */
  mediana: number
  /** Al hacer clic en una barra se navega aquí. */
  href?: (punto: PuntoCurva) => string
  titulo?: string
  descripcion?: string
  className?: string
  altura?: number
}

const config = {
  valor: { label: "Costo directo", color: "var(--chart-1)" },
} satisfies ChartConfig

/** Color de los extremos (la más barata y la más cara) y de la mediana. */
const COLOR_EXTREMO = "var(--chart-4)"

export function CurvaPrecios({
  datos,
  unidad,
  mediana,
  href,
  titulo,
  descripcion,
  className,
  altura = 300,
}: CurvaPreciosProps) {
  const router = useRouter()
  const ultimo = datos.length - 1

  return (
    <figure
      className={cn("w-full", className)}
      role="img"
      aria-label={titulo ?? "Curva de precios por provincia"}
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
        <BarChart
          data={datos}
          margin={{ left: 4, right: 12, top: 12, bottom: 4 }}
          barCategoryGap={1}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="provincia"
            type="category"
            tick={false}
            tickLine={false}
            height={12}
          />
          <YAxis
            type="number"
            dataKey="valor"
            width={80}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            tickFormatter={(valor: number) => formatearCOP(valor)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                hideIndicator
                formatter={(value, _nombre, item) => {
                  const punto = item.payload as PuntoCurva
                  return (
                    <span className="grid w-full gap-0.5">
                      <span className="font-medium">
                        {punto.provincia}{" "}
                        <span className="text-muted-foreground">
                          ({punto.departamento})
                        </span>
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatearCOP(Number(value))}/{unidad}
                      </span>
                    </span>
                  )
                }}
              />
            }
          />
          <Bar
            dataKey="valor"
            radius={2}
            className={href ? "cursor-pointer" : undefined}
            onClick={
              href
                ? (data) => {
                    const punto = data.payload as PuntoCurva | undefined
                    if (punto) router.push(href(punto))
                  }
                : undefined
            }
          >
            {datos.map((punto, i) => (
              <Cell
                key={punto.slug}
                fill={
                  i === 0 || i === ultimo ? COLOR_EXTREMO : "var(--color-valor)"
                }
              />
            ))}
          </Bar>
          <ReferenceLine
            y={mediana}
            stroke={COLOR_EXTREMO}
            strokeDasharray="4 4"
            label={{
              value: "mediana nacional",
              position: "insideTopRight",
              className: "fill-muted-foreground text-xs",
            }}
          />
        </BarChart>
      </ChartContainer>
    </figure>
  )
}
