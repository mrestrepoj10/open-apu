/**
 * Límite de error del desglose.
 *
 * Es la única ruta del sitio con un fallo de ejecución plausible: las ~69 440
 * URLs de la cola larga se generan en la primera petición y esa generación
 * incluye una búsqueda puntual en `apu_lineas.parquet` con hyparquet (lectura
 * de archivo + descompresión). Las 4.909 páginas prerrenderizadas ya no
 * ejecutan nada; estas sí, y un fallo de E/S ahí no debe dejar la página en
 * blanco.
 *
 * `catchError` (16.3, `next/error`) en vez de `error.tsx`: el límite envuelve
 * solo la región suspendida, así que el marco de la página —y el App Shell que
 * el prefetch parcial ya entregó— siguen en pantalla. `retry()` vuelve a
 * ejecutar el render de servidor dentro de una transición, que es justo lo que
 * hace falta cuando el fallo fue transitorio; `notFound()` no se captura aquí
 * (Next lo trata aparte), así que un par ítem × provincia inexistente sigue
 * dando 404.
 */
"use client"

import { catchError, type ErrorInfo } from "next/error"

/**
 * En producción el mensaje del error de servidor no llega al cliente (Next lo
 * sustituye para no filtrar detalles); lo que sí llega es el `digest`, que es
 * lo que permite casarlo con el log del servidor. Se muestra si existe.
 */
function referencia(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "digest" in error) {
    const { digest } = error as { digest?: unknown }
    if (typeof digest === "string") return digest
  }
  return undefined
}

/** El límite no lleva props propias: `children` es lo único que recibe. */
function FalloDesglose(
  _props: Record<string, unknown>,
  { error, retry }: ErrorInfo
) {
  const ref = referencia(error)

  return (
    <section
      role="alert"
      className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-6"
    >
      <h1 className="text-xl font-semibold tracking-tight">
        No se pudo cargar el desglose
      </h1>
      <p className="max-w-2xl text-sm text-foreground/80">
        Este desglose no estaba generado y algo falló al leerlo de la fuente. El
        dato existe: es un fallo al servirlo, no un precio que falte.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
      >
        Reintentar
      </button>
      {ref ? (
        <p className="font-mono text-xs text-muted-foreground">
          Referencia: {ref}
        </p>
      ) : null}
    </section>
  )
}

export const LimiteDesglose = catchError(FalloDesglose)
