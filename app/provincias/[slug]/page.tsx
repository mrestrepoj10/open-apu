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
  mapaDeCapitulos,
  NavCapitulos,
} from "../../_ui/capitulos"
import { listarProvincias } from "../../_ui/regiones"
import { compararCapitulos, puesto } from "./_components/comparar-capitulos"
import {
  TablaItemsProvincia,
  type FilaItemProvincia,
} from "./_components/tabla-items"

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

  // Cruzan al cliente: 140 puntos de cuatro campos cortos (≈ 9 kB), la decena
  // de filas de la comparación y las 526 filas adelgazadas de la tabla
  // interactiva (ver `filasDeCapitulos`).
  const puntos = provincias.map((provincia) => ({
    slug: provincia.region.slug,
    provincia: provincia.region.provincia,
    departamento: provincia.region.departamento,
    mediana: provincia.mediana,
  }))
  const capitulosComparados = compararCapitulos(resumen.items, catalogo)
  // El puesto se calcula aquí, no dentro de la franja: el gráfico se carga en
  // diferido y sin JavaScript no existe, así que la cifra tiene que salir del
  // servidor en HTML plano.
  const posicion = puesto(puntos, slug)

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

      {posicion ? (
        <section aria-label="Posición nacional" className="space-y-2">
          <h2 className="text-lg font-medium">
            Posición entre las 140 provincias
          </h2>
          <p className="text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">
              {region.provincia}: puesto {posicion.puesto} de {posicion.total}
            </strong>{" "}
            por mediana del costo directo (de más barata a más cara).
          </p>
          <FranjaProvinciasLazy
            puntos={puntos}
            slugActual={slug}
            descripcion="Un punto por provincia, ordenadas por su mediana. Pasa el cursor para ver cuál es; pulsa para ir a ella. Costo directo de referencia, sin AIU."
          />
        </section>
      ) : null}

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

      <TablaItemsProvincia
        filas={filasDeCapitulos(capitulos)}
        slug={slug}
        provincia={region.provincia}
      />

      <ProcedenciaBox procedencia={resumen.procedencia} />
    </>
  )
}

/**
 * Filas adelgazadas para la isla de la tabla, en el orden agrupado (capítulo →
 * catálogo), que es el orden del estado inicial de la isla. Seis campos cortos
 * por fila: son 526 y cruzan la frontera servidor→cliente en el payload RSC,
 * igual que las de `/buscar`, así que cada campo de más se paga 526 veces.
 */
function filasDeCapitulos(
  capitulos: ReadonlyArray<{
    numero: number
    nombre: string
    items: ProvinciaItem[]
  }>
): FilaItemProvincia[] {
  return capitulos.flatMap((capitulo) =>
    capitulo.items.map((item) => ({
      codigo: item.codigo,
      titulo: item.titulo,
      unidad: item.unidad,
      capituloNumero: capitulo.numero,
      capituloNombre: capitulo.nombre,
      costoDirecto: item.costoDirecto,
    }))
  )
}
