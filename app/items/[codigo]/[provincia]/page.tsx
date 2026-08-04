/**
 * `/items/{codigo}/{provincia}` — el desglose de un APU: las líneas de equipo,
 * materiales, transporte y mano de obra que suman el costo directo de ese ítem
 * en esa región.
 *
 * Es la página más profunda del explorador y la única que muestra el APU
 * completo, con la forma del formato FR-APU-1.
 *
 * ## Prerender + ISR
 *
 * El producto cartesiano completo son 526 × 140 ≈ 73 640 páginas: prerrenderlas
 * todas costaría horas de build para un dato que casi nadie mirará. Se
 * prerrenderiza la familia destacada —9 ítems de la 630 × 140 provincias =
 * 1 260— y el resto se genera en la primera petición y se guarda en disco.
 *
 * El corte fue los 30 destacados (4 200 páginas) hasta que el build de Vercel
 * (4 núcleos / 8 GB) murió por OOM hacia la página ~3 700: la memoria de los
 * 3 workers de prerender crece con las páginas generadas y el montón no se
 * puede subir desde fuera (Next lo borra del NODE_OPTIONS de los workers; ver
 * `elegirFamiliaDestacada` en `lib/data/leer.ts` y la nota de
 * `.github/workflows/ci.yml`). Con PPR el costo de salir del corte es pequeño:
 * el primer visitante ve el App Shell al instante y el desglose llega en la
 * misma respuesta unos cientos de ms después (la consulta al parquet son
 * ~6-9 ms).
 *
 * Eso NO requiere configuración: con Cache Components `dynamicParams` ni
 * siquiera existe como opción («`dynamicParams` is not available when Cache
 * Components is enabled», `03-file-conventions/02-route-segment-config/
 * dynamicParams.md`) y el comportamiento por defecto es justo el que se quiere:
 * «Pages rendered with runtime params are saved to disk after a successful
 * first request» (`03-file-conventions/dynamic-routes.md`, «With Cache
 * Components»). Por eso aquí no hay ningún `export const` de segmento: añadir
 * `dynamicParams = false` rompería la cola larga y devolvería 404 en 69 440
 * páginas válidas.
 *
 * ## App Shell
 *
 * Con prefetch parcial `Page` no resuelve `params`: el App Shell es uno solo
 * para las ~73 640 URLs de la ruta, así que leer la URL por encima del
 * `<Suspense>` lo ataría a una sola y, en las páginas ISR, impediría pintar
 * nada antes de que el desglose se generara
 * (`adopting-partial-prefetching.md`, «Auditing routes for URL data»).
 */
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cacheLife, cacheTag } from "next/cache"
import { Suspense } from "react"

import {
  DesgloseDonutLazy,
  DesgloseTreemapLazy,
} from "@/components/charts/lazy"
import { ProcedenciaBox } from "@/components/procedencia"
import { Badge } from "@/components/ui/badge"
import {
  ETIQUETA_VIGENCIA,
  getCodigosFamiliaDestacada,
  getDesglose,
  getItem,
  getProvincia,
  getTodosLosSlugs,
  type Desglose,
} from "@/lib/data"
import { formatearPorcentaje } from "@/lib/format"
import {
  COMPONENTES,
  NOTA_COSTO_DIRECTO,
  type ItemRegion,
  type ItemRegional,
  type Region,
} from "@/lib/schema"

import {
  Bloque,
  Esqueleto,
  EsqueletoCabecera,
  EsqueletoCifras,
  EsqueletoTabla,
} from "@/app/_ui/esqueleto"

import { alcance, formatearPrecio, tituloCorto } from "../_components/formato"
import { DatasetJsonLd } from "../_components/jsonld"
import { NotaFuente } from "../_components/nota-fuente"
import { CONFIG } from "../_components/desglose-config"
import { TablaDesglose } from "../_components/tabla-desglose"
import { LimiteDesglose } from "./limite-error"

/**
 * Descuadre máximo tolerado entre la suma de los componentes y el costo
 * directo publicado, en COP.
 *
 * El pipeline verifica la aritmética y, medido sobre el dato real, el descuadre
 * es exactamente 0: los subtotales vienen redondeados a dos decimales y suman
 * el costo directo al céntimo. El umbral existe por honestidad, no por miedo:
 * si algún día una vigencia nueva trae un descuadre, la página lo dice en vez
 * de esconderlo.
 */
const TOLERANCIA = 0.011

/**
 * Corte prerrenderizado: la familia destacada (9 ítems de la 630) × las 140
 * provincias. La cola larga (517 × 140) se genera bajo demanda (ver la nota
 * de arriba).
 */
export async function generateStaticParams() {
  const [codigos, slugs] = await Promise.all([
    getCodigosFamiliaDestacada(),
    getTodosLosSlugs(),
  ])
  return codigos.flatMap((codigo) =>
    slugs.map((provincia) => ({ codigo, provincia }))
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string; provincia: string }>
}): Promise<Metadata> {
  const { codigo, provincia } = await params
  return metadatosDeDesglose(codigo, provincia)
}

async function metadatosDeDesglose(
  codigo: string,
  slug: string
): Promise<Metadata> {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const [item, resumen] = await Promise.all([
    getItem(codigo),
    getProvincia(slug),
  ])
  if (!item || !resumen)
    return { title: "Desglose no encontrado · Explorador APU" }

  const { region } = resumen
  const titulo = tituloCorto(item.descripcion)
  const fila = item.regiones.find((r) => r.region.slug === slug)
  const { vigencia } = item.procedencia

  return {
    title:
      `${item.codigo} en ${region.provincia} (${region.departamento}) — ` +
      `desglose APU INVIAS ${vigencia}`,
    description:
      `Desglose del análisis de precios unitarios ${item.codigo} ` +
      `(${titulo}) en ${region.provincia}, ${region.departamento}: equipo, ` +
      `materiales, transporte y mano de obra` +
      (fila && fila.costoDirecto > 0
        ? `. Costo directo ${formatearPrecio(fila.costoDirecto)}/${item.unidad}`
        : "") +
      `. Fuente INVIAS, vigencia ${vigencia}. Sin AIU, no es un precio de mercado.`,
  }
}

export default function Page({
  params,
}: {
  params: Promise<{ codigo: string; provincia: string }>
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <LimiteDesglose>
        <Suspense fallback={<EsqueletoDesglose />}>
          <DesgloseDeParams params={params} />
        </Suspense>
      </LimiteDesglose>
    </main>
  )
}

/** Único punto de la ruta que resuelve la URL, ya dentro del `<Suspense>`. */
async function DesgloseDeParams({
  params,
}: {
  params: Promise<{ codigo: string; provincia: string }>
}) {
  const { codigo, provincia } = await params
  return <ContenidoDesglose codigo={codigo} slug={provincia} />
}

/**
 * Reserva: cabecera, banda de totales y los cuatro bloques de componentes.
 * Es lo que se ve en una URL de la cola larga mientras ISR genera la página.
 */
function EsqueletoDesglose() {
  return (
    <Esqueleto className="flex flex-col gap-8">
      <EsqueletoCabecera />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Bloque className="h-32 rounded-lg" />
        <EsqueletoCifras n={4} />
      </div>
      <div className="space-y-6">
        <Bloque className="h-6 w-64" />
        {Array.from({ length: 4 }, (_, i) => (
          <EsqueletoTabla key={i} filas={4} />
        ))}
      </div>
    </Esqueleto>
  )
}

async function ContenidoDesglose({
  codigo,
  slug,
}: {
  codigo: string
  slug: string
}) {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const [item, desglose, resumen] = await Promise.all([
    getItem(codigo),
    getDesglose(codigo, slug),
    getProvincia(slug),
  ])
  if (!item || !desglose || !resumen) notFound()

  // El par ítem × provincia tiene que existir en los dos artefactos: si el
  // desglose trae líneas pero el ítem no publica esa región (o al revés), el
  // dato está roto y es mejor un 404 que una página con la mitad de las cifras.
  const fila = item.regiones.find((r) => r.region.slug === slug)
  if (!fila) notFound()

  const { region } = resumen
  const titulo = tituloCorto(item.descripcion)
  const detalle = alcance(item.descripcion)
  const descuadre = Math.abs(desglose.total - fila.costoDirecto)

  // Aplanado para el mapa del costo: solo lo que el gráfico necesita (~5-40
  // filas de tres campos), no los `LineaDesglose` completos — es el primer dato
  // a nivel de línea que cruza al cliente en esta página. Las líneas en cero se
  // quedan fuera: no tienen área que pintar y solo ensucian el tooltip.
  const lineas = desglose.componentes.flatMap((grupo) =>
    grupo.lineas
      .filter((linea) => linea.subtotal > 0)
      .map((linea) => ({
        descripcion: linea.descripcion,
        componente: grupo.componente,
        subtotal: linea.subtotal,
      }))
  )

  return (
    <>
      <DatasetJsonLd
        procedencia={item.procedencia}
        datos={{
          name:
            `${item.codigo} — ${titulo} en ${region.provincia}, ` +
            `${region.departamento} (APU INVIAS ${item.vigencia})`,
          description:
            `Desglose del análisis de precios unitarios ${item.codigo} ` +
            `(${titulo}), unidad ${item.unidad}, en ${region.provincia}, ` +
            `${region.departamento}: ${desglose.lineas} líneas de equipo, ` +
            `materiales, transporte y mano de obra. ` +
            NOTA_COSTO_DIRECTO,
          keywords: [
            "APU",
            "análisis de precios unitarios",
            "desglose",
            "INVIAS",
            "costo directo",
            item.codigo,
            region.provincia,
            region.departamento,
            titulo,
          ],
          spatialCoverage: {
            "@type": "Place",
            name: `${region.provincia}, ${region.departamento}, Colombia`,
            containedInPlace: {
              "@type": "AdministrativeArea",
              name: region.departamento,
              identifier: region.codigoDane,
              containedInPlace: { "@type": "Country", name: "Colombia" },
            },
          },
          variableMeasured: {
            "@type": "PropertyValue",
            name: "Costo directo de referencia",
            value: fila.costoDirecto,
            unitText: `COP/${item.unidad}`,
            description: NOTA_COSTO_DIRECTO,
          },
        }}
      />

      <Cabecera
        item={item}
        region={region}
        titulo={titulo}
        detalle={detalle}
        vigencia={desglose.vigencia}
      />

      {item.notaFuente ? <NotaFuente nota={item.notaFuente} /> : null}

      <Totales item={item} fila={fila} />

      <section className="space-y-6">
        <h2 className="text-lg font-medium">
          Desglose del análisis
          <span className="ml-2 align-middle text-sm font-normal text-muted-foreground tabular-nums">
            {desglose.lineas} líneas
          </span>
        </h2>
        {COMPONENTES.map((componente) => {
          const grupo = desglose.componentes.find(
            (c) => c.componente === componente
          )
          return (
            <TablaDesglose
              key={componente}
              componente={componente}
              lineas={grupo?.lineas ?? []}
              subtotal={grupo?.subtotal ?? 0}
              costoDirecto={fila.costoDirecto}
            />
          )
        })}

        <TotalDesglose
          desglose={desglose}
          unidad={item.unidad}
          descuadre={descuadre}
          costoDirecto={fila.costoDirecto}
        />
      </section>

      {/*
        Misma guarda que la dona: sin costo directo no hay áreas que repartir
        (y sin líneas con subtotal el treemap saldría vacío).
      */}
      {fila.costoDirecto > 0 && lineas.length > 0 ? (
        <section aria-label="Mapa del costo" className="space-y-2">
          <h2 className="text-lg font-medium">Mapa del costo</h2>
          <DesgloseTreemapLazy
            lineas={lineas}
            costoDirecto={fila.costoDirecto}
            unidad={item.unidad}
            descripcion={`Cada rectángulo es una línea del análisis; el área es su peso en el costo directo. ${region.provincia}, ${region.departamento} · vigencia ${item.vigencia} · costo directo, sin AIU.`}
          />
        </section>
      ) : null}

      {/*
        Sin costo directo no hay participación que repartir: la dona saldría
        vacía y con "$ 0" en el centro, que es justo lo que FORMATO.md §6.5
        prohíbe presentar como precio. Se omite la sección (y con ella la carga
        de recharts en una página que no tiene nada que graficar).
      */}
      {fila.costoDirecto > 0 ? (
        <section
          aria-label="Participación por componente"
          className="space-y-2"
        >
          <h2 className="text-lg font-medium">Participación por componente</h2>
          <DesgloseDonutLazy
            totales={fila.totales}
            costoDirecto={fila.costoDirecto}
            unidad={item.unidad}
            descripcion={`${region.provincia}, ${region.departamento} · vigencia ${item.vigencia} · costo directo, sin AIU`}
            className="max-w-md"
          />
        </section>
      ) : null}

      <ProcedenciaBox procedencia={item.procedencia} />
    </>
  )
}

function Cabecera({
  item,
  region,
  titulo,
  detalle,
  vigencia,
}: {
  item: ItemRegional
  region: Region
  titulo: string
  detalle?: string
  vigencia: string
}) {
  return (
    <header className="space-y-3">
      <nav aria-label="Migas de pan" className="text-xs text-muted-foreground">
        <Link href="/items" className="underline underline-offset-4">
          Ítems
        </Link>
        <span aria-hidden="true"> / </span>
        <Link
          href={`/items/${item.codigo}`}
          className="font-mono underline underline-offset-4"
        >
          {item.codigo}
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{region.provincia}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">
          {item.codigo}
        </Badge>
        <Badge variant="secondary">
          {region.provincia} · {region.departamento}
        </Badge>
        <Badge variant="outline">Vigencia {vigencia}</Badge>
        <Badge variant="outline">Unidad {item.unidad}</Badge>
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
        Análisis de precios unitarios para 1 {item.unidad}
        {item.unidadCruda && item.unidadCruda !== item.unidad
          ? ` (en el archivo fuente: «${item.unidadCruda}»)`
          : ""}{" "}
        en la dirección territorial{" "}
        <span className="font-medium">{region.provincia}</span> (
        {region.departamento}).{" "}
        <Link
          href={`/provincias/${region.slug}`}
          className="underline underline-offset-4"
        >
          Ver todos los ítems de la provincia
        </Link>
        .
      </p>
    </header>
  )
}

/**
 * Banda de totales: el costo directo y los cuatro componentes con su peso.
 *
 * Un costo directo de 0 se rotula "No aplica", nunca `$ 0` — misma regla que
 * la tabla de provincias del ítem y el hub (FORMATO.md §6.5). El desglose sí
 * se sigue mostrando debajo: las líneas en cero son lo que publica la fuente y
 * son la evidencia de que el ítem no aplica aquí.
 */
function Totales({ item, fila }: { item: ItemRegional; fila: ItemRegion }) {
  const aplica = fila.costoDirecto > 0
  const peso = (valor: number) =>
    aplica ? formatearPorcentaje(valor / fila.costoDirecto) : "—"

  return (
    <section aria-label="Totales" className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Costo directo
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {aplica ? (
              <>
                {formatearPrecio(fila.costoDirecto)}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  /{item.unidad}
                </span>
              </>
            ) : (
              <span className="font-medium text-muted-foreground">
                No aplica
              </span>
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {aplica ? null : (
              <>
                INVIAS publica este ítem en cero para esta región: no se ejecuta
                aquí.{" "}
              </>
            )}
            Mediana nacional de este ítem:{" "}
            <span className="tabular-nums">
              {formatearPrecio(item.agregados.mediana)}/{item.unidad}
            </span>
            .
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          {COMPONENTES.map((componente) => (
            <div key={componente} className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">
                {CONFIG[componente].titulo}
              </dt>
              <dd className="mt-0.5 text-lg font-medium tabular-nums">
                {aplica ? (
                  <>
                    {formatearPrecio(fila.totales[componente])}
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                      {peso(fila.totales[componente])}
                    </span>
                  </>
                ) : (
                  <span className="font-normal text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="text-sm text-foreground/80">
        Costo directo de referencia, sin AIU. No es un precio de mercado.
      </p>
    </section>
  )
}

/** Cierre del desglose: el total y, si hiciera falta, el aviso de descuadre. */
function TotalDesglose({
  desglose,
  unidad,
  descuadre,
  costoDirecto,
}: {
  desglose: Desglose
  unidad: string
  descuadre: number
  costoDirecto: number
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border-2 bg-muted/30 p-4">
        <span className="font-medium">Costo directo total</span>
        <span className="text-2xl font-semibold tabular-nums">
          {costoDirecto > 0 ? (
            <>
              {formatearPrecio(desglose.total)}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                /{unidad}
              </span>
            </>
          ) : (
            // Cero no es un precio: el ítem no aplica en esta región
            // (FORMATO.md §6.5). Las líneas de arriba ya muestran los ceros
            // tal como los publica la fuente.
            <span className="font-medium text-muted-foreground">No aplica</span>
          )}
        </span>
      </div>

      {descuadre > TOLERANCIA ? (
        <p
          role="status"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground"
        >
          La suma de los componentes ({formatearPrecio(desglose.total)}) no
          coincide con el costo directo publicado para esta región (
          {formatearPrecio(costoDirecto)}): diferencia de{" "}
          {formatearPrecio(descuadre)}. El dato se muestra tal como lo publica
          la fuente, sin ajustar.
        </p>
      ) : null}
    </div>
  )
}
