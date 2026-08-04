"use client"

/**
 * Cabecera de columna que ordena, compartida por las tablas TanStack del sitio.
 *
 * Es un `<button>` nativo con las clases del `Button` fantasma de shadcn, no el
 * componente: `components/ui/button.tsx` envuelve `@base-ui/react/button` y
 * arrastra ~15 kB del núcleo de base-ui por botón de cabecera (medido en
 * `/buscar`, ver el encabezado de `tabla-busqueda.tsx`). Un botón nativo cuesta
 * cero y aquí no se necesita nada de lo que base-ui añade.
 *
 * El icono dice el estado actual (sin orden / ascendente / descendente) y el
 * `aria-label` lo dice en palabras.
 */
import type { Column } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function CabeceraOrdenable<TFila>({
  columna,
  etiqueta,
  className,
}: {
  columna: Column<TFila, unknown>
  etiqueta: string
  className?: string
}) {
  const sentido = columna.getIsSorted()
  const Icono =
    sentido === "asc"
      ? ArrowUpIcon
      : sentido === "desc"
        ? ArrowDownIcon
        : ArrowUpDownIcon

  return (
    <button
      type="button"
      className={cn(
        "-ml-3 inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-4xl border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-all outline-none select-none",
        "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:translate-y-px",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      onClick={() => columna.toggleSorting(sentido === "asc")}
      aria-label={`Ordenar por ${etiqueta}${
        sentido === "asc"
          ? " (ascendente)"
          : sentido === "desc"
            ? " (descendente)"
            : ""
      }`}
    >
      {etiqueta}
      <Icono className="text-muted-foreground" aria-hidden="true" />
    </button>
  )
}
