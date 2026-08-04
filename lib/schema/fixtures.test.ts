/**
 * Valida las fixtures de `data/samples/` contra el esquema.
 *
 * Los tests SÍ pueden usar APIs de Bun; `lib/schema/*` (el código fuente) no.
 */
import { describe, expect, test } from "bun:test"
import {
  ApuCoherenteSchema,
  ListaInsumosSchema,
  SCHEMA_VERSION,
  revisarCoherencia,
  type Apu,
  type ListaInsumos,
} from "./index"

const SAMPLES = new URL("../../data/samples/", import.meta.url)

async function leerFixture(nombre: string): Promise<unknown> {
  return await Bun.file(new URL(nombre, SAMPLES)).json()
}

const FIXTURES_APU = [
  "apu-630-1-1-antioquia-valle-de-aburra.json",
  "apu-320-1-1-atlantico-norte.json",
  "apu-minimo-201-12-caqueta.json",
]

describe("fixtures de APU", () => {
  for (const nombre of FIXTURES_APU) {
    test(`${nombre} valida y cuadra aritméticamente`, async () => {
      const crudo = await leerFixture(nombre)
      const apu: Apu = ApuCoherenteSchema.parse(crudo)

      expect(apu.schemaVersion).toBe(SCHEMA_VERSION)
      expect(apu.lineas.length).toBeGreaterThan(0)
      expect(revisarCoherencia(apu)).toEqual([])
      // Toda cifra visible lleva procedencia (no negociable 1).
      expect(apu.procedencia.fuente).toBe("INVIAS")
      expect(apu.procedencia.vigencia).toBe(apu.vigencia)
      expect(apu.procedencia.licencia.length).toBeGreaterThan(0)
    })
  }

  test("el APU completo cubre los cuatro componentes", async () => {
    const apu = ApuCoherenteSchema.parse(
      await leerFixture("apu-630-1-1-antioquia-valle-de-aburra.json")
    )
    const componentes = new Set(apu.lineas.map((linea) => linea.componente))
    expect([...componentes].sort()).toEqual([
      "equipo",
      "manoDeObra",
      "materiales",
      "transporte",
    ])

    const herramienta = apu.lineas.find((l) => l.codigo === "HERMENINV")
    expect(herramienta?.porcentaje).toBe(0.05)
    expect(herramienta?.base).toBe(apu.totales.manoDeObra)

    const acarreo = apu.lineas.find((l) => l.componente === "transporte")
    expect(acarreo?.distancia).toBe(5)
  })

  test("el APU mínimo trae solo lo obligatorio", async () => {
    const apu = ApuCoherenteSchema.parse(
      await leerFixture("apu-minimo-201-12-caqueta.json")
    )
    expect(apu.capitulo).toBeUndefined()
    expect(apu.articulo).toBeUndefined()
    expect(apu.lineas).toHaveLength(1)
    expect(apu.lineas[0]!.codigo).toBeUndefined()
    expect(apu.totales.equipo).toBe(0)
  })
})

describe("fixture de insumos", () => {
  test("el listado valida y cada insumo es autodescriptivo", async () => {
    const lista: ListaInsumos = ListaInsumosSchema.parse(
      await leerFixture("insumos-antioquia-valle-de-aburra.json")
    )

    expect(lista.schemaVersion).toBe(SCHEMA_VERSION)
    expect(lista.insumos.length).toBeGreaterThan(0)
    for (const insumo of lista.insumos) {
      expect(insumo.region.codigo).toBe(lista.region.codigo)
      expect(insumo.procedencia.vigencia).toBe(lista.procedencia.vigencia)
      expect(insumo.precio).toBeGreaterThan(0)
    }

    const componentes = new Set(lista.insumos.map((i) => i.componente))
    expect(componentes.size).toBe(4)
  })
})
