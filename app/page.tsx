import type { Metadata } from "next"
import { cacheLife, cacheTag } from "next/cache"
import Link from "next/link"

import { ColombiaTileMap } from "@/components/map/colombia-tile-map"
import { ProcedenciaBox } from "@/components/procedencia"
import {
  ETIQUETA_VIGENCIA,
  getCatalogo,
  getCodigosDestacados,
  getStats,
  VIGENCIA_ACTUAL,
} from "@/lib/data"
import { formatearCOP, formatearNumero } from "@/lib/format"
import { alcance, primeraLinea } from "./_ui/capitulos"
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
 * cambia. Sale como HTML estático y sin JavaScript propio —los enlaces de las
 * rejillas son `<a>` planos, no `next/link`: no queremos 30 prefetch al entrar.
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
