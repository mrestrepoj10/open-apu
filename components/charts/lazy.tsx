"use client"

/**
 * Puntos de entrada perezosos para los gráficos.
 *
 * Recharts es el JavaScript más pesado del sitio. Estos envoltorios lo sacan
 * del bundle inicial de la ruta: el HTML llega primero, el gráfico hidrata
 * después sobre su esqueleto. Los gráficos pueden ir donde mejor cuenten la
 * historia — arriba o abajo del pliegue — mientras el dato clave esté también
 * en el HTML del servidor.
 *
 * Por qué este archivo lleva "use client" aunque solo re-exporte: `ssr: false`
 * NO está permitido con `next/dynamic` dentro de un Server Component
 * (node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md, «Skipping
 * SSR»: «`ssr: false` option is not supported in Server Components. You will
 * see an error if you try to use it in Server Components. […] move it into a
 * Client Component»). El patrón estándar es exactamente este: un módulo
 * cliente delgado que declara los `dynamic()` y que las páginas RSC pueden
 * importar y renderizar pasándole props serializables.
 *
 * Uso desde una página (Server Component):
 *
 * ```tsx
 * import { PrecioBarLazy } from "@/components/charts/lazy"
 * <PrecioBarLazy datos={datos} unidad="m3" />
 * ```
 *
 * Los gráficos así cargados NO existen en el HTML estático. Para superficies
 * que deban verse sin JavaScript (o sobre el pliegue), importa los componentes
 * directamente desde `@/components/charts/precio-bar` y
 * `@/components/charts/desglose-donut`: se prerenderizan como SVG.
 */
import dynamic from "next/dynamic"

import { cn } from "@/lib/utils"

/** Marcador del mismo alto que el gráfico para no mover el layout (CLS). */
function EsqueletoGrafico({
  altura,
  className,
}: {
  altura: number
  className?: string
}) {
  return (
    <div
      role="presentation"
      className={cn("w-full animate-pulse rounded-lg bg-muted/50", className)}
      style={{ height: altura }}
    />
  )
}

export const PrecioBarLazy = dynamic(
  () => import("./precio-bar").then((mod) => mod.PrecioBar),
  {
    ssr: false,
    loading: () => <EsqueletoGrafico altura={240} />,
  }
)

export const DesgloseDonutLazy = dynamic(
  () => import("./desglose-donut").then((mod) => mod.DesgloseDonut),
  {
    ssr: false,
    loading: () => <EsqueletoGrafico altura={240} />,
  }
)

export type { DatoBarra, PrecioBarProps } from "./precio-bar"
export type { DesgloseDonutProps } from "./desglose-donut"
