import type { Metadata } from "next"
import { cacheLife, cacheTag } from "next/cache"
import Link from "next/link"

import {
  ComposicionCapitulosLazy,
  CurvaPreciosLazy,
  DesgloseSankeyLazy,
  DispersionItemsLazy,
} from "@/components/charts/lazy"
import { ColombiaTileMap } from "@/components/map/colombia-tile-map"
import { NivelDepartamentos } from "@/components/map/nivel-departamentos"
import { ProcedenciaBox } from "@/components/procedencia"
import {
  ETIQUETA_VIGENCIA,
  getCatalogo,
  getCodigosDestacados,
  getCodigosFamiliaDestacada,
  getDesglose,
  getItem,
  getProvincia,
  getStats,
  getTodosLosCodigos,
  getTodosLosSlugs,
  VIGENCIA_ACTUAL,
} from "@/lib/data"
import {
  formatearCOP,
  formatearNumero,
  formatearPorcentaje,
} from "@/lib/format"
import {
  acumularComposicion,
  itemsMasDispersos,
  nivelPorDepartamento,
  prepararSankey,
} from "./_ui/agregados"
import { alcance, mapaDeCapitulos, primeraLinea } from "./_ui/capitulos"
import { listarProvincias, medianaPorDepartamento } from "./_ui/regiones"

export const metadata: Metadata = {
  // Absoluto: la portada no debe leerse "Explorador APU · Explorador APU".
  title: {
    absolute: `Explorador APU — precios de referencia INVIAS ${VIGENCIA_ACTUAL}`,
  },
  description:
    "526 ítems de pago con su costo directo de referencia en las 140 " +
    `provincias de INVIAS, vigencia ${VIGENCIA_ACTUAL}. Sin AIU, con ` +
    "procedencia en cada número.",
  alternates: { canonical: "/" },
}

/**
 * Portada.
 *
 * Toda la página es un solo ámbito cacheado (`"use cache"` + `cacheLife("max")`)
 * porque el dato es un archivo estático versionado: dentro de una vigencia no
 * cambia. Sale como HTML estático —los enlaces de las rejillas son `<a>`
 * planos, no `next/link`: no queremos 30 prefetch al entrar. Los gráficos de
 * las historias cargan en diferido bajo el pliegue (`*Lazy`); las cifras clave
 * y la rejilla de niveles siguen en el HTML del servidor.
 *
 * Leer aquí los 526 ítems y los 140 resúmenes para los agregados es deliberado:
 * ocurre una vez por build dentro de este ámbito cacheado, y son los mismos
 * archivos que las páginas de ítem y de provincia ya leen.
 */
export default async function Page() {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const [stats, catalogo, destacados, provincias] = await Promise.all([
    getStats(),
    getCatalogo(),
    getCodigosDestacados(),
    listarProvincias(),
  ])

  const porCodigo = new Map(catalogo.items.map((item) => [item.codigo, item]))
  const items = destacados
    .map((codigo) => porCodigo.get(codigo))
    .filter((item) => item !== undefined)

  const { conteos, notables } = stats

  // ── Los datos de las historias ──────────────────────────────────────────
  const [codigos, slugs, familia] = await Promise.all([
    getTodosLosCodigos(),
    getTodosLosSlugs(),
    getCodigosFamiliaDestacada(),
  ])
  const [regionales, resumenes] = await Promise.all([
    Promise.all(codigos.map((codigo) => getItem(codigo))).then((lista) =>
      lista.filter((item) => item !== null)
    ),
    Promise.all(slugs.map((slug) => getProvincia(slug))).then((lista) =>
      lista.filter((resumen) => resumen !== null)
    ),
  ])

  // La curva: las 140 medianas provinciales, de la más barata a la más cara.
  const puntos = provincias
    .filter((provincia) => provincia.mediana > 0)
    .sort((a, b) => a.mediana - b.mediana)
    .map((provincia) => ({
      slug: provincia.region.slug,
      provincia: provincia.region.provincia,
      departamento: provincia.region.departamento,
      valor: provincia.mediana,
    }))
  const medianaProvincial = medianaDe(puntos.map((punto) => punto.valor))

  const composicion = acumularComposicion(regionales)
  const apusConDato = composicion.reduce((suma, grupo) => suma + grupo.apus, 0)

  const dispersos = itemsMasDispersos(catalogo.items, primeraLinea)

  const capitulosPorCodigo = mapaDeCapitulos(catalogo)
  const nivel = nivelPorDepartamento(
    resumenes,
    new Map(
      catalogo.items.map((item) => [item.codigo, item.costoDirecto.mediana])
    ),
    (capitulo3) =>
      capitulosPorCodigo.get(capitulo3) ?? {
        numero: Number(capitulo3[0]),
        nombre: `Capítulo ${capitulo3[0]}`,
      }
  )

  // El APU del sankey: el primero de la familia destacada (630, prerrenderada)
  // en su provincia mediana — un desglose real, ni el más caro ni el más barato.
  const itemSankey = regionales.find((item) => item.codigo === familia[0])
  const regionesConDato = (itemSankey?.regiones ?? [])
    .filter((fila) => fila.costoDirecto > 0)
    .sort((a, b) => a.costoDirecto - b.costoDirecto)
  const filaSankey = regionesConDato[Math.floor(regionesConDato.length / 2)]
  const desgloseSankey =
    itemSankey && filaSankey
      ? await getDesglose(itemSankey.codigo, filaSankey.region.slug)
      : null
  const sankey =
    itemSankey && filaSankey && desgloseSankey
      ? {
          item: itemSankey,
          fila: filaSankey,
          componentes: prepararSankey(desgloseSankey),
        }
      : null

  const cifras = [
    { valor: conteos.items, etiqueta: "ítems de pago" },
    { valor: conteos.provincias, etiqueta: "provincias" },
    { valor: conteos.departamentos, etiqueta: "departamentos" },
    { valor: conteos.apus, etiqueta: "APU (ítem × provincia)" },
    { valor: conteos.lineas, etiqueta: "líneas de desglose" },
  ]

  return (
    <main className="mx-auto w-full max-w-6xl space-y-12 px-4 py-10 sm:px-6">
      <section className="max-w-3xl space-y-4">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          INVIAS · vigencia {VIGENCIA_ACTUAL} · costo directo
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          Precios unitarios de referencia para construcción en Colombia
        </h1>
        <p className="text-lg text-pretty text-muted-foreground">
          Los Análisis de Precios Unitarios que INVIAS publica en{" "}
          {formatearNumero(conteos.provincias)} libros regionales, aquí abiertos
          y legibles: un ítem, una provincia, un precio con su procedencia.
        </p>
        <p className="text-sm text-pretty text-muted-foreground">
          Cada cifra es <strong className="font-medium">costo directo</strong>:
          no incluye AIU (administración, imprevistos, utilidad) ni IVA, y no es
          un precio de mercado. Sirve como referencia oficial, no como
          cotización.
        </p>
      </section>

      <section aria-label="Cifras de la vigencia">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 lg:grid-cols-5">
          {cifras.map((cifra) => (
            <div key={cifra.etiqueta} className="bg-background p-4">
              <dt className="text-xs text-muted-foreground">
                {cifra.etiqueta}
              </dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {formatearNumero(cifra.valor)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start">
        <div className="space-y-3">
          <h2 className="text-sm font-medium">
            Mediana del costo directo por departamento
          </h2>
          <ColombiaTileMap
            valores={medianaPorDepartamento(provincias)}
            formatear={formatearCOP}
            href={(dane) => `/provincias#departamento-${dane}`}
            titulo="Mediana del costo directo por departamento"
          />
        </div>

        <div className="space-y-4 text-sm">
          <p className="text-pretty text-muted-foreground">
            La mediana de un departamento resume los{" "}
            {formatearNumero(conteos.items)} ítems en cada una de sus
            provincias. Mide dispersión regional del{" "}
            <strong className="font-medium">costo directo de referencia</strong>{" "}
            —transporte, insumos y mano de obra locales—, no el costo de vida ni
            el precio de mercado.
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <dt className="text-xs text-muted-foreground">
                Provincia con la mediana más alta
              </dt>
              <dd className="mt-1 space-y-1">
                <a
                  className="font-medium underline underline-offset-4"
                  href={`/provincias/${notables.provinciaMasCara.slug}`}
                >
                  {notables.provinciaMasCara.provincia}
                </a>
                <p className="text-xs text-muted-foreground">
                  {notables.provinciaMasCara.departamento} ·{" "}
                  <span className="tabular-nums">
                    {formatearCOP(
                      notables.provinciaMasCara.medianaCostoDirecto
                    )}
                  </span>
                </p>
              </dd>
            </div>
            <div className="rounded-lg border p-4">
              <dt className="text-xs text-muted-foreground">
                Provincia con la mediana más baja
              </dt>
              <dd className="mt-1 space-y-1">
                <a
                  className="font-medium underline underline-offset-4"
                  href={`/provincias/${notables.provinciaMasBarata.slug}`}
                >
                  {notables.provinciaMasBarata.provincia}
                </a>
                <p className="text-xs text-muted-foreground">
                  {notables.provinciaMasBarata.departamento} ·{" "}
                  <span className="tabular-nums">
                    {formatearCOP(
                      notables.provinciaMasBarata.medianaCostoDirecto
                    )}
                  </span>
                </p>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-label="La curva nacional" className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          La curva nacional
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Una barra por provincia: la mediana del costo directo de sus ítems
          con dato, de la más barata a la más cara (los «No aplica» no entran).
          Pasa el cursor para ver cuál es; pulsa una barra para abrir la
          provincia.
        </p>
        <CurvaPreciosLazy
          datos={puntos}
          mediana={medianaProvincial}
          etiquetaMediana="mediana de las 140"
          hrefBase="/provincias"
          descripcion="Costo directo de referencia, sin AIU."
        />
      </section>

      <section aria-label="De qué está hecho el costo" className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          De qué está hecho el costo
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          La participación media de equipo, materiales, transporte y mano de
          obra por capítulo constructivo, sobre los{" "}
          {formatearNumero(apusConDato)} APU con dato. Se promedian
          participaciones —cada APU pesa igual—, no pesos en COP: el catálogo
          mezcla unidades y sumar COP/m3 con COP/kg-km no significa nada.
        </p>
        <ComposicionCapitulosLazy
          capitulos={composicion}
          descripcion="Costo directo de referencia, sin AIU."
        />
      </section>

      <section aria-label="Los que más varían" className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          Los que más varían
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Para cada ítem, cuántas veces su mediana nacional se paga en la
          provincia más cara (máximo ÷ mediana; solo ítems con al menos 10
          provincias con dato). La razón no tiene unidad, así que sí es
          comparable entre ítems aunque uno se mida en m3 y otro en kg-km.
          Pulsa una barra para abrir el ítem y ver su curva completa.
        </p>
        <DispersionItemsLazy
          datos={dispersos}
          descripcion="Costo directo de referencia, sin AIU."
        />
      </section>

      {sankey ? (
        <section aria-label="Un APU por dentro" className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Un APU por dentro
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Así se arma un análisis de precios unitarios: el costo directo se
            abre en sus cuatro componentes y cada componente en sus líneas.
            Este es{" "}
            <span className="font-mono text-foreground/80">
              {sankey.item.codigo}
            </span>{" "}
            — {primeraLinea(sankey.item.descripcion)} — en{" "}
            {sankey.fila.region.provincia} ({sankey.fila.region.departamento}),
            la provincia mediana para este ítem.{" "}
            <Link
              href={`/items/${sankey.item.codigo}/${sankey.fila.region.slug}`}
              className="underline underline-offset-4"
            >
              Ver el desglose completo
            </Link>
            .
          </p>
          <DesgloseSankeyLazy
            componentes={sankey.componentes}
            costoDirecto={sankey.fila.costoDirecto}
            unidad={sankey.item.unidad}
            descripcion={`Las tres líneas mayores de cada componente; el resto se agrupa en «otras». Vigencia ${sankey.item.vigencia}.`}
          />
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight">
            Ítems destacados
          </h2>
          <Link
            href="/items"
            className="text-sm underline underline-offset-4 hover:text-foreground"
          >
            Ver los {formatearNumero(conteos.items)} ítems →
          </Link>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Concretos estructurales de la familia 630 y los ítems de mayor mediana
          de cada capítulo. El valor mostrado es la mediana nacional sobre las
          provincias con dato.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.codigo}>
              <a
                href={`/items/${item.codigo}`}
                className="flex h-full flex-col gap-2 rounded-lg border p-4 hover:bg-muted/50"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {item.codigo}
                </span>
                <span className="line-clamp-2 text-sm font-medium">
                  {primeraLinea(item.descripcion)}
                </span>
                {/*
                  El alcance no es relleno: la mitad de los destacados son de la
                  familia 630 y todos se titulan "TIPO DE CONCRETO____". Sin
                  esta línea, nueve tarjetas dirían exactamente lo mismo.
                */}
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {alcance(item.descripcion)}
                </span>
                <span className="mt-auto flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold tabular-nums">
                    {formatearCOP(item.costoDirecto.mediana)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    por {item.unidad}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Nivel relativo por departamento y capítulo"
        className="space-y-4"
      >
        <h2 className="text-xl font-semibold tracking-tight">
          Dónde se aparta el costo de la referencia
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Cada celda compara un departamento y un capítulo con el país: la
          mediana de la razón entre el costo de cada APU y la mediana nacional
          de su ítem. ×1 significa «aquí cuesta lo que en la mitad del país».
          INVIAS publica dato para el{" "}
          {formatearPorcentaje(apusConDato / conteos.apus)} de los{" "}
          {formatearNumero(conteos.apus)} APU posibles, así que casi toda celda
          tiene su capítulo completo detrás. Bogotá D.C. está fuera del alcance
          INVIAS: sus precios de referencia los publica el IDU.
        </p>
        <NivelDepartamentos filas={nivel} capitulos={composicion} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/items" className="rounded-lg border p-5 hover:bg-muted/50">
          <h2 className="font-medium">Catálogo de ítems</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Los {formatearNumero(conteos.items)} ítems de pago por capítulo, con
            unidad y mediana nacional.
          </p>
        </Link>
        <Link
          href="/provincias"
          className="rounded-lg border p-5 hover:bg-muted/50"
        >
          <h2 className="font-medium">Provincias</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Las {formatearNumero(conteos.provincias)} direcciones territoriales
            de INVIAS en {formatearNumero(conteos.departamentos)} departamentos.
          </p>
        </Link>
      </section>

      <ProcedenciaBox procedencia={stats.procedencia} />
    </main>
  )
}

/** Mediana de una lista (0 si está vacía) — la misma copia local de cinco
 * líneas que `regiones.ts` y `comparar-capitulos.ts` (ver la nota allí). */
function medianaDe(valores: readonly number[]): number {
  if (valores.length === 0) return 0
  const ordenados = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 0
    ? (ordenados[medio - 1] + ordenados[medio]) / 2
    : ordenados[medio]
}
