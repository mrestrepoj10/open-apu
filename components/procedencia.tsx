/**
 * Procedencia — de dónde salió el número, de cuándo es y bajo qué licencia.
 *
 * Es el componente que hace cumplir el no negociable 1 de AGENTS.md: todo
 * número que ve un usuario carga su procedencia. Y el no negociable 2: los
 * precios son costo directo de referencia (sin AIU), nunca precios de mercado
 * — por eso `NOTA_COSTO_DIRECTO` va siempre, no como prop opcional.
 *
 * Componente de servidor: cero JavaScript en el cliente. Aparece en todas las
 * superficies de precio, así que es visualmente discreto (tarjeta apagada,
 * texto pequeño) pero siempre legible: nada de `opacity` ni de esconderlo tras
 * un acordeón.
 */
import Link from "next/link"

import { NOTA_COSTO_DIRECTO, type Procedencia } from "@/lib/schema"
import { formatearFecha } from "@/lib/format"
import { cn } from "@/lib/utils"

type ProcedenciaProps = {
  procedencia: Procedencia
  className?: string
}

function Fuente({ procedencia }: { procedencia: Procedencia }) {
  return (
    <a
      href={procedencia.url}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium underline underline-offset-2 hover:text-foreground"
    >
      {procedencia.fuente}
    </a>
  )
}

/**
 * Caja completa: la forma canónica. Va debajo de la tabla / gráfico de precios.
 */
export function ProcedenciaBox({ procedencia, className }: ProcedenciaProps) {
  return (
    <section
      aria-label="Procedencia del dato"
      className={cn(
        "rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground",
        className
      )}
    >
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-medium">Fuente:</dt>
          <dd className="min-w-0">
            <Fuente procedencia={procedencia} />
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-medium">Vigencia:</dt>
          <dd className="tabular-nums">{procedencia.vigencia}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-medium">Descargado:</dt>
          <dd>
            <time dateTime={procedencia.fechaDescarga}>
              {formatearFecha(procedencia.fechaDescarga)}
            </time>
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-medium">Licencia:</dt>
          <dd className="min-w-0">{procedencia.licencia}</dd>
        </div>
        {procedencia.archivo ? (
          <div className="flex gap-1.5 sm:col-span-2">
            <dt className="shrink-0 font-medium">Archivo:</dt>
            <dd className="min-w-0 font-mono break-all">
              {procedencia.archivo}
            </dd>
          </div>
        ) : null}
      </dl>

      {/*
        La advertencia decía qué NO es el número y dejaba al lector ahí. El
        enlace es la salida: `/aiu` explica por qué la fuente publica el bloque
        vacío y ofrece la calculadora para poner el propio.
      */}
      <p className="mt-2.5 border-t border-border/60 pt-2.5 text-foreground/80">
        {NOTA_COSTO_DIRECTO}{" "}
        <Link
          href="/aiu"
          className="font-medium underline underline-offset-2 hover:text-foreground"
        >
          ¿Qué es el AIU?
        </Link>
      </p>

      {procedencia.nota ? <p className="mt-1.5">{procedencia.nota}</p> : null}
    </section>
  )
}

/**
 * Variante en línea: una sola línea para cabeceras, celdas de tabla o tarjetas
 * de listado donde no cabe la caja. Mantiene la advertencia de costo directo,
 * abreviada en el texto visible y completa en el `title`.
 */
export function ProcedenciaBadge({ procedencia, className }: ProcedenciaProps) {
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground",
        className
      )}
      aria-label="Procedencia del dato"
    >
      <Fuente procedencia={procedencia} />
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">Vigencia {procedencia.vigencia}</span>
      <span aria-hidden="true">·</span>
      <span>{procedencia.licencia}</span>
      <span aria-hidden="true">·</span>
      <span className="text-foreground/80" title={NOTA_COSTO_DIRECTO}>
        Costo directo, sin AIU
      </span>
    </p>
  )
}
