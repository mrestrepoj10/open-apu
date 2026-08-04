/**
 * `/items/{codigo}` — un ítem de pago INVIAS y su precio en las 140 provincias.
 *
 * Es una de las dos rutas de contenido del explorador (la otra es el desglose)
 * y la que se quiere que indexen los buscadores: 526 páginas, una por ítem,
 * todas prerrenderizadas.
 *
 * ## Orden del contenido
 *
 * Cabecera → agregados nacionales → mapa (SVG de servidor) → tabla de las 140
 * provincias → gráfico (isla perezosa) → procedencia. Los números están en el
 * HTML del servidor antes de que exista una sola línea de JavaScript: el
 * gráfico es una mejora bajo el pliegue, nunca el soporte del dato.
 *
 * ## Caché, prerender y App Shell
 *
 * `generateStaticParams` devuelve los 526 códigos. El contenido vive en
 * `<ContenidoItem>`, con `"use cache"` + `cacheLife("max")` + la etiqueta de
 * vigencia: el `await params` (dato de petición, no cacheable) queda fuera del
 * ámbito cacheado y el contenido, que solo depende del código, queda dentro.
 *
 * Con prefetch parcial ese corte además tiene que estar **debajo de un
 * `<Suspense>`**: el App Shell de la ruta se comparte entre los 526 códigos,
 * así que leer `params` por encima del límite lo ataría a una sola URL y
 * anularía el shell (`adopting-partial-prefetching.md`, «Auditing routes for
 * URL data»). Por eso `Page` no es `async`: pasa el `Promise` de `params` hacia
 * abajo sin resolverlo y deja en el shell el `<main>` con su rejilla.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cacheLife, cacheTag } from "next/cache"
import { Suspense } from "react"

import { PrecioBarLazy } from "@/components/charts/lazy"
import { ColombiaTileMap } from "@/components/map/colombia-tile-map"
import { ProcedenciaBox } from "@/components/procedencia"
import { Badge } from "@/components/ui/badge"
import { ETIQUETA_VIGENCIA, getItem, getTodosLosCodigos } from "@/lib/data"
import { formatearNumero } from "@/lib/format"
import { NOTA_COSTO_DIRECTO, type ItemRegional } from "@/lib/schema"

import {
  Bloque,
  Esqueleto,
  EsqueletoCabecera,
  EsqueletoCifras,
  EsqueletoTabla,
} from "@/app/_ui/esqueleto"

import { alcance, formatearPrecio, tituloCorto } from "./_components/formato"
import { DatasetJsonLd } from "./_components/jsonld"
import { NotaFuente } from "./_components/nota-fuente"
import { TablaProvincias } from "./_components/tabla-provincias"

/** Los 526 ítems del catálogo se prerrenderizan en el build. */
export async function generateStaticParams() {
  const codigos = await getTodosLosCodigos()
  return codigos.map((codigo) => ({ codigo }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>
}): Promise<Metadata> {
  const { codigo } = await params
  return metadatosDeItem(codigo)
}

/**
 * Cacheada y con el código como argumento simple: `generateMetadata` puede
 * leer `params` (dato de petición) y delegar aquí sin volver dinámica la ruta.
 */
async function metadatosDeItem(codigo: string): Promise<Metadata> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const item = await getItem(codigo)
  if (!item) return { title: "Ítem no encontrado · Explorador APU" }

  const titulo = tituloCorto(item.descripcion)
  const { vigencia } = item.procedencia

  return {
    title: `${item.codigo} ${titulo} — precio de referencia INVIAS ${vigencia}`,
    description:
      `Costo directo de referencia de ${item.codigo} (${titulo}) en ` +
      `${item.provinciasConDato} provincias de Colombia. Mediana nacional ` +
      `${formatearPrecio(item.agregados.mediana)}/${item.unidad}. ` +
      `Fuente INVIAS, vigencia ${vigencia}. Sin AIU, no es un precio de mercado.`,
  }
}

export default function Page({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <Suspense fallback={<EsqueletoItem />}>
        <ItemDeParams params={params} />
      </Suspense>
    </main>
  )
}

/** Único punto de la ruta que resuelve la URL, ya dentro del `<Suspense>`. */
async function ItemDeParams({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  return <ContenidoItem codigo={codigo} />
}

/**
 * Reserva mientras se resuelve el código: la forma de la página (cabecera,
 * agregados, mapa y tabla) sin una sola cifra inventada.
 */
function EsqueletoItem() {
  return (
    <Esqueleto className="flex flex-col gap-8">
      <EsqueletoCabecera />
      <EsqueletoCifras />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Bloque className="h-6 w-56" />
          <Bloque className="h-64 max-w-[18rem]" />
        </div>
        <div className="space-y-2">
          <Bloque className="h-6 w-64" />
          <EsqueletoTabla filas={12} />
        </div>
      </div>
    </Esqueleto>
  )
}

async function ContenidoItem({ codigo }: { codigo: string }) {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const item = await getItem(codigo)
  if (!item) notFound()

  const titulo = tituloCorto(item.descripcion)
  const detalle = alcance(item.descripcion)
  const sinDato = item.regiones.length - item.provinciasConDato

  return (
    <>
      <DatasetJsonLd
        procedencia={item.procedencia}
        datos={{
          name: `${item.codigo} — ${titulo} (APU INVIAS ${item.vigencia})`,
          description:
            `Costo directo de referencia del ítem de pago INVIAS ` +
            `${item.codigo} (${titulo}), unidad ${item.unidad}, en ` +
            `${item.provinciasConDato} provincias de Colombia. ` +
            NOTA_COSTO_DIRECTO,
          keywords: [
            "APU",
            "análisis de precios unitarios",
            "INVIAS",
            "costo directo",
            "precios de referencia",
            "Colombia",
            item.codigo,
            `capítulo ${item.capitulo}`,
            titulo,
          ],
          spatialCoverage: { "@type": "Country", name: "Colombia" },
          variableMeasured: {
            "@type": "PropertyValue",
            name: "Costo directo de referencia (mediana nacional)",
            value: item.agregados.mediana,
            minValue: item.agregados.min,
            maxValue: item.agregados.max,
            unitText: `COP/${item.unidad}`,
            description: NOTA_COSTO_DIRECTO,
          },
        }}
      />

      <Cabecera item={item} titulo={titulo} detalle={detalle} />

      {item.notaFuente ? <NotaFuente nota={item.notaFuente} /> : null}

      <Agregados item={item} sinDato={sinDato} />

      <section className="grid gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Promedio por departamento</h2>
          <p className="text-xs text-muted-foreground">
            Promedio del costo directo de las provincias con dato en cada
            departamento. Toca un departamento para saltar a sus filas en la
            tabla.
          </p>
          <ColombiaTileMap
            valores={promedioPorDepartamento(item)}
            formatear={formatearPrecio}
            unidad={`COP/${item.unidad}`}
            href={(dane) => `#depto-${dane}`}
            titulo={`Costo directo de ${item.codigo} por departamento`}
            className="max-w-[18rem]"
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-medium">
            Costo directo por provincia
            <span className="ml-2 align-middle text-sm font-normal text-muted-foreground tabular-nums">
              {item.regiones.length} regiones INVIAS
            </span>
          </h2>
          <TablaProvincias
            codigo={item.codigo}
            unidad={item.unidad}
            regiones={item.regiones}
          />
        </div>
      </section>

      <GraficoRegional item={item} />

      <ProcedenciaBox procedencia={item.procedencia} />
    </>
  )
}

function Cabecera({
  item,
  titulo,
  detalle,
}: {
  item: ItemRegional
  titulo: string
  detalle?: string
}) {
  return (
    <header className="space-y-3">
      <nav className="text-xs text-muted-foreground">
        <Link href="/items" className="underline underline-offset-4">
          Ítems
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="font-mono">{item.codigo}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">
          {item.codigo}
        </Badge>
        <Badge variant="secondary">
          {item.capituloNumero
            ? `Capítulo ${item.capituloNumero}${
                item.capituloNombre ? ` · ${item.capituloNombre}` : ""
              }`
            : `Capítulo ${item.capitulo}`}
        </Badge>
        <Badge variant="outline">Familia {item.capitulo}</Badge>
        <Badge variant="outline">Vigencia {item.vigencia}</Badge>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        {titulo}
      </h1>

      {detalle ? (
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          {detalle}
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Unidad de medida: <span className="font-medium">{item.unidad}</span>
        {item.unidadCruda && item.unidadCruda !== item.unidad ? (
          <span> (en el archivo fuente: «{item.unidadCruda}»)</span>
        ) : null}
        {item.articulo ? (
          <span> · {item.articulo.replace(/\n/g, " — ")}</span>
        ) : null}
      </p>
    </header>
  )
}

/** Banda de agregados nacionales. `min`/`max` documentan la dispersión. */
function Agregados({ item, sinDato }: { item: ItemRegional; sinDato: number }) {
  const celdas = [
    { etiqueta: "Mínimo", valor: item.agregados.min },
    { etiqueta: "Mediana", valor: item.agregados.mediana },
    { etiqueta: "Máximo", valor: item.agregados.max },
    { etiqueta: "Promedio", valor: item.agregados.promedio },
  ]

  return (
    <section aria-label="Agregados nacionales" className="space-y-2">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {celdas.map((celda) => (
          <div key={celda.etiqueta} className="rounded-lg border p-3">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {celda.etiqueta} nacional
            </dt>
            <dd className="mt-1 text-2xl font-medium tabular-nums">
              {formatearPrecio(celda.valor)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                /{item.unidad}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Calculados sobre las{" "}
        <span className="tabular-nums">{item.provinciasConDato}</span> de{" "}
        <span className="tabular-nums">{item.regiones.length}</span> provincias
        con dato
        {sinDato > 0 ? (
          <>
            {" "}
            — el ítem no aplica en{" "}
            <span className="tabular-nums">{sinDato}</span>{" "}
            {sinDato === 1 ? "provincia" : "provincias"}, que se muestran como
            «No aplica» y no entran en los agregados
          </>
        ) : null}
        . Costo directo, sin AIU: no es un precio de mercado.
      </p>
    </section>
  )
}

/**
 * Isla perezosa bajo el pliegue: las 15 provincias más caras, las 5 más
 * baratas y la más cercana a la mediana nacional (destacada). Las 140 ya están
 * completas en la tabla de arriba; esto es lectura rápida de la dispersión, no
 * la fuente del dato.
 */
function GraficoRegional({ item }: { item: ItemRegional }) {
  const conDato = item.regiones
    .filter((fila) => fila.costoDirecto > 0)
    .sort((a, b) => b.costoDirecto - a.costoDirecto)

  if (conDato.length === 0) return null

  const iMediana = conDato.reduce(
    (mejor, fila, i) =>
      Math.abs(fila.costoDirecto - item.agregados.mediana) <
      Math.abs(conDato[mejor].costoDirecto - item.agregados.mediana)
        ? i
        : mejor,
    0
  )

  const elegidos = new Set<number>([iMediana])
  for (let i = 0; i < Math.min(15, conDato.length); i++) elegidos.add(i)
  for (let i = Math.max(0, conDato.length - 5); i < conDato.length; i++) {
    elegidos.add(i)
  }

  const datos = [...elegidos]
    .sort((a, b) => a - b)
    .map((i) => ({
      etiqueta: `${conDato[i].region.provincia} (${conDato[i].region.departamento})`,
      valor: conDato[i].costoDirecto,
      destacado: i === iMediana,
    }))

  const omitidas = conDato.length - datos.length

  return (
    <section aria-label="Dispersión regional" className="space-y-2">
      <h2 className="text-lg font-medium">Dispersión regional</h2>
      <PrecioBarLazy
        datos={datos}
        unidad={item.unidad}
        descripcion={
          `Las más altas y las más bajas de ${formatearNumero(conDato.length)} ` +
          `provincias con dato; destacada la más cercana a la mediana nacional` +
          (omitidas > 0
            ? `. Se omiten ${formatearNumero(omitidas)} provincias intermedias, todas en la tabla de arriba`
            : "") +
          ". Costo directo, sin AIU."
        }
      />
    </section>
  )
}

/**
 * Promedio de costo directo por departamento, para el mapa de teselas.
 *
 * Se promedian SOLO las provincias con dato: incluir los ceros de "no aplica"
 * hundiría el promedio de un departamento e implicaría que allí el ítem es más
 * barato, cuando lo que pasa es que no se ejecuta. Un departamento sin ninguna
 * provincia con dato se omite del mapa (sale como tesela apagada, "sin dato").
 */
function promedioPorDepartamento(item: ItemRegional): Record<string, number> {
  const acumulado = new Map<string, { suma: number; n: number }>()
  for (const fila of item.regiones) {
    if (fila.costoDirecto <= 0) continue
    const clave = fila.region.codigoDane
    const previo = acumulado.get(clave) ?? { suma: 0, n: 0 }
    previo.suma += fila.costoDirecto
    previo.n += 1
    acumulado.set(clave, previo)
  }

  const valores: Record<string, number> = {}
  for (const [dane, { suma, n }] of acumulado) valores[dane] = suma / n
  return valores
}
