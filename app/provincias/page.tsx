import type { Metadata } from "next"
import { cacheLife, cacheTag } from "next/cache"

import { ColombiaTileMap } from "@/components/map/colombia-tile-map"
import { ProcedenciaBox } from "@/components/procedencia"
import { ETIQUETA_VIGENCIA, getStats, VIGENCIA_ACTUAL } from "@/lib/data"
import { formatearCOP, formatearNumero } from "@/lib/format"
import {
  agruparPorDepartamento,
  listarProvincias,
  medianaPorDepartamento,
} from "../_ui/regiones"

export const metadata: Metadata = {
  title: "Provincias",
  description:
    "Las direcciones territoriales de INVIAS por departamento, con la " +
    "mediana de su costo directo de referencia " +
    `(vigencia ${VIGENCIA_ACTUAL}).`,
  alternates: { canonical: "/provincias" },
}

/** URL de referencia para Bogotá D.C. (no negociable 5). */
const URL_IDU = "https://www.idu.gov.co/"

export default async function Page() {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const [stats, provincias] = await Promise.all([
    getStats(),
    listarProvincias(),
  ])
  const departamentos = agruparPorDepartamento(provincias)

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Provincias</h1>
        <p className="text-pretty text-muted-foreground">
          INVIAS regionaliza sus precios en {formatearNumero(provincias.length)}{" "}
          provincias —sus direcciones territoriales— repartidas en{" "}
          {departamentos.length} departamentos. Cada una tiene su propio libro:
          los mismos {formatearNumero(stats.conteos.items)} ítems con precios
          distintos.
        </p>
        <p className="text-sm text-muted-foreground">
          La cifra junto a cada provincia es la mediana de su costo directo
          sobre los {formatearNumero(stats.conteos.items)} ítems. Es una medida
          de dispersión regional, no un precio de mercado ni un índice de costo
          de vida.
        </p>
      </header>

      <section
        aria-label="Mapa de departamentos"
        className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start"
      >
        <div className="space-y-3">
          <h2 className="text-sm font-medium">
            Mediana del costo directo por departamento
          </h2>
          <ColombiaTileMap
            valores={medianaPorDepartamento(provincias)}
            formatear={formatearCOP}
            href={(dane) => `#departamento-${dane}`}
            titulo="Mediana del costo directo por departamento"
          />
        </div>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          Toca un departamento para saltar a sus provincias. La mediana
          departamental resume las medianas de sus provincias: mide dispersión
          regional del costo directo de referencia, sin AIU — no es un precio
          de mercado.
        </p>
      </section>

      <nav aria-label="Departamentos">
        <ul className="flex flex-wrap gap-2">
          {departamentos.map((departamento) => (
            <li key={departamento.codigoDane}>
              <a
                href={`#departamento-${departamento.codigoDane}`}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
              >
                {departamento.departamento}
                <span className="text-muted-foreground tabular-nums">
                  {departamento.provincias.length}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/*
        Los estilos de las 140 filas se declaran una sola vez, aquí arriba:
        repetir `className` en cada `<li>`/`<a>`/`<span>` se paga dos veces (en
        el HTML y otra vez en el payload RSC) y son 140 provincias.
      */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&_li]:flex [&_li]:items-baseline [&_li]:justify-between [&_li]:gap-3 [&_li_a]:underline [&_li_a]:underline-offset-4 [&_li_span]:shrink-0 [&_li_span]:text-xs [&_li_span]:text-muted-foreground [&_li_span]:tabular-nums">
        {departamentos.map((departamento) => (
          <section
            key={departamento.codigoDane}
            id={`departamento-${departamento.codigoDane}`}
            className="scroll-mt-16 rounded-lg border p-4"
          >
            <h2 className="flex items-baseline gap-2 text-sm font-semibold">
              {departamento.departamento}
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {departamento.codigoDane}
              </span>
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {departamento.provincias.map(({ region, mediana }) => (
                <li key={region.slug}>
                  <a href={`/provincias/${region.slug}`}>{region.provincia}</a>
                  <span>{formatearCOP(mediana)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/*
        No negociable 5: Bogotá se representa honestamente. No es un vacío de
        datos ni un pendiente del proyecto — está fuera del alcance de la
        fuente, y quien busca precios para el Distrito Capital debe ir al IDU.
      */}
      <section
        aria-label="Bogotá D.C."
        className="rounded-lg border bg-muted/40 p-4 text-sm"
      >
        <h2 className="font-medium">Bogotá D.C.</h2>
        <p className="mt-1 text-pretty text-muted-foreground">
          Bogotá no aparece en esta lista: INVIAS regionaliza los APU de la red
          vial nacional y el Distrito Capital está fuera de su alcance —no
          existe libro para Bogotá en ninguna vigencia—. La referencia de
          precios unitarios para Bogotá la publica el{" "}
          <a
            href={URL_IDU}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium underline underline-offset-4 hover:text-foreground"
          >
            Instituto de Desarrollo Urbano (IDU)
          </a>
          .
        </p>
      </section>

      <ProcedenciaBox procedencia={stats.procedencia} />
    </main>
  )
}
