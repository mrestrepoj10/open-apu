/**
 * Pruebas del parser contra el extracto real `data/samples/sample-provincia.xlsx`.
 *
 * `node:fs` se usa **solo aquí**: el parser recibe bytes y no toca el sistema de
 * archivos, para que el mismo código sirva en el navegador.
 *
 * Los goldens de `__goldens__/` se regeneran con `bun scripts/make-goldens.ts`.
 * Si un golden cambia, cambió lo que el proyecto publica: hay que revisarlo.
 */
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  ApuCoherenteSchema,
  ApuSchema,
  ListaInsumosSchema,
  revisarCoherencia,
  type Apu,
} from "../schema"
import {
  HOJA_INDICE,
  HOJA_PORTADA,
  ITEMS_ESPERADOS,
  ParserError,
  TOLERANCIA_INVIAS,
  abrirLibro,
  parseIndice,
  parseInsumos,
  parseItem,
  parsePortada,
  parseReferenciaSalarial,
  parseRegion,
  verificarEstructura,
  type Libro,
} from "./index"

import contexto from "./__goldens__/contexto.json"
import goldenIndice from "./__goldens__/indice.json"
import goldenInsumos from "./__goldens__/insumos.json"
import golden2001 from "./__goldens__/apu-200-1-1.json"
import golden6301 from "./__goldens__/apu-630-1-1.json"
import golden6505 from "./__goldens__/apu-650-5.json"
import golden7304 from "./__goldens__/apu-730-4.json"
import golden8011 from "./__goldens__/apu-801-1.json"

const RUTA_MUESTRA = join(
  import.meta.dir,
  "..",
  "..",
  "data",
  "samples",
  "sample-provincia.xlsx"
)

const { archivo, procedencia } = contexto

/**
 * El extracto se abre con el nombre del libro del que salió: el código de
 * región (0509) solo existe en el nombre de archivo de INVIAS.
 */
function abrirMuestra(): Libro {
  return abrirLibro(readFileSync(RUTA_MUESTRA), { archivo })
}

const goldenPorHoja: Record<string, Apu> = {
  "200,1,1": golden2001,
  "630,1,1": golden6301,
  "650,5": golden6505,
  "730,4": golden7304,
  "801,1": golden8011,
} as unknown as Record<string, Apu>

describe("abrirLibro", () => {
  test("inventaría las hojas del extracto y clasifica las de ítem", () => {
    const libro = abrirMuestra()
    expect(libro.hojas.map((h) => h.nombre)).toEqual([
      HOJA_PORTADA,
      HOJA_INDICE,
      "MATERIALES",
      "EQUIPO",
      "MANO DE OBRA",
      "TRANSPORTE",
      ...contexto.items,
    ])
    expect(libro.hojasDeItem).toEqual(contexto.items)
    // "APU BASE" y las hojas de apoyo nunca cuentan como ítem.
    expect(libro.hojasDeItem.every((n) => /^\d+(,\d+)*$/.test(n))).toBe(true)
  })

  test("el extracto NO es un libro completo y la verificación lo dice", () => {
    const libro = abrirMuestra()
    expect(libro.esLibroCompleto).toBe(false)
    expect(() => verificarEstructura(libro)).toThrow(/544 hojas/)
    expect(() =>
      abrirLibro(readFileSync(RUTA_MUESTRA), {
        archivo,
        exigirLibroCompleto: true,
      })
    ).toThrow(ParserError)
  })
})

describe("PORTADA y región", () => {
  test("la región combina el código del archivo con la provincia acentuada", () => {
    expect(parseRegion(abrirMuestra())).toEqual({
      codigo: "0509",
      codigoDane: "05",
      departamento: "Antioquia",
      provincia: "Valle de Aburrá",
      slug: "antioquia-valle-de-aburra",
    })
  })

  test("PORTADA trae los factores territoriales", () => {
    const portada = parsePortada(abrirMuestra())
    expect(portada.departamento).toBe("Antioquia")
    expect(portada.factorHorario).toBe("42 HORAS")
    expect(portada.altitud).toBeCloseTo(1536.7, 1)
    expect(portada.factorAltitud).toBeCloseTo(0.9437, 4)
  })

  test("sin nombre de archivo no se puede deducir la región", () => {
    const libro = abrirLibro(readFileSync(RUTA_MUESTRA))
    expect(() => parseRegion(libro)).toThrow(/nombre del archivo/)
  })
})

describe("parseIndice", () => {
  const indice = parseIndice(abrirMuestra())

  test("lee las 526 filas aunque el extracto solo traiga 5 hojas de ítem", () => {
    expect(indice).toHaveLength(ITEMS_ESPERADOS)
    expect(indice[0]).toEqual(goldenIndice.primera)
    expect(indice[indice.length - 1]).toEqual(goldenIndice.ultima)
  })

  test("las filas de los ítems muestreados coinciden con el golden", () => {
    const porHoja = new Map(indice.map((f) => [f.hoja, f]))
    for (const esperada of goldenIndice.muestreados) {
      expect(porHoja.get(esperada.hoja)).toEqual(esperada)
    }
  })

  test("los 6 ítems con código numérico conservan la identidad de la hoja", () => {
    const porHoja = new Map(indice.map((f) => [f.hoja, f]))
    for (const esperada of goldenIndice.numericos) {
      const fila = porHoja.get(esperada.hoja)
      expect(fila).toEqual(esperada)
      // "730,4" en la hoja, 730.4 como número en la celda, "730.4" en el esquema.
      expect(fila!.codigo).toBe(esperada.hoja.replace(/,/g, "."))
    }
    expect(goldenIndice.numericos).toHaveLength(6)
  })

  test("las 14 grafías de unidad se normalizan y se conserva la cruda", () => {
    const crudas = new Set(indice.map((f) => f.unidadCruda ?? f.unidad))
    const canonicas = new Set(indice.map((f) => f.unidad))
    expect([...crudas].sort()).toEqual(goldenIndice.unidades)
    expect([...canonicas].sort()).toEqual(goldenIndice.unidadesCanonicas)
    expect(crudas.size).toBe(14)
    expect(canonicas.size).toBe(10)
    const m3km = indice.find((f) => f.unidadCruda === "m3 - Km")!
    expect(m3km.unidad).toBe("m3-km")
  })

  test("los subtotales del ÍNDICE cuadran con su costo directo", () => {
    for (const fila of indice) {
      const suma =
        fila.totales.equipo +
        fila.totales.materiales +
        fila.totales.transporte +
        fila.totales.manoDeObra
      expect(Math.abs(suma - fila.costoDirecto)).toBeLessThanOrEqual(
        TOLERANCIA_INVIAS
      )
    }
  })
})

describe("parseItem", () => {
  const libro = abrirMuestra()

  for (const hoja of contexto.items) {
    test(`"${hoja}" coincide con su golden y valida contra el esquema`, () => {
      const apu = parseItem(libro, hoja, { procedencia })
      expect(apu).toEqual(goldenPorHoja[hoja])
      expect(ApuSchema.safeParse(apu).success).toBe(true)
      expect(ApuCoherenteSchema.safeParse(apu).success).toBe(true)
    })

    test(`"${hoja}" cuadra con la tolerancia de INVIAS (${TOLERANCIA_INVIAS})`, () => {
      const apu = parseItem(libro, hoja, { procedencia })
      expect(revisarCoherencia(apu, TOLERANCIA_INVIAS)).toEqual([])
      // El costo directo publicado es N101, no la suma de líneas (FORMATO.md §7).
      const suma =
        apu.totales.equipo +
        apu.totales.materiales +
        apu.totales.transporte +
        apu.totales.manoDeObra
      expect(Math.abs(suma - apu.costoDirecto)).toBeLessThanOrEqual(
        TOLERANCIA_INVIAS
      )
    })
  }

  test("no emite ningún campo de AIU ni de precio total", () => {
    const apu = parseItem(libro, "200,1,1", { procedencia })
    const claves = Object.keys(apu)
    expect(claves).not.toContain("aiu")
    expect(claves).not.toContain("precioTotal")
    expect(claves).not.toContain("administracion")
    expect(Object.keys(apu.totales).sort()).toEqual([
      "equipo",
      "manoDeObra",
      "materiales",
      "transporte",
    ])
  })

  test("la herramienta menor va como línea de equipo, marcada aparte", () => {
    const apu = parseItem(libro, "200,1,1", { procedencia })
    const herramienta = apu.lineas.find((l) => l.codigo === "HERMENINV")!
    expect(herramienta.componente).toBe("equipo")
    expect(herramienta.porcentaje).toBe(0.05)
    // La base es el subtotal de mano de obra, y su "cantidad" es el porcentaje.
    expect(herramienta.base).toBeCloseTo(apu.totales.manoDeObra, 2)
    expect(herramienta.cantidad).toBe(0.05)
    expect(herramienta.subtotal).toBeCloseTo(
      herramienta.base! * herramienta.porcentaje!,
      2
    )
  })

  test("mano de obra divide por el rendimiento en vez de multiplicar", () => {
    const apu = parseItem(libro, "200,1,1", { procedencia })
    const linea = apu.lineas.find((l) => l.componente === "manoDeObra")!
    expect(linea.subtotal).toBeCloseTo(linea.precioUnitario / linea.cantidad, 2)
    // PRESTACIONES (%) es un factor (~2.05), no un porcentaje.
    expect(linea.factorPrestacional).toBeGreaterThan(1.5)
    expect(linea.precioUnitario).toBeCloseTo(
      linea.jornal! * linea.factorPrestacional!,
      2
    )
  })

  test("en transporte la distancia es 1: el precio es por unidad-kilómetro", () => {
    const apu = parseItem(libro, "200,1,1", { procedencia })
    const linea = apu.lineas.find((l) => l.componente === "transporte")!
    expect(linea.distancia).toBe(1)
    expect(linea.subtotal).toBeCloseTo(
      linea.cantidad * linea.distancia! * linea.precioUnitario,
      2
    )
  })

  test("las filas de sección sin usar no se cuentan como líneas", () => {
    // "730,4": las filas 38–51 existen en el XML con fórmula y <v/>; la única
    // línea de equipo real es la herramienta menor.
    const apu = parseItem(libro, "730,4", { procedencia })
    const equipo = apu.lineas.filter((l) => l.componente === "equipo")
    expect(equipo).toHaveLength(1)
    expect(equipo[0]!.codigo).toBe("HERMENINV")
    // "801,1" no tiene sección de transporte, y su subtotal es 0, no vacío.
    const sinTransporte = parseItem(libro, "801,1", { procedencia })
    expect(
      sinTransporte.lineas.filter((l) => l.componente === "transporte")
    ).toHaveLength(0)
    expect(sinTransporte.totales.transporte).toBe(0)
  })

  test("un ítem que no aplica en la región sale con costo directo 0", () => {
    // "650,5" (transporte marítimo/fluvial) no aplica en Valle de Aburrá.
    // Se emite en 0 para que la UI distinga "no aplica" de "no hay dato";
    // nunca se debe presentar ese 0 como precio (FORMATO.md §6.5).
    const apu = parseItem(libro, "650,5", { procedencia })
    expect(apu.costoDirecto).toBe(0)
    expect(Object.values(apu.totales)).toEqual([0, 0, 0, 0])
    expect(apu.lineas.length).toBeGreaterThan(0)
  })

  test("las líneas que el libro deja sin resolver se reportan, no se inventan", () => {
    const avisos: string[] = []
    const apu = parseItem(libro, "801,1", {
      procedencia,
      alDetectarLineaSinResolver: (l) => avisos.push(`${l.codigo}@${l.fila}`),
    })
    expect(avisos).toEqual(["B0033052@58", "B0033053@60", "B0033054@61"])
    expect(apu.nota).toContain("sin resolver")
    expect(apu.nota).toContain("B0033052")
    // No se publica ninguna línea de precio 0 inventada para ellas.
    expect(apu.lineas.some((l) => l.codigo === "B0033052")).toBe(false)
  })

  test("el código de la hoja debe coincidir con B33", () => {
    // Verificación cruzada barata; en los 6 ítems numéricos B33 es un número.
    const apu = parseItem(libro, "730,4", { procedencia })
    expect(apu.codigo).toBe("730.4")
  })

  test("la vigencia del APU sale de la procedencia que pasa quien llama", () => {
    const apu = parseItem(libro, "630,1,1", { procedencia })
    expect(apu.vigencia).toBe(procedencia.vigencia)
    expect(apu.procedencia.vigencia).toBe(apu.vigencia)
    expect(apu.procedencia.archivo).toBe(archivo)
  })

  test("una tolerancia imposible hace fallar la revisión aritmética", () => {
    expect(() =>
      parseItem(libro, "200,1,1", { procedencia, tolerancia: -1 })
    ).toThrow(/no cuadra/)
  })
})

describe("parseInsumos", () => {
  const lista = parseInsumos(abrirMuestra(), { procedencia })

  test("el listado regional valida y coincide con el golden", () => {
    expect(ListaInsumosSchema.safeParse(lista).success).toBe(true)
    expect(lista.insumos).toHaveLength(goldenInsumos.total)
    expect(lista.region).toEqual(goldenInsumos.region)
    const porComponente = Object.fromEntries(
      Object.keys(goldenInsumos.porComponente).map((c) => [
        c,
        lista.insumos.filter((i) => i.componente === c).length,
      ])
    )
    expect(porComponente).toEqual(goldenInsumos.porComponente)
  })

  test("la muestra por componente coincide con el golden", () => {
    for (const esperado of goldenInsumos.muestra) {
      const insumo = lista.insumos.find(
        (i) =>
          i.codigo === esperado.codigo && i.componente === esperado.componente
      )
      expect(insumo).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { region: _r, procedencia: _p, ...resto } = insumo!
      expect(resto).toEqual(esperado as unknown as typeof resto)
    }
  })

  test("HERMENINV no es un insumo con precio: se omite, no se inventa un 0", () => {
    expect(lista.insumos.some((i) => i.codigo === "HERMENINV")).toBe(false)
  })

  test("los insumos en 0 son los que no aplican en la región, no huecos", () => {
    // Valle de Aburrá no tiene acceso marítimo ni fluvial: esos transportes
    // vienen en 0 en el libro. Es "no aplica aquí", no "falta el dato"; la UI
    // no debe presentarlo como precio (FORMATO.md §6.5).
    const enCero = lista.insumos.filter((i) => i.precio === 0)
    expect(enCero.length).toBeGreaterThan(0)
    for (const insumo of enCero) {
      expect(insumo.componente).toBe("transporte")
      expect(insumo.descripcion.toLowerCase()).toContain("marítimo")
    }
  })

  test("mano de obra lleva el factor prestacional, que es lo regional", () => {
    const manoDeObra = lista.insumos.filter(
      (i) => i.componente === "manoDeObra"
    )
    expect(manoDeObra.length).toBeGreaterThan(0)
    for (const insumo of manoDeObra) {
      expect(insumo.unidad).toBe("mes")
      expect(insumo.factorPrestacional).toBeGreaterThan(1.5)
      expect(insumo.factorPrestacional).toBeLessThan(3)
    }
  })

  test("cada insumo carga su propia región y procedencia", () => {
    for (const insumo of lista.insumos) {
      expect(insumo.region).toEqual(lista.region)
      expect(insumo.procedencia.fuente).toBe("INVIAS")
      expect(insumo.procedencia.vigencia).toBe("2026-1")
    }
  })

  test("la vigencia 2026-1 se calcula sobre el SMLMV de 2025", () => {
    const referencias = parseReferenciaSalarial(abrirMuestra())
    expect(referencias.length).toBeGreaterThanOrEqual(4)
    expect(referencias[0]!.concepto).toContain("2025")
    expect(referencias[0]!.valor).toBe(1423500)
  })
})
