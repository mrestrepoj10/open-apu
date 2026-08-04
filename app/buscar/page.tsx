/**
 * `/buscar` — el catálogo interactivo: buscar, filtrar por capítulo y ordenar.
 *
 * Es el complemento de `/items`, no su reemplazo: aquel es la superficie sin
 * JavaScript (índice completo por capítulo, el que indexan los rastreadores);
 * este es la herramienta de consulta, y por eso va con `noindex` — su contenido
 * es el mismo catálogo, y dos URLs con el mismo texto compiten entre sí.
 *
 * ## El corte del shell
 *
 * `Page` no es `async` y no lee nada de la petición: el `<main>`, el título y
 * la advertencia de costo directo son el App Shell de la ruta, compartido por
 * `/buscar`, `/buscar?q=concreto` y `/buscar?cap=6`. Los datos —y con ellos la
 * isla que lee `searchParams`— viven bajo el `<Suspense>`, que es lo que exige
 * el prefetch parcial (`adopting-partial-prefetching.md`, «Auditing routes for
 * URL data»). Mismo corte que las rutas con `params`.
 *
 * El servidor entrega SIEMPRE las 526 filas —una sola carga cacheada,
 * `"use cache"` + vigencia— y el filtrado ocurre entero en el cliente: no hay
 * una petición por tecla. Las filas van adelgazadas a propósito (ver
 * `FilaBusqueda`).
 */
import type { Metadata } from "next"
import { cacheLife, cacheTag } from "next/cache"
import { Suspense } from "react"

import { Bloque, Esqueleto, EsqueletoTabla } from "@/app/_ui/esqueleto"
import { ProcedenciaBox } from "@/components/procedencia"
import { ETIQUETA_VIGENCIA, getCatalogo, VIGENCIA_ACTUAL } from "@/lib/data"
import { primeraLinea } from "../_ui/capitulos"
import { TablaBusqueda, type FilaBusqueda } from "./_components/tabla-busqueda"

export const metadata: Metadata = {
  title: "Buscar",
  description:
    "Buscador del catálogo de ítems de pago INVIAS: filtra por código, " +
    "descripción o capítulo y ordena por mediana nacional del costo directo " +
    `(vigencia ${VIGENCIA_ACTUAL}).`,
  // El índice canónico es `/items`; este es la misma lista en modo herramienta.
  robots: { index: false, follow: true },
}

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Buscar ítems</h1>
        <p className="text-pretty text-muted-foreground">
          Busca por código o descripción entre los ítems de pago del libro
          INVIAS {VIGENCIA_ACTUAL} y filtra por capítulo constructivo. El precio
          que se muestra es la mediana nacional del{" "}
          <strong className="font-medium">costo directo, sin AIU</strong>: es un
          valor de referencia, no un precio de mercado.
        </p>
      </header>

      <Suspense fallback={<EsqueletoBusqueda />}>
        <ResultadosBusqueda />
      </Suspense>
    </main>
  )
}

/**
 * Reserva mientras llega el catálogo: la fila de controles (input + select) y
 * la tabla, con las alturas reales para que nada salte al aparecer.
 */
function EsqueletoBusqueda() {
  return (
    <Esqueleto className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Bloque className="h-9 min-w-64 flex-1 rounded-3xl" />
        <Bloque className="h-9 w-48 rounded-3xl" />
      </div>
      <Bloque className="h-5 w-32" />
      <EsqueletoTabla filas={12} />
    </Esqueleto>
  )
}

/**
 * El catálogo, adelgazado a lo que la tabla usa y servido una sola vez.
 * Cacheado con la etiqueta de vigencia, como el resto de la capa de lectura.
 */
async function ResultadosBusqueda() {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const catalogo = await getCatalogo()

  const filas: FilaBusqueda[] = catalogo.items.map((item) => {
    const numero = item.capituloNumero ?? Number(item.capitulo[0])
    return {
      codigo: item.codigo,
      titulo: primeraLinea(item.descripcion),
      unidad: item.unidad,
      capitulo: numero,
      capituloNombre: item.capituloNombre ?? `Capítulo ${numero}`,
      mediana: item.costoDirecto.mediana,
      provinciasConDato: item.provinciasConDato,
    }
  })

  return (
    <div className="space-y-4">
      <TablaBusqueda filas={filas} provincias={catalogo.provincias} />
      <ProcedenciaBox procedencia={catalogo.procedencia} />
    </div>
  )
}
