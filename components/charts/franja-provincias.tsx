"use client"

/**
 * Franja de las 140 provincias por mediana de costo directo: un punto por
 * provincia sobre un solo eje, con la provincia actual resaltada.
 *
 * Responde de un vistazo a "¿esta provincia es cara o barata?", que es la
 * pregunta que el hub no contestaba. Se elige una franja (strip plot) y no un
 * histograma porque cada punto sigue siendo una provincia navegable: se pasa el
 * cursor y dice cuál es, se pulsa y se va a ella.
 *
 * Igual que el resto de gráficos, la API es agnóstica de la librería: entran
 * puntos `{slug, provincia, departamento, mediana}` y el slug actual; recharts
 * no aparece en las props.
 *
 * Esto es solo la figura. La frase del puesto la renderiza el hub en el
 * servidor (`puesto()` vive en `comparar-capitulos.ts`): el gráfico se carga en
 * diferido (`ssr: false`), así que nada que deba existir sin JavaScript puede
 * vivir dentro de este componente.
 */
import { useRouter } from "next/navigation"
import { Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"

import type { PuntoFranja } from "@/app/provincias/[slug]/_components/comparar-capitulos"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatearCOP } from "@/lib/format"
import { cn } from "@/lib/utils"

export type { PuntoFranja }

export type FranjaProvinciasProps = {
  /** Las 140 provincias. */
  puntos: PuntoFranja[]
  slugActual: string
  /** Unidad, si la hubiera; se muestra como COP/<unidad> en el tooltip. */
  unidad?: string
  titulo?: string
  descripcion?: string
  className?: string
  altura?: number
}

const config = {
  otras: { label: "Otras provincias", color: "var(--chart-2)" },
  actual: { label: "Esta provincia", color: "var(--chart-4)" },
} satisfies ChartConfig

/** Área del símbolo en px² (recharts dimensiona por área, no por radio). */
const AREA_OTRAS = 50 // ≈ r 4
const AREA_ACTUAL = 150 // ≈ r 7

export function FranjaProvincias({
  puntos,
  slugActual,
  unidad,
  titulo,
  descripcion,
  className,
  altura = 96,
}: FranjaProvinciasProps) {
  const router = useRouter()

  // Todos los puntos comparten `y`: el eje vertical no codifica nada, solo
  // reparte los 140 sobre una línea.
  const validos = puntos
    .filter((punto) => punto.mediana > 0)
    .map((punto) => ({ ...punto, y: 0 }))

  const otras = validos.filter((punto) => punto.slug !== slugActual)
  const actual = validos.filter((punto) => punto.slug === slugActual)

  const irA = (punto: unknown) => {
    const slug = (punto as { payload?: PuntoFranja } | undefined)?.payload?.slug
    if (slug) router.push(`/provincias/${slug}`)
  }

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
        <ScatterChart margin={{ left: 12, right: 12, top: 12, bottom: 4 }}>
          <XAxis
            type="number"
            dataKey="mediana"
            domain={["dataMin", "dataMax"]}
            tickCount={4}
            tickFormatter={(valor: number) => formatearCOP(valor)}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
          />
          <YAxis type="number" dataKey="y" hide domain={[-1, 1]} />
          <ZAxis type="number" zAxisId={0} range={[AREA_OTRAS, AREA_OTRAS]} />
          <ZAxis type="number" zAxisId={1} range={[AREA_ACTUAL, AREA_ACTUAL]} />

          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const punto = payload[0]?.payload as PuntoFranja | undefined
              if (!punto) return null
              return (
                <div className="grid gap-0.5 rounded-xl bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10">
                  <span className="font-medium">
                    {punto.provincia}{" "}
                    <span className="text-muted-foreground">
                      ({punto.departamento})
                    </span>
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatearCOP(punto.mediana)}
                    {unidad ? `/${unidad}` : null}
                  </span>
                </div>
              )
            }}
          />

          <Scatter
            data={otras}
            zAxisId={0}
            fill="var(--color-otras)"
            fillOpacity={0.55}
            cursor="pointer"
            onClick={irA}
            isAnimationActive={false}
          />
          {/* La actual se dibuja después para que quede por encima del racimo. */}
          <Scatter
            data={actual}
            zAxisId={1}
            fill="var(--color-actual)"
            cursor="pointer"
            onClick={irA}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ChartContainer>
    </figure>
  )
}
