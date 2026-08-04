/**
 * Cabecera y pie del sitio: el marco que envuelve todas las rutas.
 *
 * Carpeta privada (`_ui`): el guion bajo la saca del sistema de rutas, así que
 * estos archivos se pueden colocar dentro de `app/` sin crear URLs.
 *
 * Todo es servidor. Los enlaces de navegación son `next/link` con el prefetch
 * por defecto: con prefetch parcial cada uno trae el App Shell de su ruta, que
 * es contenido compartido y ya cacheado, y la navegación entre secciones se
 * nota.
 *
 * La excepción es `/theme`: es una página de pruebas de estilos, nadie llega a
 * ella desde el pie y su shell son 5,7 kB comprimidos que se pagarían en las
 * 4.909 páginas del sitio. `prefetch={false}`.
 */
import Link from "next/link"

import { ETIQUETA_VIGENCIA, getStats, VIGENCIA_ACTUAL } from "@/lib/data"
import { formatearFecha } from "@/lib/format"
import { NOTA_COSTO_DIRECTO } from "@/lib/schema"
import { cacheLife, cacheTag } from "next/cache"

const NAVEGACION = [
  { href: "/", etiqueta: "Inicio" },
  { href: "/items", etiqueta: "Ítems" },
  { href: "/provincias", etiqueta: "Provincias" },
] as const

export function Encabezado() {
  return (
    <header className="sticky top-0 z-10 border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          Explorador APU
        </Link>

        <nav aria-label="Principal">
          <ul className="flex items-center gap-4 text-sm text-muted-foreground">
            {NAVEGACION.map((entrada) => (
              <li key={entrada.href}>
                <Link
                  href={entrada.href}
                  className="hover:text-foreground hover:underline hover:underline-offset-4"
                >
                  {entrada.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <span
          className="ml-auto rounded-full border px-2 py-0.5 font-mono text-xs text-muted-foreground tabular-nums"
          title={`Vigencia INVIAS ${VIGENCIA_ACTUAL}`}
        >
          INVIAS {VIGENCIA_ACTUAL}
        </span>
      </div>
    </header>
  )
}

/**
 * Pie con la procedencia global del sitio (no negociable 1: el número y su
 * fuente viajan juntos, también cuando el número está en otra página).
 *
 * Es `async` + `"use cache"` porque lee la procedencia del artefacto en vez de
 * repetirla a mano: si cambia la vigencia o la fecha de descarga, el pie cambia
 * solo. Al estar cacheado entra en el shell estático del layout.
 */
export async function PieDePagina() {
  "use cache"
  cacheLife("max")
  cacheTag(ETIQUETA_VIGENCIA)

  const { procedencia } = await getStats()

  return (
    <footer className="mt-16 border-t border-border/80">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-xs text-muted-foreground sm:px-6">
        <p>
          Datos:{" "}
          <a
            href={procedencia.url}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium underline underline-offset-2 hover:text-foreground"
          >
            {procedencia.fuente} — APU regionalizados de referencia
          </a>
          , vigencia {procedencia.vigencia}. Descargado el{" "}
          <time dateTime={procedencia.fechaDescarga}>
            {formatearFecha(procedencia.fechaDescarga)}
          </time>
          .
        </p>
        <p className="text-foreground/80">{NOTA_COSTO_DIRECTO}</p>
        <p>
          Código MIT · Datos: ver procedencia ·{" "}
          <Link
            href="/theme"
            prefetch={false}
            className="underline underline-offset-2 hover:text-foreground"
          >
            tema
          </Link>
        </p>
      </div>
    </footer>
  )
}
