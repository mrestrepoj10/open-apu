/**
 * Bloques de reserva para los `<Suspense>` de las rutas con parámetro.
 *
 * Con prefetch parcial el App Shell de una ruta es compartido por todos sus
 * enlaces, así que lo que dependa de `params` vive detrás de un límite de
 * suspensión y estos bloques son lo que se pinta mientras llega. Dos reglas:
 *
 * - **Sin CLS**: cada bloque ocupa la altura del contenido real que sustituye
 *   (`h-*` fijos, mismo `space-y-*` que la sección), para que el contenido no
 *   empuje la página al aparecer.
 * - **Sin texto ni cifras**: un esqueleto no debe poder confundirse con un
 *   dato. Nada de «$ 0» ni de nombres de provincia de mentira (no negociable
 *   1: todo número que se vea lleva procedencia).
 *
 * Solo Tailwind, sin dependencias nuevas. `aria-hidden` + `animate-pulse` en
 * el contenedor: para un lector de pantalla esto no existe, la región viva la
 * anuncia el contenido cuando llega.
 */
import { cn } from "@/lib/utils"

/** Rectángulo apagado. `className` fija el alto y el ancho. */
export function Bloque({ className }: { className?: string }) {
  return <div className={cn("rounded bg-muted", className)} />
}

/** Envoltorio común: latido suave e invisible para tecnologías de apoyo. */
export function Esqueleto({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div aria-hidden="true" className={cn("animate-pulse", className)}>
      {children}
    </div>
  )
}

/** Cabecera: migas, insignias, título y una o dos líneas de descripción. */
export function EsqueletoCabecera() {
  return (
    <div className="space-y-3">
      <Bloque className="h-3 w-32" />
      <div className="flex flex-wrap gap-2">
        <Bloque className="h-5 w-20" />
        <Bloque className="h-5 w-44" />
        <Bloque className="h-5 w-24" />
      </div>
      <Bloque className="h-9 w-2/3 max-w-xl" />
      <Bloque className="h-4 w-full max-w-3xl" />
      <Bloque className="h-4 w-1/2 max-w-md" />
    </div>
  )
}

/** Banda de agregados: cuatro tarjetas con etiqueta y cifra. */
export function EsqueletoCifras({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-3">
          <Bloque className="h-3 w-24" />
          <Bloque className="h-7 w-32" />
        </div>
      ))}
    </div>
  )
}

/** Tabla: encabezado y `filas` renglones dentro del contenedor con borde. */
export function EsqueletoTabla({ filas = 8 }: { filas?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border">
      <div className="h-9 bg-muted/50" />
      <div className="divide-y divide-border/60">
        {Array.from({ length: filas }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <Bloque className="h-4 flex-1" />
            <Bloque className="h-4 w-24" />
            <Bloque className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
