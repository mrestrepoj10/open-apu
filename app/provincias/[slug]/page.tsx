import type { Metadata } from "next"
import { cacheLife, cacheTag } from "next/cache"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import {
  Bloque,
  Esqueleto,
  EsqueletoCabecera,
  EsqueletoCifras,
  EsqueletoTabla,
} from "@/app/_ui/esqueleto"
import {
  CapitulosBarrasLazy,
  FranjaProvinciasLazy,
} from "@/components/charts/lazy"
import { ProcedenciaBox } from "@/components/procedencia"
import {
  ETIQUETA_VIGENCIA,
  getCatalogo,
  getProvincia,
  getTodosLosSlugs,
  VIGENCIA_ACTUAL,
} from "@/lib/data"
import { formatearCOP, formatearNumero } from "@/lib/format"
import type { ProvinciaItem } from "@/lib/schema"
import {
  agruparPorCapitulo,
  idCapitulo,
  mapaDeCapitulos,
  NavCapitulos,
} from "../../_ui/capitulos"
import { listarProvincias } from "../../_ui/regiones"
import { compararCapitulos } from "./_components/comparar-capitulos"

type Props = {
  params: Promise<{ slug: string }>
}

/**
 * Las 140 provincias se prerrenderizan todas: son 140 archivos estáticos y
 * caben de sobra en el build.
 *
 * No se declara `dynamicParams`: con `cacheComponents` el build rechaza esa
 * configuración de segmento ("Route segment config `dynamicParams` is not
 * compatible with `nextConfig.cacheComponents`"). La ruta siempre lleva un
 * shell de reserva, así que un slug fuera de la lista se resuelve en petición
 * y termina en el `notFound()` de `Contenido`. Por eso la tabla de rutas la
 * marca ◐ (Partial Prerender) aunque las 140 páginas concretas salgan
 * completas del build.
 */
export async function generateStaticParams() {
  const slugs = await getTodosLosSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const resumen = await getProvincia(slug)
  if (!resumen) return {}

  const { region } = resumen
  return {
    title: `Provincia ${region.provincia} (${region.departamento}) — precios de referencia INVIAS ${VIGENCIA_ACTUAL}`,
    description:
      `Costo directo de referencia de ${formatearNumero(resumen.items.length)} ` +
      `ítems de pago en ${region.provincia}, ${region.departamento}. ` +
      `INVIAS ${resumen.vigencia}, sin AIU.`,
    alternates: { canonical: `/provincias/${slug}` },
  }
}

/**
 * Hub de provincia. El contenido se delega a un componente de servidor
 * cacheado (leer parámetros de ruta es una API de petición y no puede vivir
 * dentro del ámbito cacheado), que es lo que permite prerrenderizar las 140
 * páginas.
 *
 * `Page` no es `async` y no resuelve `params`: con prefetch parcial el App
 * Shell de la ruta se comparte entre las 140 provincias, y leer la URL por
 * encima del `<Suspense>` lo ataría a una sola
 * (`adopting-partial-prefetching.md`, «Auditing routes for URL data»). El
 * `<main>` con su rejilla se queda en el shell.
 */
export default function Page({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <Suspense fallback={<EsqueletoProvincia />}>
        <ProvinciaDeParams params={params} />
      </Suspense>
    </main>
  )
}

/** Único punto de la ruta que resuelve la URL, ya dentro del `<Suspense>`. */
async function ProvinciaDeParams({ params }: Props) {
  const { slug } = await params
  return <Contenido slug={slug} />
}

/** Reserva: cabecera, banda de agregados, fichas de capítulo y una tabla. */
function EsqueletoProvincia() {
  return (
    <Esqueleto className="space-y-8">
      <EsqueletoCabecera />
      <EsqueletoCifras />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Bloque key={i} className="h-7 w-40 rounded-full" />
        ))}
      </div>
      <div className="space-y-2">
        <Bloque className="h-6 w-72" />
        <EsqueletoTabla filas={14} />
      </div>
    </Esqueleto>
  )
}

async function Contenido({ slug }: { slug: string }) {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const [resumen, catalogo, provincias] = await Promise.all([
    getProvincia(slug),
    getCatalogo(),
    listarProvincias(),
  ])
  if (!resumen) notFound()

  const { region, agregados } = resumen
  // El artefacto de provincia solo trae el capítulo de 3 dígitos; el capítulo
  // constructivo (nombre y número del ÍNDICE) se traduce con el catálogo.
  const capitulosPorCodigo = mapaDeCapitulos(catalogo)
  const capitulos = agruparPorCapitulo(
    resumen.items,
    (item) =>
      capitulosPorCodigo.get(item.capitulo) ?? {
        numero: Number(item.capitulo[0]),
        nombre: `Capítulo ${item.capitulo[0]}`,
      }
  )

  // Lo único que cruza al cliente: 140 puntos de cuatro campos cortos (≈ 9 kB)
  // y la decena de filas de la comparación. Los 526 ítems se quedan aquí.
  const puntos = provincias.map((provincia) => ({
    slug: provincia.region.slug,
    provincia: provincia.region.provincia,
    departamento: provincia.region.departamento,
    mediana: provincia.mediana,
  }))
  const capitulosComparados = compararCapitulos(resumen.items, catalogo)

  const cifras = [
    { etiqueta: "Mediana", valor: agregados.mediana },
    { etiqueta: "Mínimo", valor: agregados.min },
    { etiqueta: "Máximo", valor: agregados.max },
    { etiqueta: "Promedio", valor: agregados.promedio },
  ]

  return (
    <>
      <header className="space-y-3">
        <p className="text-xs text-muted-foreground">
          <Link href="/provincias" className="underline underline-offset-4">
            Provincias
          </Link>{" "}
          / {region.departamento}
        </p>
        {/*
          El departamento va en el h1: media docena de provincias se llaman
          "Norte", "Sur" u "Oriente" y solas no dicen nada — ni en la página ni
          en un resultado de búsqueda.
        */}
        <h1 className="text-3xl font-semibold tracking-tight">
          {region.provincia}
          <span className="font-normal text-muted-foreground">
            , {region.departamento}
          </span>
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            Código INVIAS{" "}
            <span className="font-mono text-foreground/80">
              {region.codigo}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            DANE{" "}
            <span className="font-mono text-foreground/80">
              {region.codigoDane}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {formatearNumero(resumen.itemsConDato)} de{" "}
            {formatearNumero(resumen.items.length)} ítems con dato
          </span>
        </p>
      </header>

      <section aria-label="Agregados de la provincia">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
          {cifras.map((cifra) => (
            <div key={cifra.etiqueta} className="bg-background p-4">
              <dt className="text-xs text-muted-foreground">
                {cifra.etiqueta}
              </dt>
              <dd className="text-xl font-semibold tabular-nums">
                {formatearCOP(cifra.valor)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Agregados del costo directo de los{" "}
          {formatearNumero(resumen.items.length)} ítems en esta provincia,
          calculados sobre los que tienen dato. Sin AIU.
        </p>
      </section>

      <section aria-label="Posición nacional" className="space-y-2">
        <h2 className="text-lg font-medium">
          Posición entre las 140 provincias
        </h2>
        <FranjaProvinciasLazy
          puntos={puntos}
          slugActual={slug}
          descripcion="Un punto por provincia, ordenadas por su mediana. Pasa el cursor para ver cuál es; pulsa para ir a ella. Costo directo de referencia, sin AIU."
        />
      </section>

      <section
        aria-label="Capítulos frente a la mediana nacional"
        className="space-y-2"
      >
        <h2 className="text-lg font-medium">
          Capítulos frente a la mediana nacional
        </h2>
        <CapitulosBarrasLazy
          capitulos={capitulosComparados}
          descripcion="La mediana de cada capítulo aquí, contra la mediana nacional de los mismos ítems. Costo directo de referencia, sin AIU."
        />
      </section>

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
            <table className="w-full min-w-2xl border-collapse text-sm [&_a]:underline [&_a]:underline-offset-4 [&_td]:border-t [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_td_span]:text-muted-foreground [&_td:nth-child(1)]:font-mono [&_td:nth-child(1)]:whitespace-nowrap [&_td:nth-child(4)]:text-right [&_td:nth-child(4)]:tabular-nums [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground [&_th:nth-child(4)]:text-right">
              <caption className="sr-only">
                Ítems del capítulo {capitulo.numero} — {capitulo.nombre} en{" "}
                {region.provincia}. Costo directo de referencia, sin AIU.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Ítem</th>
                  <th scope="col">Unidad</th>
                  <th scope="col">Costo directo</th>
                </tr>
              </thead>
              <tbody>
                {capitulo.items.map((item) => (
                  <Fila key={item.codigo} item={item} slug={slug} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <ProcedenciaBox procedencia={resumen.procedencia} />
    </>
  )
}

/**
 * Una fila del hub: el código lleva al desglose del ítem EN esta provincia y el
 * título al ítem en las 140 (dos destinos distintos, sin columna extra).
 *
 * Los dos son `next/link`. Son ~1.050 enlaces por página y no cuestan payload
 * —el módulo cliente de `Link` se serializa una vez, la conversión midió ≈ 0
 * bytes gzip— y con `partialPrefetching` el prefetch es por ruta: los 1.050
 * apuntan a dos rutas y traen dos App Shells compartidos, no 1.050 destinos.
 *
 * Un costo directo de 0 significa "el ítem no aplica en esta región"
 * (FORMATO.md §6.5), nunca "cuesta cero": se rotula, no se formatea como precio.
 *
 * Sin `className` en las celdas: los estilos viven en la clase de la `<table>`.
 * Con 526 filas, cada clase repetida se paga dos veces (HTML + payload RSC).
 */
function Fila({ item, slug }: { item: ProvinciaItem; slug: string }) {
  return (
    <tr>
      <td>
        <Link href={`/items/${item.codigo}/${slug}`}>{item.codigo}</Link>
      </td>
      <td>
        <Link href={`/items/${item.codigo}`}>{item.titulo}</Link>
      </td>
      <td>{item.unidad}</td>
      <td>
        {item.costoDirecto > 0 ? (
          formatearCOP(item.costoDirecto)
        ) : (
          <span>No aplica</span>
        )}
      </td>
    </tr>
  )
}
