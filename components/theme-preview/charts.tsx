"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})

const vigencias = [
  { vigencia: "2022-1", costo: 748_000 },
  { vigencia: "2022-2", costo: 791_000 },
  { vigencia: "2023-1", costo: 842_000 },
  { vigencia: "2023-2", costo: 861_000 },
  { vigencia: "2024-1", costo: 890_000 },
  { vigencia: "2024-2", costo: 918_000 },
  { vigencia: "2025-1", costo: 947_000 },
  { vigencia: "2025-2", costo: 989_000 },
  { vigencia: "2026-1", costo: 1_034_000 },
]

const vigenciaConfig = {
  costo: { label: "Costo directo", color: "var(--chart-1)" },
} satisfies ChartConfig

export function EvolucionChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución por vigencia</CardTitle>
        <CardDescription>Ítem 630.3 · Concreto clase D · COP/m³ · Valle de Aburrá</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={vigenciaConfig} className="h-56 w-full">
          <AreaChart data={vigencias} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="vigencia" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => cop.format(Number(value))}
                  labelFormatter={(label) => `Vigencia ${label}`}
                />
              }
            />
            <Area
              dataKey="costo"
              type="monotone"
              fill="var(--color-costo)"
              fillOpacity={0.25}
              stroke="var(--color-costo)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

const departamentos = [
  { departamento: "Chocó", costo: 1_248_000 },
  { departamento: "Nariño", costo: 1_112_000 },
  { departamento: "Meta", costo: 1_071_000 },
  { departamento: "Santander", costo: 1_048_000 },
  { departamento: "Antioquia", costo: 1_034_000 },
  { departamento: "Valle del Cauca", costo: 992_000 },
]

const departamentoConfig = {
  costo: { label: "Costo directo", color: "var(--chart-2)" },
} satisfies ChartConfig

export function ComparacionChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparación regional</CardTitle>
        <CardDescription>Ítem 630.3 · vigencia 2026-1 · COP/m³</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={departamentoConfig} className="h-56 w-full">
          <BarChart data={departamentos} layout="vertical" margin={{ left: 12, right: 12 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              dataKey="departamento"
              type="category"
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => cop.format(Number(value))} />}
            />
            <Bar dataKey="costo" fill="var(--color-costo)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

const desglose = [
  { componente: "materiales", valor: 641_000, fill: "var(--color-materiales)" },
  { componente: "manoDeObra", valor: 165_000, fill: "var(--color-manoDeObra)" },
  { componente: "equipo", valor: 145_000, fill: "var(--color-equipo)" },
  { componente: "transporte", valor: 83_000, fill: "var(--color-transporte)" },
]

const desgloseConfig = {
  valor: { label: "Valor" },
  materiales: { label: "Materiales", color: "var(--chart-1)" },
  manoDeObra: { label: "Mano de obra", color: "var(--chart-2)" },
  equipo: { label: "Equipo", color: "var(--chart-3)" },
  transporte: { label: "Transporte", color: "var(--chart-4)" },
} satisfies ChartConfig

export function DesgloseChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Desglose del costo directo</CardTitle>
        <CardDescription>Ítem 630.3 · vigencia 2026-1</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={desgloseConfig} className="mx-auto h-56 w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="componente"
                  formatter={(value, name) => (
                    <span className="flex w-full items-center justify-between gap-4">
                      <span>{desgloseConfig[name as keyof typeof desgloseConfig]?.label ?? name}</span>
                      <span className="font-mono">{cop.format(Number(value))}</span>
                    </span>
                  )}
                />
              }
            />
            <Pie data={desglose} dataKey="valor" nameKey="componente" innerRadius={55} strokeWidth={4}>
              {desglose.map((entry) => (
                <Cell key={entry.componente} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="componente" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
