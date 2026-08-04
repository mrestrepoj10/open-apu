/**
 * Aviso con una aclaración del **libro fuente** sobre este ítem (campo
 * `notaFuente` de `items/{codigo}.json`).
 *
 * No es la advertencia general de costo directo —esa la pone
 * `<ProcedenciaBox />` en todas las superficies de precio— sino un defecto
 * declarado del dato original: p. ej. los ítems 801.1 y 801.2, donde INVIAS
 * publica líneas con un código de insumo que no existe en el listado regional y
 * que por tanto no suman al costo directo.
 *
 * Se muestra arriba y sin plegar a propósito: si el número que el usuario va a
 * copiar está incompleto, tiene que enterarse antes de copiarlo.
 */
import { cn } from "@/lib/utils"

export function NotaFuente({
  nota,
  className,
}: {
  nota: string
  className?: string
}) {
  return (
    <aside
      className={cn(
        "rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm",
        className
      )}
    >
      <p className="mb-0.5 font-medium">Aclaración de la fuente</p>
      <p className="text-pretty text-muted-foreground">{nota}</p>
    </aside>
  )
}
