/**
 * Pruebas de los ayudantes puros del pipeline: forma de las filas, agregados y
 * serialización estable.
 *
 * NO se ejecutan los 140 libros (eso es `bun run pipeline`): aquí solo se
 * verifica la lógica que decide qué se publica y cómo. `scripts/pipeline.ts`
 * protege su `main()` con `import.meta.main`, así que importarlo no dispara
 * ninguna lectura de disco.
 */
import { describe, expect, test } from "bun:test"
import {
  ApuSchema,
  ListaInsumosSchema,
  SCHEMA_VERSION,
  type Apu,
  type ListaInsumos,
} from "../lib/schema"
import {
  agregados,
  capituloDeCodigo,
  compararCodigo,
  filaApu,
  filasDeInsumos,
  filasDeLineas,
  leerLimite,
  mediana,
  partirCapituloIndice,
  procedenciaDesdeManifiesto,
  redondearCop,
  serializarJson,
  serializarNdjson,
} from "./pipeline"

const procedencia = {
  fuente: "INVIAS",
  url: "https://www.invias.gov.co/publicaciones/4149/",
  vigencia: "2026-1",
  fechaDescarga: "2026-08-03",
  licencia: "Dato público INVIAS; costo directo sin AIU.",
}

const region = {
  codigo: "0509",
  codigoDane: "05",
  departamento: "Antioquia",
  provincia: "Valle de Aburrá",
  slug: "antioquia-valle-de-aburra",
}

/** APU cuadrado, con las rarezas reales: herramienta menor y transporte. */
const apu = (): Apu =>
  ApuSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    codigo: "630.1.1",
    descripcion: "TIPO DE CONCRETO\n(Aplicable al suministro y colocación)",
    unidad: "m3",
    region,
    vigencia: "2026-1",
    capitulo: "Capitulo 6\nEstructuras y drenajes",
    articulo: "Artículo 630 - 22\nConcreto estructural",
    clasificacion: "GENERAL",
    totales: {
      // Ruido IEEE-754 tal como llega del valor cacheado (FORMATO.md §6.8).
      equipo: 11154.780000000001,
      materiales: 414028.36,
      transporte: 1696.39,
      manoDeObra: 82945.11,
    },
    costoDirecto: 509824.6400000001,
    lineas: [
      {
        componente: "equipo",
        codigo: "C0010052",
        descripcion: "Vibrador de concreto",
        unidad: "h",
        cantidad: 0.5,
        precioUnitario: 14015.04,
        subtotal: 7007.5200000000004,
      },
      {
        componente: "equipo",
        codigo: "HERMENINV",
        descripcion: "HERRAMIENTA MENOR (% MANO DE OBRA)",
        unidad: "%",
        cantidad: 0.05,
        precioUnitario: 82945.11,
        subtotal: 4147.26,
        porcentaje: 0.05,
        base: 82945.11,
      },
      {
        componente: "materiales",
        codigo: "B0013791",
        descripcion: "Concreto premezclado 35 MPa",
        unidad: "m3",
        cantidad: 1.05,
        precioUnitario: 382028.6,
        subtotal: 401130.03,
      },
      {
        componente: "materiales",
        codigo: "B0000010",
        descripcion: "Acero de refuerzo",
        unidad: "kg",
        cantidad: 1,
        precioUnitario: 12898.33,
        subtotal: 12898.33,
      },
      {
        componente: "transporte",
        codigo: "T0010032",
        descripcion: "Transporte de materiales",
        unidad: "m3-km",
        unidadCruda: "m3 - Km",
        cantidad: 1.05,
        distancia: 1,
        precioUnitario: 1615.61,
        subtotal: 1696.39,
      },
      {
        componente: "manoDeObra",
        codigo: "A0030060",
        descripcion: "Obrero (6)",
        unidad: "jornal",
        cantidad: 13.3,
        precioUnitario: 1103169.96,
        subtotal: 82945.11,
        jornal: 537694.5,
        factorPrestacional: 2.05181849,
      },
    ],
    procedencia: { ...procedencia, archivo: "APU_0509_X__Y_2026_1.xlsx" },
  })

const lista = (): ListaInsumos =>
  ListaInsumosSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    region,
    procedencia,
    insumos: [
      {
        codigo: "B0013791",
        componente: "materiales",
        descripcion: "Concreto premezclado 35 MPa",
        unidad: "m3",
        categoria: "CONCRETO Y MORTERO",
        precio: 382028.6,
        region,
        procedencia,
      },
      {
        codigo: "A0030060",
        componente: "manoDeObra",
        descripcion: "Obrero (6)",
        unidad: "jornal",
        precio: 1423500,
        factorPrestacional: 2.05181849,
        region,
        procedencia,
      },
    ],
  })

describe("redondearCop", () => {
  test("quita el ruido IEEE-754 de los valores ya redondeados en la hoja", () => {
    expect(redondearCop(5792090.8600000003)).toBe(5792090.86)
    expect(redondearCop(526956.44999999995)).toBe(526956.45)
    expect(redondearCop(0)).toBe(0)
  })

  test("nunca devuelve -0 (JSON lo serializaría como `-0`)", () => {
    expect(Object.is(redondearCop(-0), 0)).toBe(true)
    expect(serializarJson(redondearCop(-0))).toBe("0\n")
  })
})

describe("orden de códigos", () => {
  test("ordena por segmento y numéricamente, no lexicográficamente", () => {
    const codigos = ["200.12", "200.2", "200.1.1", "201.1", "730.4", "900.3.2"]
    expect([...codigos].sort(compararCodigo)).toEqual([
      "200.1.1",
      "200.2",
      "200.12",
      "201.1",
      "730.4",
      "900.3.2",
    ])
    // El orden lexicográfico pondría "200.12" antes que "200.2".
    expect(compararCodigo("200.2", "200.12")).toBeLessThan(0)
  })

  test("un código más corto va antes que su prefijo extendido", () => {
    expect(compararCodigo("730.4", "730.4.1")).toBeLessThan(0)
    expect(compararCodigo("630.1.1", "630.1.1")).toBe(0)
  })
})

describe("capítulos", () => {
  test("el capítulo es el primer segmento del código", () => {
    expect(capituloDeCodigo("630.1.1")).toBe("630")
    expect(capituloDeCodigo("900.3.2")).toBe("900")
  })

  test("descompone el capítulo constructivo del ÍNDICE", () => {
    expect(partirCapituloIndice("Capitulo 2\nExplanaciones")).toEqual({
      numero: 2,
      nombre: "Explanaciones",
    })
    expect(partirCapituloIndice("Capítulo 9\nTransporte")).toEqual({
      numero: 9,
      nombre: "Transporte",
    })
  })

  test("devuelve null cuando el texto no encaja o falta", () => {
    expect(partirCapituloIndice(undefined)).toBeNull()
    expect(partirCapituloIndice("Explanaciones")).toBeNull()
    expect(partirCapituloIndice("Capitulo 2")).toBeNull()
  })
})

describe("agregados", () => {
  test("mediana con cantidad impar y par", () => {
    expect(mediana([3, 1, 2])).toBe(2)
    expect(mediana([1, 2, 3, 4])).toBe(2.5)
    expect(mediana([])).toBe(0)
  })

  test("omite los ceros: un 0 es «no aplica», no un precio", () => {
    const { agregados: a, conDato } = agregados([0, 100, 200, 0, 300])
    expect(a).toEqual({ min: 100, max: 300, mediana: 200, promedio: 200 })
    expect(conDato).toBe(3)
  })

  test("todo en cero devuelve ceros y conDato 0", () => {
    expect(agregados([0, 0])).toEqual({
      agregados: { min: 0, max: 0, mediana: 0, promedio: 0 },
      conDato: 0,
    })
  })

  test("redondea a 2 decimales", () => {
    expect(agregados([1, 2]).agregados.promedio).toBe(1.5)
    expect(agregados([1, 1, 2]).agregados.promedio).toBe(1.33)
  })
})

describe("filas de staging", () => {
  test("filaApu aplana región, capítulo y totales", () => {
    const fila = filaApu(apu(), "APU_0509_X__Y_2026_1.xlsx")
    expect(fila.codigo).toBe("630.1.1")
    expect(fila.capitulo).toBe("630")
    expect(fila.capituloNumero).toBe(6)
    expect(fila.capituloNombre).toBe("Estructuras y drenajes")
    expect(fila.regionCodigo).toBe("0509")
    expect(fila.regionCodigoDane).toBe("05")
    expect(fila.slug).toBe("antioquia-valle-de-aburra")
    // Los importes llegan sin ruido IEEE-754.
    expect(fila.equipo).toBe(11154.78)
    expect(fila.costoDirecto).toBe(509824.64)
  })

  test("los campos ausentes van como null, no undefined (esquema estable)", () => {
    const fila = filaApu(apu(), "libro.xlsx")
    expect(fila.unidadCruda).toBeNull()
    expect(fila.notaFuente).toBeNull()
    expect(Object.values(fila).some((v) => v === undefined)).toBe(false)
  })

  test("filasDeLineas numera en el orden de la hoja y conserva los extras", () => {
    const filas = filasDeLineas(apu())
    expect(filas).toHaveLength(6)
    expect(filas.map((f) => f.orden)).toEqual([1, 2, 3, 4, 5, 6])

    const herramienta = filas[1]!
    expect(herramienta.componente).toBe("equipo")
    expect(herramienta.porcentaje).toBe(0.05)
    expect(herramienta.base).toBe(82945.11)

    const transporte = filas[4]!
    // La distancia es 1 por definición: la tarifa es por unidad-kilómetro.
    expect(transporte.distancia).toBe(1)
    expect(transporte.unidadCruda).toBe("m3 - Km")

    const mano = filas[5]!
    // El factor prestacional y el jornal NO se redondean: la fuente no lo hace.
    expect(mano.factorPrestacional).toBe(2.05181849)
    expect(mano.jornal).toBe(537694.5)
    // El subtotal sí, porque la hoja lo calcula con ROUND(x, 2).
    expect(filas[0]!.subtotal).toBe(7007.52)
  })

  test("filasDeInsumos conserva precio sin redondear y el factor regional", () => {
    const filas = filasDeInsumos(lista())
    expect(filas).toHaveLength(2)
    expect(filas[0]!.precio).toBe(382028.6)
    expect(filas[0]!.categoria).toBe("CONCRETO Y MORTERO")
    expect(filas[1]!.factorPrestacional).toBe(2.05181849)
    expect(filas[1]!.categoria).toBeNull()
    expect(filas[0]!.vigencia).toBe("2026-1")
  })

  test("todas las filas de líneas comparten las mismas claves", () => {
    const filas = filasDeLineas(apu())
    const claves = Object.keys(filas[0]!).join(",")
    for (const fila of filas) expect(Object.keys(fila).join(",")).toBe(claves)
  })
})

describe("serialización", () => {
  test("objetos indentados, elementos de arreglo en una línea", () => {
    const texto = serializarJson({
      a: 1,
      b: { c: "x" },
      d: [{ e: 1 }, { e: 2 }],
    })
    expect(texto).toBe(
      '{\n  "a": 1,\n  "b": {\n    "c": "x"\n  },\n  "d": [\n' +
        '    {"e":1},\n    {"e":2}\n  ]\n}\n'
    )
  })

  test("es determinista y respeta el orden de construcción", () => {
    const documento = { z: 1, a: [3, 1, 2] }
    expect(serializarJson(documento)).toBe(serializarJson({ ...documento }))
    expect(serializarJson(documento).indexOf('"z"')).toBeLessThan(
      serializarJson(documento).indexOf('"a"')
    )
  })

  test("omite las claves undefined y conserva los null", () => {
    const texto = serializarJson({ a: undefined, b: null, c: [] })
    expect(texto).toBe('{\n  "b": null,\n  "c": []\n}\n')
  })

  test("una fila NDJSON por objeto, con salto final", () => {
    expect(serializarNdjson([{ a: 1 }, { a: 2 }])).toBe('{"a":1}\n{"a":2}\n')
  })

  test("dos serializaciones del mismo APU dan bytes idénticos", () => {
    const uno = serializarJson(filaApu(apu(), "libro.xlsx"))
    const dos = serializarJson(filaApu(apu(), "libro.xlsx"))
    expect(uno).toBe(dos)
  })
})

describe("procedencia y flags", () => {
  test("la entidad es INVIAS y la URL sale del campo `fuente` del manifiesto", () => {
    const resultado = procedenciaDesdeManifiesto({
      vigencia: "2026-1",
      fuente: "https://www.invias.gov.co/publicaciones/4149/",
      fechaDescarga: "2026-08-03",
      licencia: "Dato público INVIAS.",
      archivos: 140,
    })
    expect(resultado.fuente).toBe("INVIAS")
    expect(resultado.url).toBe("https://www.invias.gov.co/publicaciones/4149/")
    expect(resultado.vigencia).toBe("2026-1")
  })

  test("--libros solo acepta enteros positivos", () => {
    expect(leerLimite(["bun", "pipeline.ts"])).toBeNull()
    expect(leerLimite(["bun", "pipeline.ts", "--libros=3"])).toBe(3)
    expect(() => leerLimite(["bun", "--libros=0"])).toThrow()
    expect(() => leerLimite(["bun", "--libros=x"])).toThrow()
  })
})
