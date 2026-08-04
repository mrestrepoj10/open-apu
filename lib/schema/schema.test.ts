/**
 * Pruebas del esquema: qué se acepta, qué se rechaza y por qué.
 * Los casos se construyen aquí (no dependen de `data/samples/`) para poder
 * mutar un campo a la vez.
 */
import { describe, expect, test } from "bun:test"
import {
  ApuCoherenteSchema,
  ApuSchema,
  DEPARTAMENTOS_DANE,
  InsumoSchema,
  ListaInsumosSchema,
  NOTA_COSTO_DIRECTO,
  ProcedenciaSchema,
  RegionSchema,
  SCHEMA_VERSION,
  codigoDaneDeRegion,
  nombreDepartamentoDane,
  revisarCoherencia,
  slugRegion,
} from "./index"

const procedencia = () => ({
  fuente: "INVIAS",
  url: "https://hermes2.invias.gov.co/SeguimientoInversiones/",
  vigencia: "2026-1",
  fechaDescarga: "2026-08-03",
  licencia: "Dato público INVIAS; uso de referencia con atribución.",
})

const region = () => ({
  codigo: "0509",
  codigoDane: "05",
  departamento: "Antioquia",
  provincia: "Valle de Aburrá",
  slug: "antioquia-valle-de-aburra",
})

/** APU válido y cuadrado: base para mutar en cada caso negativo. */
const apu = () => ({
  schemaVersion: SCHEMA_VERSION,
  codigo: "630.1.1",
  descripcion: "CONCRETO CLASE D (21 MPa)",
  unidad: "m3",
  region: region(),
  vigencia: "2026-1",
  totales: {
    equipo: 2240,
    materiales: 714000,
    transporte: 9030,
    manoDeObra: 51000,
  },
  costoDirecto: 776270,
  lineas: [
    {
      componente: "equipo",
      codigo: "C0010010",
      descripcion: "Aspersor manual de 20 litros",
      unidad: "h",
      cantidad: 0.5,
      precioUnitario: 4480,
      subtotal: 2240,
    },
    {
      componente: "materiales",
      codigo: "B0123630",
      descripcion: "Concreto premezclado 21 MPa",
      unidad: "m3",
      cantidad: 1.05,
      precioUnitario: 680000,
      subtotal: 714000,
    },
    {
      componente: "transporte",
      codigo: "T0010009",
      descripcion: "Transporte de concreto",
      unidad: "m3-km",
      cantidad: 1.05,
      distancia: 5,
      precioUnitario: 1720,
      subtotal: 9030,
    },
    {
      componente: "manoDeObra",
      codigo: "A0030060",
      descripcion: "Obrero (6)",
      unidad: "jornal",
      cantidad: 14,
      precioUnitario: 714000,
      subtotal: 51000,
    },
  ],
  procedencia: procedencia(),
})

const insumo = () => ({
  codigo: "B0123630",
  componente: "materiales",
  descripcion: "Concreto premezclado 21 MPa",
  unidad: "m3",
  categoria: "CONCRETOS Y MORTEROS",
  precio: 680000,
  region: region(),
  procedencia: procedencia(),
})

/** Devuelve el APU base con un campo de primer nivel eliminado. */
function sinCampo(objeto: Record<string, unknown>, campo: string) {
  const copia = { ...objeto }
  delete copia[campo]
  return copia
}

describe("APU válido", () => {
  test("acepta el caso base y es coherente", () => {
    const parsed = ApuCoherenteSchema.parse(apu())
    expect(parsed.costoDirecto).toBe(776270)
    expect(revisarCoherencia(parsed)).toEqual([])
  })

  test("los tipos inferidos son utilizables", () => {
    const parsed = ApuSchema.parse(apu())
    const primera = parsed.lineas[0]!
    expect(primera.componente).toBe("equipo")
    expect(primera.porcentaje).toBeUndefined()
  })
})

describe("APU inválido", () => {
  test("rechaza un APU sin procedencia", () => {
    const resultado = ApuSchema.safeParse(sinCampo(apu(), "procedencia"))
    expect(resultado.success).toBe(false)
    expect(JSON.stringify(resultado.error?.issues)).toContain("procedencia")
  })

  test("rechaza precios negativos", () => {
    const base = apu()
    const conNegativo = {
      ...base,
      lineas: [
        { ...base.lineas[0]!, precioUnitario: -4480 },
        ...base.lineas.slice(1),
      ],
    }
    expect(ApuSchema.safeParse(conNegativo).success).toBe(false)

    expect(ApuSchema.safeParse({ ...base, costoDirecto: -1 }).success).toBe(
      false
    )
    expect(InsumoSchema.safeParse({ ...insumo(), precio: -1 }).success).toBe(
      false
    )
  })

  test("rechaza un componente desconocido", () => {
    const base = apu()
    const raro = {
      ...base,
      lineas: [{ ...base.lineas[0]!, componente: "herramientaMenor" }],
    }
    expect(ApuSchema.safeParse(raro).success).toBe(false)
  })

  test("rechaza un APU sin costoDirecto", () => {
    const resultado = ApuSchema.safeParse(sinCampo(apu(), "costoDirecto"))
    expect(resultado.success).toBe(false)
    expect(JSON.stringify(resultado.error?.issues)).toContain("costoDirecto")
  })

  test("rechaza campos de costos indirectos (AIU)", () => {
    const conAiu = { ...apu(), administracion: 0.15, utilidad: 0.05 }
    const resultado = ApuSchema.safeParse(conAiu)
    expect(resultado.success).toBe(false)
    expect(JSON.stringify(resultado.error?.issues)).toContain("administracion")
  })

  test("rechaza vigencia que no coincide con la procedencia", () => {
    expect(ApuSchema.safeParse({ ...apu(), vigencia: "2025-2" }).success).toBe(
      false
    )
  })

  test("rechaza schemaVersion desactualizada", () => {
    expect(
      ApuSchema.safeParse({ ...apu(), schemaVersion: "0.0.1" }).success
    ).toBe(false)
  })

  test("rechaza el código de ítem sin normalizar", () => {
    expect(ApuSchema.safeParse({ ...apu(), codigo: "630,1,1" }).success).toBe(
      false
    )
  })

  test("rechaza un APU sin líneas", () => {
    expect(ApuSchema.safeParse({ ...apu(), lineas: [] }).success).toBe(false)
  })

  test("rechaza descuadres aritméticos con ApuCoherenteSchema", () => {
    const descuadrado = { ...apu(), costoDirecto: 999999 }
    expect(ApuSchema.safeParse(descuadrado).success).toBe(true)
    const resultado = ApuCoherenteSchema.safeParse(descuadrado)
    expect(resultado.success).toBe(false)
    expect(JSON.stringify(resultado.error?.issues)).toContain("costoDirecto")
  })

  test("revisarCoherencia señala totales por componente mal sumados", () => {
    const base = ApuSchema.parse(apu())
    const problemas = revisarCoherencia({
      ...base,
      totales: { ...base.totales, materiales: 1 },
      costoDirecto: 776270,
    })
    expect(problemas.length).toBeGreaterThan(0)
    expect(problemas.join(" ")).toContain("materiales")
  })
})

describe("Procedencia", () => {
  test("exige URL y fecha ISO", () => {
    expect(
      ProcedenciaSchema.safeParse({ ...procedencia(), url: "invias.gov.co" })
        .success
    ).toBe(false)
    expect(
      ProcedenciaSchema.safeParse({
        ...procedencia(),
        fechaDescarga: "03/08/2026",
      }).success
    ).toBe(false)
    expect(
      ProcedenciaSchema.safeParse({ ...procedencia(), vigencia: "2026-3" })
        .success
    ).toBe(false)
    expect(
      ProcedenciaSchema.safeParse(sinCampo(procedencia(), "licencia")).success
    ).toBe(false)
  })

  test("la nota de costo directo es explícita sobre el AIU", () => {
    expect(NOTA_COSTO_DIRECTO).toContain("AIU")
  })
})

describe("Region", () => {
  test("acepta una región bien formada", () => {
    expect(RegionSchema.parse(region()).codigoDane).toBe("05")
  })

  test("rechaza codigoDane que no es el prefijo del código INVIAS", () => {
    expect(
      RegionSchema.safeParse({ ...region(), codigoDane: "08" }).success
    ).toBe(false)
  })

  test("rechaza un código DANE inexistente", () => {
    expect(
      RegionSchema.safeParse({ ...region(), codigo: "0409", codigoDane: "04" })
        .success
    ).toBe(false)
  })

  test("rechaza slugs con mayúsculas o tildes", () => {
    expect(
      RegionSchema.safeParse({ ...region(), slug: "Antioquia-Valle" }).success
    ).toBe(false)
    expect(
      RegionSchema.safeParse({ ...region(), slug: "valle-de-aburrá" }).success
    ).toBe(false)
  })

  test("acepta provincias con sufijo 00 (departamento sin subdivisión)", () => {
    const caqueta = {
      codigo: "1800",
      codigoDane: "18",
      departamento: "Caquetá",
      provincia: "Caquetá",
      slug: "caqueta-caqueta",
    }
    expect(RegionSchema.parse(caqueta).provincia).toBe("Caquetá")
  })

  test("helpers de código DANE y slug", () => {
    expect(codigoDaneDeRegion("0509")).toBe("05")
    expect(nombreDepartamentoDane("05")).toBe("Antioquia")
    expect(nombreDepartamentoDane("04")).toBeUndefined()
    expect(slugRegion("Antioquia", "Valle de Aburrá")).toBe(
      "antioquia-valle-de-aburra"
    )
    expect(slugRegion("NORTE DE SANTANDER", "Ocaña")).toBe(
      "norte-de-santander-ocana"
    )
    // Bogotá está en el listado DANE pero fuera del alcance de INVIAS (usa IDU).
    expect(DEPARTAMENTOS_DANE["11"]).toBe("Bogotá D.C.")
    expect(Object.keys(DEPARTAMENTOS_DANE)).toHaveLength(33)
  })
})

describe("Insumo", () => {
  test("acepta un insumo autodescriptivo", () => {
    expect(InsumoSchema.parse(insumo()).precio).toBe(680000)
  })

  test("rechaza un insumo sin procedencia", () => {
    expect(
      InsumoSchema.safeParse(sinCampo(insumo(), "procedencia")).success
    ).toBe(false)
  })

  test("rechaza un insumo sin región", () => {
    expect(InsumoSchema.safeParse(sinCampo(insumo(), "region")).success).toBe(
      false
    )
  })

  test("acepta insumos sin código ni categoría", () => {
    const suelto = sinCampo(sinCampo(insumo(), "codigo"), "categoria")
    expect(InsumoSchema.safeParse(suelto).success).toBe(true)
  })

  test("el listado rechaza insumos de otra región", () => {
    const otraRegion = {
      ...insumo(),
      region: {
        codigo: "0802",
        codigoDane: "08",
        departamento: "Atlántico",
        provincia: "Norte",
        slug: "atlantico-norte",
      },
    }
    const lista = {
      schemaVersion: SCHEMA_VERSION,
      region: region(),
      procedencia: procedencia(),
      insumos: [insumo(), otraRegion],
    }
    expect(ListaInsumosSchema.safeParse(lista).success).toBe(false)
  })

  test("el listado rechaza un arreglo vacío", () => {
    const lista = {
      schemaVersion: SCHEMA_VERSION,
      region: region(),
      procedencia: procedencia(),
      insumos: [],
    }
    expect(ListaInsumosSchema.safeParse(lista).success).toBe(false)
  })
})
