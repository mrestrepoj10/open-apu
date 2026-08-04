/**
 * Cascarón de tabla de datos, **de servidor**.
 *
 * `components/ui/table.tsx` (shadcn) lleva `"use client"`: usarlo aquí
 * arrastraría al bundle e hidrataría las 140 filas de la tabla de provincias y
 * las ~10 de cada componente del desglose. Estas páginas son la carne SEO del
 * sitio y no necesitan una sola línea de JavaScript para mostrar sus números
 * (no negociable: los números viven en el HTML del servidor), así que la tabla
 * se escribe con `<table>` plano.
 *
 * El estilo va en variantes descendentes (`[&_td]:…`) sobre el `<table>` y no
 * en cada celda: una tabla de 140 × 8 con clases por celda añade decenas de kB
 * de atributos repetidos al HTML. Aquí el HTML de una celda es `<td>`.
 */
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

const BASE = [
  "w-full border-collapse text-left text-sm",
  "[&_thead]:bg-muted/50",
  "[&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:whitespace-nowrap",
  "[&_td]:px-3 [&_td]:py-2 [&_td]:align-middle",
  "[&_tbody_tr]:border-t [&_tbody_tr]:border-border/60",
  "[&_tbody_th]:border-t [&_tbody_th]:border-border/60 [&_tbody_th]:align-top",
  "[&_tfoot]:border-t-2 [&_tfoot]:border-border [&_tfoot]:bg-muted/40",
  "[&_tfoot_td]:font-medium [&_tfoot_th]:font-medium",
  "[&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-foreground",
]

/** Tabla dentro de un contenedor con borde y desplazamiento horizontal. */
export function Tabla({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border">
      <table className={cn(BASE, className)} {...props} />
    </div>
  )
}
