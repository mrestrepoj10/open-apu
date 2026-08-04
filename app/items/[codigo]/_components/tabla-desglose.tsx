"use client"

/**
 * Una sección del desglose de un APU: las líneas de un componente y su
 * subtotal, con la forma del formato FR-APU-1. Los rótulos por componente (y el
 * porqué de cada encabezado de columna) viven en `desglose-config.ts`, que
 * también lee la página del desglose en el servidor.
 *
 * Es una isla cliente con TanStack Table para poder ordenar las líneas por
 * cantidad, precio o subtotal (en materiales de una docena de líneas, "¿cuál
 * pesa más?" es la pregunta natural). Sin orden activo las líneas salen en el
 * orden del formato fuente (`orden`), que es el estado inicial y el que se
 * prerrenderiza: los números siguen en el HTML del servidor.
 *
 * Sin buscador: son tablas de 1 a ~15 líneas y un control de búsqueda por
 * tabla sería más ruido que ayuda.
 *
 * La columna de participación no ordena a propósito: es `subtotal ÷ costo
 * directo`, ordenarla sería ordenar por subtotal con otro nombre.
 */
import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"

import { CabeceraOrdenable } from "@/components/tabla/cabecera-ordenable"
import { formatearPorcentaje } from "@/lib/format"
import type { Componente } from "@/lib/schema"
import type { LineaDesglose } from "@/lib/data"

import { CONFIG, type Config } from "./desglose-config"
import { formatearCantidad, formatearPrecio } from "./formato"
import { Tabla } from "./tabla"

const CLASES = [
  "[&_th:nth-child(n+3)]:text-right [&_td:nth-child(n+3)]:text-right",
  "[&_td:nth-child(n+3)]:tabular-nums [&_td:nth-child(n+3)]:whitespace-nowrap",
  "[&_tfoot_td:last-child]:tabular-nums",
].join(" ")

function columnasDe(
  config: Config,
  costoDirecto: number | undefined
): ColumnDef<LineaDesglose>[] {
  const columnas: ColumnDef<LineaDesglose>[] = [
    {
      id: "insumo",
      accessorFn: (linea) => linea.descripcion,
      sortingFn: (a, b) =>
        a.original.descripcion.localeCompare(b.original.descripcion, "es"),
      header: ({ column }) => (
        <CabeceraOrdenable columna={column} etiqueta={config.insumo} />
      ),
      cell: ({ row }) => <CeldaInsumo linea={row.original} />,
    },
    {
      id: "unidad",
      enableSorting: false,
      header: () => "Unidad",
      cell: ({ row }) => (
        <>
          {row.original.unidad}
          {row.original.unidadCruda &&
          row.original.unidadCruda !== row.original.unidad ? (
            <span
              className="ml-1 text-xs text-muted-foreground"
              title={`En el archivo fuente: «${row.original.unidadCruda}»`}
            >
              ({row.original.unidadCruda})
            </span>
          ) : null}
        </>
      ),
    },
    {
      id: "cantidad",
      accessorFn: (linea) => linea.cantidad,
      header: ({ column }) => (
        <CabeceraOrdenable
          columna={column}
          etiqueta={config.cantidad}
          className="-mr-3 ml-0"
        />
      ),
      // Herramienta menor y similares: `cantidad` es una fracción del subtotal
      // de mano de obra, no un rendimiento. Se lee como porcentaje o no se
      // entiende.
      cell: ({ row }) =>
        row.original.porcentaje !== undefined
          ? formatearPorcentaje(row.original.porcentaje)
          : formatearCantidad(row.original.cantidad),
    },
  ]

  if (config.distancia) {
    columnas.push({
      id: "distancia",
      accessorFn: (linea) => linea.distancia,
      sortUndefined: "last",
      header: ({ column }) => (
        <CabeceraOrdenable
          columna={column}
          etiqueta="Distancia (km)"
          className="-mr-3 ml-0"
        />
      ),
      cell: ({ row }) =>
        row.original.distancia !== undefined
          ? formatearCantidad(row.original.distancia)
          : "—",
    })
  }

  columnas.push(
    {
      id: "precio",
      accessorFn: (linea) => linea.precioUnitario,
      header: ({ column }) => (
        <CabeceraOrdenable
          columna={column}
          etiqueta={config.precio}
          className="-mr-3 ml-0"
        />
      ),
      cell: ({ row }) => (
        <span
          title={
            row.original.porcentaje !== undefined
              ? "Base: subtotal de mano de obra"
              : undefined
          }
        >
          {formatearPrecio(row.original.precioUnitario)}
        </span>
      ),
    },
    {
      id: "subtotal",
      accessorFn: (linea) => linea.subtotal,
      header: ({ column }) => (
        <CabeceraOrdenable
          columna={column}
          etiqueta="Subtotal"
          className="-mr-3 ml-0"
        />
      ),
      cell: ({ row }) => formatearPrecio(row.original.subtotal),
    }
  )

  if (costoDirecto !== undefined) {
    columnas.push({
      id: "participacion",
      enableSorting: false,
      header: () => "Participación",
      cell: ({ row }) => (
        <CeldaParticipacion
          subtotal={row.original.subtotal}
          costoDirecto={costoDirecto}
        />
      ),
    })
  }

  return columnas
}

export function TablaDesglose({
  componente,
  lineas,
  subtotal,
  costoDirecto,
}: {
  componente: Componente
  lineas: LineaDesglose[]
  subtotal: number
  costoDirecto: number
}) {
  const config = CONFIG[componente]
  const conParticipacion = costoDirecto > 0

  const columnas = useMemo(
    () => columnasDe(config, conParticipacion ? costoDirecto : undefined),
    [config, conParticipacion, costoDirecto]
  )
  const [orden, setOrden] = useState<SortingState>([])

  const tabla = useReactTable({
    data: lineas,
    columns: columnas,
    state: { sorting: orden },
    onSortingChange: setOrden,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <section aria-label={config.titulo} className="space-y-2">
      <h3 className="text-base font-medium">{config.titulo}</h3>

      <Tabla className={CLASES}>
        <caption className="sr-only">
          Líneas de {config.titulo} del análisis de precios unitarios, en pesos
          colombianos. Costo directo, sin AIU.
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
        <tbody>
          {lineas.length === 0 ? (
            <tr>
              <td
                colSpan={columnas.length}
                className="text-muted-foreground italic"
              >
                Sin líneas en esta sección
              </td>
            </tr>
          ) : (
            tabla.getRowModel().rows.map((fila) => (
              <tr key={fila.id}>
                {fila.getVisibleCells().map((celda) => (
                  <td key={celda.id}>
                    {flexRender(celda.column.columnDef.cell, celda.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={columnas.length - (conParticipacion ? 2 : 1)}>
              Subtotal {config.titulo}
            </td>
            <td className="text-right whitespace-nowrap">
              {formatearPrecio(subtotal)}
            </td>
            {conParticipacion ? (
              <td className="text-right whitespace-nowrap">
                {formatearPorcentaje(subtotal / costoDirecto)}
              </td>
            ) : null}
          </tr>
        </tfoot>
      </Tabla>

      {config.nota ? (
        <p className="text-xs text-muted-foreground">{config.nota}</p>
      ) : null}
    </section>
  )
}

/** Descripción de la línea con sus anotaciones (código, porcentaje, jornal). */
function CeldaInsumo({ linea }: { linea: LineaDesglose }) {
  return (
    <div className="max-w-[28rem] text-wrap whitespace-normal">
      {linea.descripcion}
      {linea.codigo ? (
        <span className="ml-1.5 font-mono text-xs text-muted-foreground">
          {linea.codigo}
        </span>
      ) : null}
      {linea.porcentaje !== undefined ? (
        <span className="block text-xs text-muted-foreground">
          Porcentaje del subtotal de mano de obra.
        </span>
      ) : null}
      {linea.jornal !== undefined ? (
        <span className="block text-xs text-muted-foreground tabular-nums">
          Jornal base {formatearPrecio(linea.jornal)}
          {linea.factorPrestacional !== undefined
            ? ` · factor prestacional ${formatearCantidad(linea.factorPrestacional)}`
            : ""}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Porcentaje del costo directo con su mini-barra. La barra usa el primer color
 * de la rampa de gráficos (`--chart-1`), no un ámbar suelto: es el mismo
 * sistema de tonos que la dona y el treemap de la misma página.
 */
function CeldaParticipacion({
  subtotal,
  costoDirecto,
}: {
  subtotal: number
  costoDirecto: number
}) {
  if (subtotal === 0) return <span className="text-muted-foreground">—</span>

  return (
    <>
      <span className="whitespace-nowrap tabular-nums">
        {formatearPorcentaje(subtotal / costoDirecto)}
      </span>
      <div className="mt-1 h-1.5 w-full max-w-24 rounded-full bg-muted">
        <div
          aria-hidden="true"
          className="h-1.5 rounded-full bg-(--chart-1)"
          style={{
            width: `${Math.min(100, (subtotal / costoDirecto) * 100)}%`,
          }}
        />
      </div>
    </>
  )
}
