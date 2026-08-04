"use client"

/**
 * La isla cliente del hub de provincia: los 526 ítems resueltos en esta
 * provincia, con búsqueda por código o descripción y orden por código o costo.
 *
 * Decisiones (las mismas de la tabla de provincias de un ítem, ver el
 * encabezado de `tabla-provincias.tsx`):
 *
 * - **Sin orden activo, las tablas por capítulo** con su `#capitulo-N`: el
 *   estado inicial es idéntico al de siempre, las fichas de `NavCapitulos`
 *   (servidor, cero JavaScript) siguen aterrizando en su ancla. Ordenar
 *   disuelve los capítulos en una sola tabla plana: "¿cuál es el ítem más caro
 *   de la provincia?" cruza capítulos por definición.
 * - **Filas adelgazadas**: seis campos cortos por fila (ver `FilaItemProvincia`
 *   en la página). Cruzan la frontera servidor→cliente una vez, igual que las
 *   526 de `/buscar`.
 * - **`costoDirecto === 0` se escribe "No aplica"** (FORMATO.md §6.5), nunca
 *   `$ 0`, y al ordenar por costo esas filas van SIEMPRE al final
 *   (`sortUndefined: "last"`).
 * - **Enlaces `next/link`**: ~1.050 por página hacia dos rutas; con
 *   `partialPrefetching` traen dos App Shells compartidos, no 1.050 destinos.
 */
import Link from "next/link"
import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
} from "@tanstack/react-table"

import { CabeceraOrdenable } from "@/components/tabla/cabecera-ordenable"
import { idCapitulo } from "@/app/_ui/capitulos"
import { coincide } from "@/lib/busqueda"
import { formatearCOP, formatearNumero } from "@/lib/format"

/** Una fila del hub: lo mínimo que la tabla necesita, ya con el capítulo
 * constructivo traducido (el artefacto de provincia solo trae el de 3 dígitos). */
export type FilaItemProvincia = {
  codigo: string
  titulo: string
  unidad: string
  capituloNumero: number
  capituloNombre: string
  costoDirecto: number
}

const CLASES_TABLA =
  "w-full min-w-2xl border-collapse text-sm [&_a]:underline [&_a]:underline-offset-4 [&_td]:border-t [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_td_span]:text-muted-foreground [&_td:nth-child(1)]:font-mono [&_td:nth-child(1)]:whitespace-nowrap [&_td:nth-child(4)]:text-right [&_td:nth-child(4)]:tabular-nums [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground [&_th:nth-child(4)]:text-right"

function columnasDe(slug: string): ColumnDef<FilaItemProvincia>[] {
  return [
    {
      id: "codigo",
      accessorFn: (fila) => fila.codigo,
      sortingFn: "alphanumeric",
      header: ({ column }) => (
        <CabeceraOrdenable columna={column} etiqueta="Código" />
      ),
      cell: ({ row }) => (
        <Link href={`/items/${row.original.codigo}/${slug}`}>
          {row.original.codigo}
        </Link>
      ),
    },
    {
      id: "titulo",
      accessorFn: (fila) => fila.titulo,
      sortingFn: (a, b) =>
        a.original.titulo.localeCompare(b.original.titulo, "es"),
      header: ({ column }) => (
        <CabeceraOrdenable columna={column} etiqueta="Ítem" />
      ),
      cell: ({ row }) => (
        <Link href={`/items/${row.original.codigo}`}>
          {row.original.titulo}
        </Link>
      ),
    },
    {
      id: "unidad",
      enableSorting: false,
      header: () => "Unidad",
      cell: ({ row }) => row.original.unidad,
    },
    {
      id: "costoDirecto",
      accessorFn: (fila) =>
        fila.costoDirecto > 0 ? fila.costoDirecto : undefined,
      sortUndefined: "last",
      header: ({ column }) => (
        <CabeceraOrdenable
          columna={column}
          etiqueta="Costo directo"
          className="-mr-3 ml-0"
        />
      ),
      cell: ({ row }) =>
        row.original.costoDirecto > 0 ? (
          formatearCOP(row.original.costoDirecto)
        ) : (
          <span>No aplica</span>
        ),
    },
  ]
}

export function TablaItemsProvincia({
  filas,
  slug,
  provincia,
}: {
  /** En orden capítulo → catálogo: es el orden del estado inicial agrupado. */
  filas: FilaItemProvincia[]
  slug: string
  provincia: string
}) {
  const columnas = useMemo(() => columnasDe(slug), [slug])

  const [texto, setTexto] = useState("")
  const [orden, setOrden] = useState<SortingState>([])

  const tabla = useReactTable({
    data: filas,
    columns: columnas,
    state: { sorting: orden, globalFilter: texto },
    onSortingChange: setOrden,
    globalFilterFn: (fila, _columna, consulta: string) =>
      coincide(fila.original, consulta),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const visibles = tabla.getRowModel().rows
  const grupos = orden.length === 0 ? porCapitulo(visibles) : null
  const buscando = texto.trim().length > 0

  const cabeceras = (
    <thead>
      {tabla.getHeaderGroups().map((grupo) => (
        <tr key={grupo.id}>
          {grupo.headers.map((cabecera) => (
            <th key={cabecera.id} scope="col">
              {flexRender(
                cabecera.column.columnDef.header,
                cabecera.getContext()
              )}
            </th>
          ))}
        </tr>
      ))}
    </thead>
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="hub-q" className="sr-only">
            Buscar por código o descripción
          </label>
          <input
            id="hub-q"
            type="search"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Buscar: concreto, 630.1.1, excavación…"
            autoComplete="off"
            className="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>
        {buscando ? (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            <span className="tabular-nums">
              {formatearNumero(visibles.length)}
            </span>{" "}
            de{" "}
            <span className="tabular-nums">{formatearNumero(filas.length)}</span>{" "}
            ítems
          </p>
        ) : null}
      </div>

      {visibles.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Ningún ítem coincide con la búsqueda.
        </p>
      ) : grupos ? (
        grupos.map((grupo) => {
          const { capituloNumero, capituloNombre } = grupo[0].original
          return (
            <section
              key={capituloNumero}
              id={idCapitulo(capituloNumero)}
              className="scroll-mt-16 space-y-2"
            >
              <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
                <span className="font-mono text-muted-foreground">
                  {capituloNumero}
                </span>
                {capituloNombre}
                <span className="text-sm font-normal text-muted-foreground tabular-nums">
                  {formatearNumero(grupo.length)} ítems
                </span>
              </h2>

              <div className="overflow-x-auto">
                <table className={CLASES_TABLA}>
                  <caption className="sr-only">
                    Ítems del capítulo {capituloNumero} — {capituloNombre} en{" "}
                    {provincia}. Costo directo de referencia, sin AIU.
                  </caption>
                  {cabeceras}
                  <tbody>
                    {grupo.map((fila) => (
                      <FilaHub key={fila.id} fila={fila} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })
      ) : (
        <div className="overflow-x-auto">
          <table className={CLASES_TABLA}>
            <caption className="sr-only">
              Ítems de pago en {provincia}, ordenados. Costo directo de
              referencia, sin AIU.
            </caption>
            {cabeceras}
            <tbody>
              {visibles.map((fila) => (
                <FilaHub key={fila.id} fila={fila} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FilaHub({ fila }: { fila: Row<FilaItemProvincia> }) {
  return (
    <tr>
      {fila.getVisibleCells().map((celda) => (
        <td key={celda.id}>
          {flexRender(celda.column.columnDef.cell, celda.getContext())}
        </td>
      ))}
    </tr>
  )
}

/**
 * Parte la lista plana (que viene en orden de capítulo) en grupos contiguos.
 * Con el filtro activo, los capítulos sin coincidencias desaparecen con su
 * encabezado.
 */
function porCapitulo(filas: readonly Row<FilaItemProvincia>[]) {
  const grupos: Row<FilaItemProvincia>[][] = []
  let clave: number | null = null
  for (const fila of filas) {
    const numero = fila.original.capituloNumero
    if (numero !== clave) {
      grupos.push([fila])
      clave = numero
    } else {
      grupos[grupos.length - 1].push(fila)
    }
  }
  return grupos
}
