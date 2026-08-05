/**
 * Pruebas de los agregados puros de la portada. Accesorios mínimos con los
 * tipos estructurales del módulo: no hace falta un artefacto completo.
 */
import { describe, expect, test } from "bun:test"
import {
  acumularComposicion,
  itemsMasDispersos,
  nivelPorDepartamento,
  prepararSankey,
} from "./agregados"

describe("acumularComposicion", () => {
  const region = (
    costoDirecto: number,
    [equipo, materiales, transporte, manoDeObra]: number[]
  ) => ({
    costoDirecto,
    totales: { equipo, materiales, transporte, manoDeObra },
  })

  test("promedia participaciones, no pesos absolutos", () => {
    // Dos APU del mismo capítulo con la misma participación 50/50 pero pesos
    // absolutos muy distintos: la media de participaciones debe ser 50/50,
    // no la que saldría de sumar COP (que sesgaría hacia el APU caro).
    const [capitulo] = acumularComposicion([
      {
        capitulo: "630",
        capituloNumero: 6,
        capituloNombre: "Estructuras",
        regiones: [
          region(100, [50, 50, 0, 0]),
          region(1_000_000, [500_000, 500_000, 0, 0]),
        ],
      },
    ])
    expect(capitulo.apus).toBe(2)
    expect(capitulo.equipo).toBeCloseTo(0.5)
    expect(capitulo.materiales).toBeCloseTo(0.5)
    expect(capitulo.transporte).toBe(0)
  })

  test("los APU sin dato quedan fuera y los capítulos vacíos no salen", () => {
    const capitulos = acumularComposicion([
      {
        capitulo: "200",
        capituloNumero: 2,
        regiones: [region(0, [0, 0, 0, 0])],
      },
      {
        capitulo: "630",
        capituloNumero: 6,
        regiones: [region(200, [100, 60, 20, 20]), region(0, [1, 1, 1, 1])],
      },
    ])
    expect(capitulos).toHaveLength(1)
    expect(capitulos[0].numero).toBe(6)
    expect(capitulos[0].apus).toBe(1)
    expect(capitulos[0].equipo).toBeCloseTo(0.5)
  })

  test("agrupa por capítulo constructivo y ordena por número", () => {
    const capitulos = acumularComposicion([
      { capitulo: "630", capituloNumero: 6, regiones: [region(10, [10, 0, 0, 0])] },
      { capitulo: "201", capituloNumero: 2, regiones: [region(10, [0, 10, 0, 0])] },
      { capitulo: "640", capituloNumero: 6, regiones: [region(10, [10, 0, 0, 0])] },
    ])
    expect(capitulos.map((capitulo) => capitulo.numero)).toEqual([2, 6])
    expect(capitulos[1].apus).toBe(2)
  })
})

describe("nivelPorDepartamento", () => {
  const capituloDe = (capitulo3: string) => ({
    numero: Number(capitulo3[0]),
    nombre: `Capítulo ${capitulo3[0]}`,
  })

  test("normaliza por la mediana nacional del ítem y toma la mediana", () => {
    const filas = nivelPorDepartamento(
      [
        {
          region: { codigoDane: "91", departamento: "Amazonas" },
          items: [
            { codigo: "630.1", capitulo: "630", costoDirecto: 150 }, // ×1,5
            { codigo: "640.1", capitulo: "640", costoDirecto: 260 }, // ×1,3
          ],
        },
      ],
      new Map([
        ["630.1", 100],
        ["640.1", 200],
      ]),
      capituloDe
    )
    expect(filas).toHaveLength(1)
    const celda = filas[0].celdas.find((c) => c.numero === 6)!
    expect(celda.apus).toBe(2)
    expect(celda.razon).toBeCloseTo(1.4) // mediana de 1,5 y 1,3
  })

  test("junta las provincias del mismo departamento y excluye los ceros", () => {
    const provincia = (dane: string, costoDirecto: number) => ({
      region: { codigoDane: dane, departamento: "Antioquia" },
      items: [{ codigo: "630.1", capitulo: "630", costoDirecto }],
    })
    const filas = nivelPorDepartamento(
      [provincia("05", 90), provincia("05", 110), provincia("05", 0)],
      new Map([["630.1", 100]]),
      capituloDe
    )
    const celda = filas[0].celdas[0]
    expect(celda.apus).toBe(2)
    expect(celda.razon).toBeCloseTo(1.0)
  })

  test("ordena los departamentos alfabéticamente en español", () => {
    const fila = (dane: string, departamento: string) => ({
      region: { codigoDane: dane, departamento },
      items: [{ codigo: "630.1", capitulo: "630", costoDirecto: 100 }],
    })
    const filas = nivelPorDepartamento(
      [fila("99", "Vichada"), fila("05", "Antioquia"), fila("18", "Caquetá")],
      new Map([["630.1", 100]]),
      capituloDe
    )
    expect(filas.map((f) => f.departamento)).toEqual([
      "Antioquia",
      "Caquetá",
      "Vichada",
    ])
  })
})

describe("prepararSankey", () => {
  test("toma las líneas mayores y agrupa el resto en otras", () => {
    const [equipo] = prepararSankey(
      {
        componentes: [
          {
            componente: "equipo",
            subtotal: 100,
            lineas: [
              { descripcion: "d", subtotal: 10 },
              { descripcion: "a", subtotal: 40 },
              { descripcion: "b", subtotal: 30 },
              { descripcion: "c", subtotal: 15 },
              { descripcion: "e", subtotal: 5 },
            ],
          },
        ],
      },
      3
    )
    expect(equipo.lineas.map((l) => l.nombre)).toEqual(["a", "b", "c"])
    expect(equipo.otras).toEqual({ n: 2, valor: 15 })
  })

  test("omite componentes y líneas en cero; sin resto no hay otras", () => {
    const resultado = prepararSankey(
      {
        componentes: [
          { componente: "transporte", subtotal: 0, lineas: [] },
          {
            componente: "materiales",
            subtotal: 50,
            lineas: [
              { descripcion: "cemento", subtotal: 50 },
              { descripcion: "vacía", subtotal: 0 },
            ],
          },
        ],
      },
      3
    )
    expect(resultado).toHaveLength(1)
    expect(resultado[0].componente).toBe("materiales")
    expect(resultado[0].lineas).toHaveLength(1)
    expect(resultado[0].otras).toBeNull()
  })
})

describe("itemsMasDispersos", () => {
  const item = (
    codigo: string,
    mediana: number,
    max: number,
    provinciasConDato = 140
  ) => ({
    codigo,
    descripcion: `Ítem ${codigo}\n(alcance)`,
    unidad: "m3",
    provinciasConDato,
    costoDirecto: { min: mediana / 2, max, mediana },
  })

  test("ordena por razón max ÷ mediana y corta la lista", () => {
    const top = itemsMasDispersos(
      [item("a", 100, 300), item("b", 100, 1_000), item("c", 100, 150)],
      (descripcion) => descripcion.split("\n")[0],
      2
    )
    expect(top.map((t) => t.codigo)).toEqual(["b", "a"])
    expect(top[0].razon).toBeCloseTo(10)
    expect(top[0].titulo).toBe("Ítem b")
  })

  test("excluye mediana cero y muestras pequeñas", () => {
    const top = itemsMasDispersos(
      [item("cero", 0, 10), item("poca", 100, 900, 3), item("ok", 100, 200)],
      (descripcion) => descripcion,
      10,
      10
    )
    expect(top.map((t) => t.codigo)).toEqual(["ok"])
  })
})
