"use client"

/**
 * Sankey de UN APU real: el costo directo se abre en los cuatro componentes
 * (FR-APU-1) y cada componente en sus líneas de mayor subtotal (+ "otras").
 * Es el "qué es un APU" de la portada: un flujo, no una cifra.
 *
 * Los colores por componente son los mismos de la dona, el treemap y las
 * barras de composición (`--chart-1..4`): el color sigue a la entidad.
 *
 * Los nodos y enlaces se construyen aquí a partir de `SankeyComponente[]`
 * (preparado por `prepararSankey`, que es puro y está probado); las props son
 * serializables porque quien renderiza es un Server Component.
 *
 * El nodo y el enlace se dibujan con SVG propio porque esa ES la API de
 * `Sankey` en recharts (como el `content` del treemap): no es un gráfico
 * artesanal, es el renderizador de nodos de la librería.
 */
import { Sankey, Tooltip } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { formatearCOP } from "@/lib/format"
import { COMPONENTES, type Componente } from "@/lib/schema"
import { cn } from "@/lib/utils"

import type { SankeyComponente } from "@/app/_ui/agregados"

export type DesgloseSankeyProps = {
  componentes: SankeyComponente[]
  /** Costo directo declarado en COP (el nodo raíz). */
  costoDirecto: number
  /** Unidad de la obra, p. ej. "m3". */
  unidad: string
  titulo?: string
  descripcion?: string
  className?: string
  altura?: number
}

const config = {
  equipo: { label: "Equipo", color: "var(--chart-1)" },
  materiales: { label: "Materiales", color: "var(--chart-2)" },
  transporte: { label: "Transporte", color: "var(--chart-3)" },
  manoDeObra: { label: "Mano de obra", color: "var(--chart-4)" },
} satisfies ChartConfig

type Nodo = {
  name: string
  /** Nombre completo (el `name` puede ir recortado). */
  completo: string
  componente: Componente | null
  profundidad: 0 | 1 | 2
}

function recortar(texto: string, largo = 26): string {
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto
}

/** Nodos y enlaces del sankey, en el orden FR-APU-1. */
function armar(componentes: SankeyComponente[]) {
  const nodos: Nodo[] = [
    {
      name: "Costo directo",
      completo: "Costo directo",
      componente: null,
      profundidad: 0,
    },
  ]
  const enlaces: Array<{ source: number; target: number; value: number }> = []

  const ordenados = [...componentes].sort(
    (a, b) =>
      COMPONENTES.indexOf(a.componente) - COMPONENTES.indexOf(b.componente)
  )

  for (const grupo of ordenados) {
    const indiceComponente = nodos.length
    nodos.push({
      name: config[grupo.componente].label as string,
      completo: config[grupo.componente].label as string,
      componente: grupo.componente,
      profundidad: 1,
    })
    enlaces.push({
      source: 0,
      target: indiceComponente,
      value: grupo.subtotal,
    })
    for (const linea of grupo.lineas) {
      nodos.push({
        name: recortar(linea.nombre),
        completo: linea.nombre,
        componente: grupo.componente,
        profundidad: 2,
      })
      enlaces.push({
        source: indiceComponente,
        target: nodos.length - 1,
        value: linea.valor,
      })
    }
    if (grupo.otras) {
      nodos.push({
        name: `Otras líneas (${grupo.otras.n})`,
        completo: `Otras ${grupo.otras.n} líneas de ${String(
          config[grupo.componente].label
        ).toLowerCase()}`,
        componente: grupo.componente,
        profundidad: 2,
      })
      enlaces.push({
        source: indiceComponente,
        target: nodos.length - 1,
        value: grupo.otras.valor,
      })
    }
  }

  return { nodos, enlaces }
}

function colorDe(componente: Componente | null): string {
  return componente
    ? config[componente].color!
    : "var(--muted-foreground)"
}

/** Nodo: rectángulo del color del componente + rótulo fuera del flujo. */
function NodoSankey(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: Nodo & { value?: number }
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props
  if (!payload) return null
  const ultimo = payload.profundidad === 2
  const etiquetaX = ultimo ? x - 6 : x + width + 6
  const anchor = ultimo ? "end" : "start"

  return (
    <g>
      <title>
        {payload.completo}
        {payload.value !== undefined
          ? `: ${formatearCOP(payload.value)}`
          : ""}
      </title>
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 1)}
        rx={1.5}
        fill={colorDe(payload.componente)}
      />
      <text
        x={etiquetaX}
        y={y + Math.max(height, 1) / 2}
        textAnchor={anchor}
        dominantBaseline="middle"
        className="fill-foreground text-xs"
      >
        {payload.name}
      </text>
    </g>
  )
}

/** Enlace: curva del color del componente de destino, translúcida. */
function EnlaceSankey(props: {
  sourceX?: number
  sourceY?: number
  sourceControlX?: number
  targetX?: number
  targetY?: number
  targetControlX?: number
  linkWidth?: number
  payload?: { target?: Nodo }
}) {
  const {
    sourceX = 0,
    sourceY = 0,
    sourceControlX = 0,
    targetX = 0,
    targetY = 0,
    targetControlX = 0,
    linkWidth = 0,
    payload,
  } = props

  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={colorDe(payload?.target?.componente ?? null)}
      strokeOpacity={0.3}
      strokeWidth={Math.max(linkWidth, 1)}
    />
  )
}

/** Etiqueta emergente: nombre completo y COP, para nodos y enlaces. */
function EtiquetaSankey({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number
    payload?: {
      payload?: Nodo & {
        source?: Nodo
        target?: Nodo
      }
    }
  }>
}) {
  if (!active || !payload?.length) return null
  const dato = payload[0]
  const carga = dato.payload?.payload
  const nombre = carga?.target
    ? `${carga.source?.completo ?? ""} → ${carga.target.completo}`
    : (carga?.completo ?? dato.name)

  return (
    <div className="max-w-64 rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-md">
      <p className="whitespace-normal">{nombre}</p>
      <p className="mt-0.5 font-mono font-medium tabular-nums">
        {formatearCOP(Number(dato.value))}
      </p>
    </div>
  )
}

export function DesgloseSankey({
  componentes,
  costoDirecto,
  unidad,
  titulo,
  descripcion,
  className,
  altura = 380,
}: DesgloseSankeyProps) {
  const { nodos, enlaces } = armar(componentes)
  if (enlaces.length === 0) return null

  return (
    <figure className={cn("w-full", className)}>
      {titulo || descripcion ? (
        <figcaption className="mb-2 space-y-0.5">
          {titulo ? <p className="text-sm font-medium">{titulo}</p> : null}
          {descripcion ? (
            <p className="text-xs text-muted-foreground">{descripcion}</p>
          ) : null}
        </figcaption>
      ) : null}

      {/* Las etiquetas de las líneas piden ancho: en pantallas estrechas se
          desplaza horizontalmente en vez de aplastar el flujo. */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[560px]">
          <ChartContainer
            config={config}
            className="aspect-auto w-full"
            style={{ height: altura }}
          >
            <Sankey
              data={{ nodes: nodos, links: enlaces }}
              node={<NodoSankey />}
              link={<EnlaceSankey />}
              nodePadding={18}
              nodeWidth={8}
              margin={{ left: 8, right: 12, top: 16, bottom: 16 }}
              sort={false}
            >
              <Tooltip content={<EtiquetaSankey />} />
            </Sankey>
          </ChartContainer>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground tabular-nums">
        Costo directo: {formatearCOP(costoDirecto)}/{unidad}. Sin AIU.
      </p>
    </figure>
  )
}
