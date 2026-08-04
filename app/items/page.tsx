import type { Metadata } from "next"
import { cacheLife, cacheTag } from "next/cache"

import { ProcedenciaBox } from "@/components/procedencia"
import { ETIQUETA_VIGENCIA, getCatalogo, VIGENCIA_ACTUAL } from "@/lib/data"
import { formatearCOP, formatearNumero } from "@/lib/format"
import type { CatalogoItem } from "@/lib/schema"
import {
  agruparPorCapitulo,
  idCapitulo,
  NavCapitulos,
  primeraLinea,
} from "../_ui/capitulos"

export const metadata: Metadata = {
  title: "Ítems",
  description:
    "Catálogo de ítems de pago INVIAS por capítulo constructivo, con unidad " +
    `y mediana nacional del costo directo (vigencia ${VIGENCIA_ACTUAL}).`,
  alternates: { canonical: "/items" },
}

/**
 * Catálogo: los 526 ítems de pago, partidos por capítulo del ÍNDICE.
 *
 * Es, a propósito, la superficie sin JavaScript del sitio: HTML puro para que
 * Ctrl+F, el modo lector y los rastreadores funcionen sin hidratar nada. Su
 * gemelo interactivo es `/buscar` (mismo catálogo con búsqueda, filtro y orden
 * sobre TanStack, `noindex`): por eso aquí no se monta otra tabla interactiva
 * —sería la misma isla dos veces— y en su lugar la cabecera enlaza al buscador.
 *
 * Los 526 enlaces siguen siendo `<a>` planos, y ya no por el costo: con
 * `partialPrefetching` un `Link` no pesa (el módulo cliente se serializa una
 * vez) y precarga el App Shell de la ruta, no 526 destinos. Se quedan en `<a>`
 * porque esta página es el índice que indexan los rastreadores y el que se lee
 * en modo lector, y navegar aquí es una decisión, no un roce.
 *
 * Los estilos de celda van en la clase de la `<table>` con selectores
 * `[&_td:nth-child(n)]`, no repetidos en cada `<td>`: sobre 526 filas eso son
 * decenas de kB de HTML (y de payload) que no se pagan.
 */
export default async function Page() {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const catalogo = await getCatalogo()

  const capitulos = agruparPorCapitulo(catalogo.items, (item) => ({
    numero: item.capituloNumero ?? Number(item.capitulo[0]),
    nombre: item.capituloNombre ?? `Capítulo ${item.capitulo[0]}`,
  }))

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Catálogo de ítems
        </h1>
        <p className="text-pretty text-muted-foreground">
          Los {formatearNumero(catalogo.items.length)} ítems de pago del libro
          INVIAS {catalogo.vigencia}, agrupados en los {capitulos.length}{" "}
          capítulos del ÍNDICE. La mediana es nacional: resume el costo directo
          del ítem sobre las {formatearNumero(catalogo.provincias)} provincias
          con dato.
        </p>
        <p className="text-sm text-muted-foreground">
          ¿Buscas un ítem concreto? En el{" "}
          <a href="/buscar" className="underline underline-offset-4">
            buscador
          </a>{" "}
          este mismo catálogo se filtra por texto o capítulo y se ordena por
          mediana.
        </p>
      </header>

      <NavCapitulos capitulos={capitulos} />

      {capitulos.map((capitulo) => (
        <section
          key={capitulo.numero}
          id={idCapitulo(capitulo.numero)}
          className="scroll-mt-16 space-y-2"
        >
          <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
            <span className="font-mono text-muted-foreground">
              {capitulo.numero}
            </span>
            {capitulo.nombre}
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              {formatearNumero(capitulo.items.length)} ítems
            </span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse text-sm [&_a]:underline [&_a]:underline-offset-4 [&_td]:border-t [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_td:nth-child(1)]:font-mono [&_td:nth-child(1)]:whitespace-nowrap [&_td:nth-child(4)]:text-right [&_td:nth-child(4)]:tabular-nums [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground [&_th:nth-child(4)]:text-right">
              <caption className="sr-only">
                Ítems del capítulo {capitulo.numero} — {capitulo.nombre}. Costo
                directo de referencia, sin AIU.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Ítem</th>
                  <th scope="col">Unidad</th>
                  <th scope="col">Mediana nacional</th>
                </tr>
              </thead>
              <tbody>
                {capitulo.items.map((item) => (
                  <Fila
                    key={item.codigo}
                    item={item}
                    provincias={catalogo.provincias}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <ProcedenciaBox procedencia={catalogo.procedencia} />
    </main>
  )
}

/**
 * Una fila del catálogo. Es un componente de servidor: sus props no viajan al
 * cliente (lo que se serializa es su salida), así que separarlo no cuesta nada.
 *
 * Las celdas van sin `className`: los estilos están en la clase de la `<table>`
 * (`[&_td:nth-child(n)]`, `[&_a]`). Cada clase repetida en una fila se paga dos
 * veces —en el HTML y otra vez en el payload RSC— y aquí hay 526 filas.
 */
function Fila({
  item,
  provincias,
}: {
  item: CatalogoItem
  provincias: number
}) {
  const parcial = item.provinciasConDato < provincias

  return (
    <tr>
      <td>
        <a href={`/items/${item.codigo}`}>{item.codigo}</a>
      </td>
      <td>{primeraLinea(item.descripcion)}</td>
      <td>{item.unidad}</td>
      <td>
        {formatearCOP(item.costoDirecto.mediana)}
        {parcial ? (
          <span className="block text-xs font-normal text-muted-foreground">
            no aplica en todas: {formatearNumero(item.provinciasConDato)}{" "}
            provincias con dato
          </span>
        ) : null}
      </td>
    </tr>
  )
}
