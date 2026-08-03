import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ComparacionChart, DesgloseChart, EvolucionChart } from "@/components/theme-preview/charts"

const kpis = [
  { label: "Costo directo · 630.3", value: "$1.034.000", detail: "COP/m³ · Valle de Aburrá" },
  { label: "Variación vs 2025-2", value: "+4,6 %", detail: "semestre anterior" },
  { label: "Provincias cubiertas", value: "140", detail: "vigencia 2026-1" },
  { label: "Ítems en el libro", value: "812", detail: "muestra Valle de Aburrá" },
]

const items = [
  { codigo: "630.3", descripcion: "Concreto estructural clase D", unidad: "m³", costo: "$1.034.000" },
  { codigo: "640.1", descripcion: "Acero de refuerzo fy 420 MPa", unidad: "kg", costo: "$7.890" },
  { codigo: "450.2P", descripcion: "Mezcla asfáltica en caliente MSC-19", unidad: "m³", costo: "$862.400" },
  { codigo: "600.1", descripcion: "Excavación estructural", unidad: "m³", costo: "$38.200" },
]

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Explorador APU · vista previa del tema
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Precios de referencia INVIAS, legibles
          </h1>
          <p className="text-muted-foreground text-sm">
            Datos de muestra para calibrar el tema. Costos directos de referencia, sin AIU.
          </p>
        </div>
        <div className="text-muted-foreground font-mono text-xs">
          Presiona <kbd className="bg-muted rounded px-1.5 py-0.5">d</kbd> para modo oscuro
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{kpi.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">{kpi.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <EvolucionChart />
        <ComparacionChart />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DesgloseChart />
        <Card>
          <CardHeader>
            <CardTitle>Ítems de muestra</CardTitle>
            <CardDescription>Fuente: INVIAS · vigencia 2026-1 · datos ficticios</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ítem</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Costo directo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.codigo}>
                    <TableCell className="font-mono">{item.codigo}</TableCell>
                    <TableCell>{item.descripcion}</TableCell>
                    <TableCell>{item.unidad}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.costo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Galería de controles</CardTitle>
            <CardDescription>Variantes básicas para evaluar el tema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Buscar ítem</Button>
              <Button variant="secondary">Exportar CSV</Button>
              <Button variant="outline">Comparar regiones</Button>
              <Button variant="ghost">Ver desglose</Button>
              <Button variant="destructive">Eliminar</Button>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-3">
              <Badge>2026-1</Badge>
              <Badge variant="secondary">CC BY-SA 4.0</Badge>
              <Badge variant="outline">Costo directo · sin AIU</Badge>
              <Badge variant="destructive">Sin datos</Badge>
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input placeholder="Buscar: concreto clase D…" />
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="antioquia">Antioquia</SelectItem>
                  <SelectItem value="valle">Valle del Cauca</SelectItem>
                  <SelectItem value="narino">Nariño</SelectItem>
                  <SelectItem value="choco">Chocó</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Switch defaultChecked /> Mostrar procedencia
              </label>
            </div>
            <Separator />
            <Tabs defaultValue="desglose">
              <TabsList>
                <TabsTrigger value="desglose">Desglose</TabsTrigger>
                <TabsTrigger value="insumos">Insumos</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>
              <TabsContent value="desglose" className="text-muted-foreground pt-3 text-sm">
                Equipos, materiales, transporte y mano de obra por ítem.
              </TabsContent>
              <TabsContent value="insumos" className="text-muted-foreground pt-3 text-sm">
                Precios regionales de insumos por vigencia.
              </TabsContent>
              <TabsContent value="historico" className="text-muted-foreground pt-3 text-sm">
                Series de precios entre vigencias (próximamente).
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>

      <footer className="text-muted-foreground pb-4 text-xs">
        Valores ficticios solo para calibrar el tema · Los precios reales llevarán procedencia
        (fuente, vigencia, licencia) en cada número.
      </footer>
    </main>
  )
}
