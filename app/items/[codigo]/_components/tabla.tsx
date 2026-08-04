/**
 * Cascarón de tabla de datos: contenedor con borde + `<table>` plano estilado
 * con variantes descendentes.
 *
 * Sin `"use client"`: lo importan tanto componentes de servidor como las islas
 * TanStack (tabla de provincias, desglose, hub de provincia), donde entra en
 * su bundle como un simple `<table>` estilado. No usa las primitivas `Table`
 * de shadcn porque aquí las filas necesitan `<tbody>` múltiples (grupos por
 * departamento con ancla) y celdas sin clases repetidas.
 *
 * El estilo va en variantes descendentes (`[&_td]:…`) sobre el `<table>` y no
 * en cada celda: una tabla de 140 × 8 con clases por celda añade decenas de kB
 * de atributos repetidos al HTML prerrenderizado. Aquí el HTML de una celda es
 * `<td>`.
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
