"use client"

/**
 * Tabla de las 140 provincias para un ítem, ahora interactiva: buscar una
 * provincia o departamento y ordenar por cualquier componente del costo.
 *
 * Decisiones:
 *
 * - **Isla cliente con TanStack Table** (headless, ~15 kB gz, ya en el bundle
 *   de `/buscar`). Sigue siendo HTML del servidor en la primera pintura —los
 *   componentes cliente se prerrenderizan— así que los números siguen en el
 *   HTML estático (SEO, lectores sin JavaScript); lo que se paga es que las
 *   140 filas cruzan además como props en el payload RSC. Son siete campos
 *   cortos por fila: el mismo orden de magnitud que las 526 de `/buscar`.
 * - **Los controles son elementos nativos** (`<input type="search">`), no los
 *   `Input`/`Select` de shadcn: el porqué, medido, está en el encabezado de
 *   `tabla-busqueda.tsx`.
 * - **Sin orden activo, la tabla se agrupa por departamento** con la fila de
 *   encabezado que da el ancla `#depto-XX` a la que apunta el mapa de teselas
 *   (el estado inicial es idéntico al de siempre, así que los enlaces del mapa
 *   siguen aterrizando). Al ordenar por una columna la agrupación se disuelve
 *   en una lista plana —mezclar departamentos es el punto de ordenar— y el
 *   departamento pasa a leerse junto al nombre de la provincia, porque media
 *   docena de provincias se llaman "Norte" o "Sur" y solas no dicen nada.
 * - **`costoDirecto === 0` se escribe "No aplica"**, nunca `$ 0` (FORMATO.md
 *   §6.5), esas filas no enlazan al desglose, y al ordenar quedan SIEMPRE al
 *   final (`sortUndefined: "last"`): un "no aplica" no es un precio barato.
 * - **Enlaces `next/link`**: son 280 y apuntan a dos rutas; con
 *   `partialPrefetching` traen dos App Shells compartidos, no 280 destinos.
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
import { coincideEn } from "@/lib/busqueda"
import { formatearNumero } from "@/lib/format"
import type { ItemRegion } from "@/lib/schema"

import { formatearPrecio } from "./formato"
import { Tabla } from "./tabla"

const CLASES = [
  // Alineación numérica de todas las columnas salvo la primera (provincia).
  "[&_th:nth-child(n+2)]:text-right [&_td:nth-child(n+2)]:text-right",
  "[&_td:nth-child(n+2)]:tabular-nums",
  // Costo directo: la cifra que el usuario viene a buscar.
  "[&_td:nth-child(6)]:font-medium [&_td:nth-child(6)]:whitespace-nowrap",
  // Encabezado de grupo (departamento).
  "[&_tbody_th]:bg-muted/30 [&_tbody_th]:text-left [&_tbody_th]:scroll-mt-4",
  // Los cuatro componentes son detalle: en pantallas estrechas estorban.
  // Siguen en el HTML (SEO, copiar/pegar), solo se ocultan visualmente.
  "max-md:[&_th:nth-child(n+2):nth-child(-n+5)]:hidden",
  "max-md:[&_td:nth-child(n+2):nth-child(-n+5)]:hidden",
].join(" ")

/** Agrupa las regiones por departamento, ordenadas por nombre (es-CO). */
function porDepartamento(regiones: readonly ItemRegion[]) {
  const grupos = new Map<string, ItemRegion[]>()
  for (const fila of regiones) {
    const clave = fila.region.codigoDane
    const lista = grupos.get(clave)
    if (lista) lista.push(fila)
    else grupos.set(clave, [fila])
  }
  return [...grupos.values()]
    .map((filas) =>
      filas.sort((a, b) =>
        a.region.provincia.localeCompare(b.region.provincia, "es")
      )
    )
    .sort((a, b) =>
      a[0].region.departamento.localeCompare(b[0].region.departamento, "es")
    )
}

/**
 * Un componente del costo, o `undefined` cuando el ítem no aplica en la
 * región: `sortUndefined: "last"` es lo que manda esas filas al final del
 * orden, suban o bajen los precios.
 */
function valorOrdenable(fila: ItemRegion, valor: number): number | undefined {
  return fila.costoDirecto > 0 ? valor : undefined
}

function columnasDe(codigo: string): ColumnDef<ItemRegion>[] {
  const numerica = (
    id: string,
    etiqueta: string,
    valor: (fila: ItemRegion) => number
  ): ColumnDef<ItemRegion> => ({
    id,
    accessorFn: (fila) => valorOrdenable(fila, valor(fila)),
    sortUndefined: "last",
    header: ({ column }) => (
      <CabeceraOrdenable
        columna={column}
        etiqueta={etiqueta}
        className="-mr-3 ml-0"
      />
    ),
    cell: ({ row }) =>
      row.original.costoDirecto > 0 ? formatearPrecio(valor(row.original)) : "—",
  })

  return [
    {
      id: "provincia",
      accessorFn: (fila) => fila.region.provincia,
      sortingFn: (a, b) =>
        a.original.region.provincia.localeCompare(
          b.original.region.provincia,
          "es"
        ),
      header: ({ column }) => (
        <CabeceraOrdenable columna={column} etiqueta="Provincia" />
      ),
      cell: ({ row, table }) => (
        <>
          <Link href={`/provincias/${row.original.region.slug}`}>
            {row.original.region.provincia}
          </Link>
          {table.getState().sorting.length > 0 ? (
            // Sin la fila de departamento, "Norte" o "Sur" no dicen nada.
            <span className="text-xs text-muted-foreground">
              , {row.original.region.departamento}
            </span>
          ) : null}
        </>
      ),
    },
    numerica("equipo", "Equipo", (fila) => fila.totales.equipo),
    numerica("materiales", "Materiales", (fila) => fila.totales.materiales),
    numerica("transporte", "Transporte", (fila) => fila.totales.transporte),
    numerica("manoDeObra", "Mano de obra", (fila) => fila.totales.manoDeObra),
    {
      id: "costoDirecto",
      accessorFn: (fila) => valorOrdenable(fila, fila.costoDirecto),
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
          formatearPrecio(row.original.costoDirecto)
        ) : (
          <span className="font-normal text-muted-foreground">No aplica</span>
        ),
    },
    {
      id: "acciones",
      enableSorting: false,
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) =>
        row.original.costoDirecto > 0 ? (
          // El nombre accesible va en `aria-label` y no en un
          // `<span class="sr-only">`: 140 elementos extra pesan el doble en la
          // carga RSC embebida que en el HTML.
          <Link
            href={`/items/${codigo}/${row.original.region.slug}`}
            aria-label={`Desglose de ${codigo} en ${row.original.region.provincia}`}
          >
            Desglose
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]
}

export function TablaProvincias({
  codigo,
  unidad,
  regiones,
}: {
  codigo: string
  unidad: string
  regiones: ItemRegion[]
}) {
  // El orden de los datos ES el orden del estado inicial (departamentos y
  // provincias alfabéticos): así, sin orden activo, el modelo de filas sale en
  // el orden agrupado y solo hay que insertar los encabezados de departamento.
  const datos = useMemo(() => porDepartamento(regiones).flat(), [regiones])
  const columnas = useMemo(() => columnasDe(codigo), [codigo])

  const [texto, setTexto] = useState("")
  const [orden, setOrden] = useState<SortingState>([])

  const tabla = useReactTable({
    data: datos,
    columns: columnas,
    state: { sorting: orden, globalFilter: texto },
    onSortingChange: setOrden,
    globalFilterFn: (fila, _columna, consulta: string) =>
      coincideEn(
        [fila.original.region.provincia, fila.original.region.departamento],
        consulta
      ),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const visibles = tabla.getRowModel().rows
  // Ordenar disuelve los grupos: mezclar departamentos es el punto de ordenar.
  // El ancla `#depto-XX` del mapa vive en el estado inicial, que es el que
  // recibe la navegación.
  const grupos = orden.length === 0 ? porGrupoDeFilas(visibles) : null
  const buscando = texto.trim().length > 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="provincias-q" className="sr-only">
            Buscar provincia o departamento
          </label>
          <input
            id="provincias-q"
            type="search"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Buscar provincia o departamento…"
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
            <span className="tabular-nums">
              {formatearNumero(regiones.length)}
            </span>{" "}
            provincias
          </p>
        ) : null}
      </div>

      <Tabla className={CLASES}>
        <caption className="sr-only">
          Costo directo de referencia del ítem {codigo} en las {regiones.length}{" "}
          provincias INVIAS, en pesos colombianos por {unidad}. Sin AIU.
        </caption>
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
        {visibles.length === 0 ? (
          <tbody>
            <tr>
              <td
                colSpan={columnas.length}
                className="py-8 text-center text-muted-foreground"
              >
                Ninguna provincia coincide con la búsqueda.
              </td>
            </tr>
          </tbody>
        ) : grupos ? (
          grupos.map((grupo) => (
            <tbody key={grupo[0].original.region.codigoDane}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={columnas.length}
                  id={`depto-${grupo[0].original.region.codigoDane}`}
                >
                  {grupo[0].original.region.departamento}
                </th>
              </tr>
              {grupo.map((fila) => (
                <FilaProvincia key={fila.id} fila={fila} />
              ))}
            </tbody>
          ))
        ) : (
          <tbody>
            {visibles.map((fila) => (
              <FilaProvincia key={fila.id} fila={fila} />
            ))}
          </tbody>
        )}
      </Tabla>
    </div>
  )
}

function FilaProvincia({ fila }: { fila: Row<ItemRegion> }) {
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
 * Parte la lista plana (que viene en orden departamento → provincia) en grupos
 * contiguos por departamento. Con el filtro activo, los departamentos sin
 * coincidencias desaparecen con su encabezado.
 */
function porGrupoDeFilas(filas: readonly Row<ItemRegion>[]) {
  const grupos: Row<ItemRegion>[][] = []
  let clave: string | null = null
  for (const fila of filas) {
    const dane = fila.original.region.codigoDane
    if (dane !== clave) {
      grupos.push([fila])
      clave = dane
    } else {
      grupos[grupos.length - 1].push(fila)
    }
  }
  return grupos
}
