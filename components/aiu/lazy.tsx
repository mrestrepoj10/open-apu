"use client"

/**
 * Punto de entrada perezoso de la calculadora de AIU.
 *
 * Existe por la misma razón que `components/charts/lazy.tsx`: `ssr: false` no
 * está permitido con `next/dynamic` dentro de un Server Component
 * (`01-app/02-guides/lazy-loading.md`, «Skipping SSR»), así que el `dynamic()`
 * tiene que declararse en un módulo cliente delgado que las páginas RSC puedan
 * importar y renderizar con props serializables.
 *
 * Aquí `ssr: false` no es solo una optimización: la calculadora lee la URL y
 * las páginas que la alojan son ámbitos `"use cache"`. Sin SSR, el ámbito
 * cacheado nunca ve una API de petición, y el HTML estático conserva el costo
 * directo con su procedencia en vez de un precio con AIU. Ver la cabecera de
 * `calculadora.tsx`.
 *
 * El chunk se lleva también recharts (la curva de sensibilidad vive dentro de
 * la calculadora): es JavaScript que solo paga quien baja hasta la herramienta.
 */
import dynamic from "next/dynamic"

/** Reserva del alto real de la calculadora para no mover el layout (CLS). */
function EsqueletoCalculadora() {
  return (
    <div className="space-y-4" role="presentation">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="h-56 animate-pulse rounded-lg bg-muted/50" />
        <div className="h-56 animate-pulse rounded-lg bg-muted/50" />
      </div>
      <div className="h-72 animate-pulse rounded-lg bg-muted/50" />
    </div>
  )
}

export const CalculadoraAiuLazy = dynamic(
  () => import("./calculadora").then((mod) => mod.CalculadoraAiu),
  {
    ssr: false,
    loading: () => <EsqueletoCalculadora />,
  }
)

export type { CalculadoraAiuProps } from "./calculadora"
