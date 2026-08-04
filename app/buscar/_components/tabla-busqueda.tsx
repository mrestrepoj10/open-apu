/**
 * La isla cliente de `/buscar`: el buscador, el filtro por capítulo y la tabla.
 *
 * ## La consulta vive en la URL
 *
 * `?q=` y `?cap=` son la fuente de verdad de qué se está buscando, no un estado
 * de React: una búsqueda se puede compartir, marcar y recargar. Se leen con
 * `useSearchParams()` —legal aquí porque la isla se renderiza DENTRO del
 * `<Suspense>` de la ruta, así que el App Shell sigue sin depender de la URL
 * (`adopting-partial-prefetching.md`, «Auditing routes for URL data»).
 *
 * Se escriben con **routing superficial**: `window.history.replaceState` /
 * `pushState` nativos, que Next integra con `useSearchParams` y que NO piden
 * nada al servidor (`single-page-applications.md`, «Shallow routing on the
 * client»). Nada de navegación programática del router: los 526 ítems ya están
 * en el cliente, ir al servidor para filtrarlos sería puro roce.
 *
 * - teclear → `replaceState` con 150 ms de retardo (cada tecla no es un paso
 *   del historial),
 * - cambiar de capítulo → `pushState` (sí es un estado navegable, y el botón
 *   Atrás debe devolver al capítulo anterior),
 * - valor vacío → el parámetro se BORRA de la URL, no se deja como `?q=`.
 *
 * El orden es la excepción: vive en estado del componente, no en la URL. Es
 * preferencia de lectura, no consulta; meterlo en el historial haría que Atrás
 * deshiciera clics en cabeceras.
 *
 * ## Por qué TanStack Table
 *
 * Es headless (~15 kB gz): aporta los modelos de filas —núcleo, filtrado,
 * orden— y nada de marcado. Lo que se pinta son las primitivas `Table` de
 * shadcn que ya estaban instaladas.
 *
 * ## Por qué los dos controles son elementos nativos
 *
 * El `Select` de shadcn (sobre `@base-ui/react`) pesaba 153,9 kB sin comprimir
 * en el bundle de esta ruta —el 63 % de todo lo que `/buscar` añade sobre
 * `/items`— por un desplegable de nueve opciones. Un `<select>` del navegador
 * cuesta cero, ya es accesible y en móvil abre el selector del sistema, que es
 * mejor que cualquier popup. Quitarlo destapó que el `Input` de shadcn, que
 * envuelve `@base-ui/react/input`, seguía arrastrando 36,7 kB del núcleo de
 * base-ui (`Field`, `useRender`, `mergeProps`) por una caja de texto: también
 * es un `<input>` pelado, con las mismas clases. Los dos componentes de shadcn
 * se quedan donde están, `/theme` los usa; lo que no se hace es pagarlos aquí.
 *
 * Los dos cambios juntos bajaron la ruta de 808,2 kB a 666,7 kB sin comprimir
 * (de 249,9 a 204,2 kB gz). Si alguien los reintroduce, que sea a sabiendas.
 *
 * Queda un resto del núcleo de base-ui —`components/ui/button.tsx` envuelve
 * `@base-ui/react/button` y las cabeceras ordenables usan `Button`—, medido en
 * ~15 kB junto con `lib/format`. Es el siguiente hilo del que tirar si esta
 * ruta vuelve a crecer.
 */
"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatearCOP, formatearNumero } from "@/lib/format"

/**
 * Una fila del buscador: el mínimo que la tabla necesita.
 *
 * Es a propósito más pobre que `CatalogoItem`: estas 526 filas cruzan la
 * frontera servidor→cliente en el payload RSC, así que cada campo de más se
 * paga 526 veces. Nada de `descripcion` completa (el alcance son párrafos), ni
 * de `min`/`max`/`promedio`.
 */
export type FilaBusqueda = {
  codigo: string
  titulo: string
  unidad: string
  capitulo: number
  capituloNombre: string
  mediana: number
  provinciasConDato: number
}

/** Valor del `Select` que significa «sin filtro de capítulo». */
const TODOS = "todos"

/** Retardo del `replaceState` mientras se teclea. */
const RETARDO_MS = 150

/**
 * Minúsculas y sin tildes: "Excavación" y "excavacion" deben encontrarse.
 *
 * `NFD` separa la letra de su diacrítico y `\p{Diacritic}` los borra, así que
 * también cae la diéresis y la tilde de la ñ (buscar "muniz" encuentra
 * "Muñiz"). Es un compromiso deliberado: en un catálogo técnico en español
 * pesa más tolerar el teclado sin tildes que distinguir la ñ.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/**
 * ¿La fila coincide con la consulta? Se busca en el código y en el título.
 * Consulta vacía = todo coincide (no es un filtro, es «aún no hay búsqueda»).
 */
export function coincide(
  fila: { codigo: string; titulo: string },
  consulta: string
): boolean {
  const aguja = normalizar(consulta.trim())
  if (!aguja) return true
  return (
    normalizar(fila.codigo).includes(aguja) ||
    normalizar(fila.titulo).includes(aguja)
  )
}

export function TablaBusqueda({
  filas,
  provincias,
}: {
  filas: FilaBusqueda[]
  provincias: number
}) {
  const searchParams = useSearchParams()
  const q = searchParams.get("q") ?? ""
  const cap = searchParams.get("cap")

  /** El `<input>` es controlado por estado local; la URL va detrás. */
  const [texto, setTexto] = useState(q)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Atrás/Adelante cambian `q` sin pasar por el input: hay que sincronizarlo.
  useEffect(() => setTexto(q), [q])

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    },
    []
  )

  const alEscribir = useCallback(
    (valor: string) => {
      setTexto(valor)
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => {
        window.history.replaceState(null, "", urlDe(valor, cap))
      }, RETARDO_MS)
    },
    [cap]
  )

  const alCambiarCapitulo = useCallback(
    (valor: string) => {
      const nuevo = valor === TODOS ? null : valor
      window.history.pushState(null, "", urlDe(texto, nuevo))
    },
    [texto]
  )

  const capitulos = useMemo(() => capitulosDe(filas), [filas])

  const opciones = useMemo(
    () => [
      { value: TODOS, label: "Todos los capítulos" },
      ...capitulos.map((capitulo) => ({
        value: String(capitulo.numero),
        label: `${capitulo.numero} · ${capitulo.nombre}`,
      })),
    ],
    [capitulos]
  )

  const columnas = useMemo<ColumnDef<FilaBusqueda>[]>(
    () => columnasDe(provincias),
    [provincias]
  )

  const [orden, setOrden] = useState<SortingState>([
    { id: "codigo", desc: false },
  ])

  /** El filtro de capítulo lo manda la URL; la tabla solo lo obedece. */
  const filtrosColumna = useMemo<ColumnFiltersState>(
    () => (cap ? [{ id: "capitulo", value: Number(cap) }] : []),
    [cap]
  )

  const tabla = useReactTable({
    data: filas,
    columns: columnas,
    state: { sorting: orden, globalFilter: q, columnFilters: filtrosColumna },
    onSortingChange: setOrden,
    globalFilterFn: (fila, _columna, consulta: string) =>
      coincide(fila.original, consulta),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const visibles = tabla.getRowModel().rows

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="buscar-q" className="sr-only">
            Buscar por código o descripción
          </label>
          <input
            id="buscar-q"
            type="search"
            value={texto}
            onChange={(evento) => alEscribir(evento.target.value)}
            placeholder="Buscar: concreto, 630.1.1, excavación…"
            autoComplete="off"
            className="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>

        <div>
          <label htmlFor="buscar-cap" className="sr-only">
            Filtrar por capítulo
          </label>
          <select
            id="buscar-cap"
            value={cap ?? TODOS}
            onChange={(evento) => alCambiarCapitulo(evento.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            {opciones.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        <span className="tabular-nums">{formatearNumero(visibles.length)}</span>{" "}
        de <span className="tabular-nums">{formatearNumero(filas.length)}</span>{" "}
        ítems
      </p>

      <div className="rounded-lg border">
        <Table>
          <TableCaption className="sr-only">
            Ítems de pago INVIAS que coinciden con la búsqueda. Mediana nacional
            del costo directo, sin AIU.
          </TableCaption>
          <TableHeader>
            {tabla.getHeaderGroups().map((grupo) => (
              <TableRow key={grupo.id}>
                {grupo.headers.map((cabecera) => (
                  <TableHead
                    key={cabecera.id}
                    className={
                      cabecera.column.id === "mediana"
                        ? "text-right"
                        : undefined
                    }
                  >
                    {flexRender(
                      cabecera.column.columnDef.header,
                      cabecera.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnas.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  Ningún ítem coincide con la búsqueda.
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((fila) => (
                <TableRow key={fila.id}>
                  {fila.getVisibleCells().map((celda) => (
                    <TableCell key={celda.id}>
                      {flexRender(
                        celda.column.columnDef.cell,
                        celda.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/** `?q=…&cap=…`, sin los parámetros vacíos. Sin nada, la ruta pelada. */
function urlDe(q: string, cap: string | null): string {
  const params = new URLSearchParams()
  if (q.trim()) params.set("q", q)
  if (cap) params.set("cap", cap)
  const cadena = params.toString()
  return cadena ? `?${cadena}` : window.location.pathname
}

/** Los capítulos presentes en las filas, ordenados por número. */
function capitulosDe(
  filas: readonly FilaBusqueda[]
): Array<{ numero: number; nombre: string }> {
  const mapa = new Map<number, string>()
  for (const fila of filas) {
    if (!mapa.has(fila.capitulo)) mapa.set(fila.capitulo, fila.capituloNombre)
  }
  return [...mapa]
    .map(([numero, nombre]) => ({ numero, nombre }))
    .sort((a, b) => a.numero - b.numero)
}

/**
 * Cabecera que ordena. El icono dice el estado actual (sin orden / ascendente
 * / descendente) y el `aria-label` lo dice en palabras.
 */
function CabeceraOrdenable({
  columna,
  etiqueta,
}: {
  columna: Column<FilaBusqueda, unknown>
  etiqueta: string
}) {
  const sentido = columna.getIsSorted()
  const Icono =
    sentido === "asc"
      ? ArrowUpIcon
      : sentido === "desc"
        ? ArrowDownIcon
        : ArrowUpDownIcon

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => columna.toggleSorting(sentido === "asc")}
      aria-label={`Ordenar por ${etiqueta}${
        sentido === "asc"
          ? " (ascendente)"
          : sentido === "desc"
            ? " (descendente)"
            : ""
      }`}
    >
      {etiqueta}
      <Icono className="text-muted-foreground" aria-hidden="true" />
    </Button>
  )
}

/**
 * Las columnas. Solo `codigo` participa en el filtro global —la función mira
 * `row.original` entera— para que no se evalúe una vez por columna y fila.
 */
function columnasDe(provincias: number): ColumnDef<FilaBusqueda>[] {
  return [
    {
      accessorKey: "codigo",
      sortingFn: "alphanumeric",
      header: ({ column }) => (
        <CabeceraOrdenable columna={column} etiqueta="Código" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/items/${row.original.codigo}`}
          className="font-mono underline underline-offset-4"
        >
          {row.original.codigo}
        </Link>
      ),
    },
    {
      accessorKey: "titulo",
      header: () => "Ítem",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <span className="whitespace-normal">{row.original.titulo}</span>
      ),
    },
    {
      accessorKey: "unidad",
      header: () => "Unidad",
      enableGlobalFilter: false,
      enableSorting: false,
    },
    {
      accessorKey: "capitulo",
      filterFn: "equals",
      enableGlobalFilter: false,
      enableSorting: false,
      header: () => "Capítulo",
      cell: ({ row }) => (
        <span className="whitespace-normal">{row.original.capituloNombre}</span>
      ),
    },
    {
      accessorKey: "mediana",
      enableGlobalFilter: false,
      header: ({ column }) => (
        <div className="text-right">
          <CabeceraOrdenable columna={column} etiqueta="Mediana nacional" />
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatearCOP(row.original.mediana)}
          {row.original.provinciasConDato < provincias ? (
            <span className="block text-xs font-normal whitespace-normal text-muted-foreground">
              no aplica en todas:{" "}
              {formatearNumero(row.original.provinciasConDato)} provincias con
              dato
            </span>
          ) : null}
        </div>
      ),
    },
  ]
}
