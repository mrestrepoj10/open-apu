/**
 * Pruebas de los artefactos publicados: qué forma tiene cada JSON estático de
 * `data/json/<vigencia>/` y qué se rechaza.
 *
 * Los casos se construyen aquí (no dependen de que el pipeline haya corrido)
 * para poder mutar un campo a la vez, igual que en `schema.test.ts`.
 */
import { describe, expect, test } from "bun:test"
import {
  AgregadosSchema,
  CatalogoSchema,
  ItemRegionalSchema,
  NOTA_COSTO_DIRECTO,
  ProvinciaResumenSchema,
  SCHEMA_VERSION,
  StatsSchema,
} from "./index"

const procedencia = () => ({
  fuente: "INVIAS",
  url: "https://www.invias.gov.co/publicaciones/4149/",
  vigencia: "2026-1",
  fechaDescarga: "2026-08-03",
  licencia: "Dato público INVIAS; costo directo sin AIU.",
})

const region = () => ({
  codigo: "0509",
  codigoDane: "05",
  departamento: "Antioquia",
  provincia: "Valle de Aburrá",
  slug: "antioquia-valle-de-aburra",
})

/** Cabecera común: la lleva todo artefacto (no negociable 1 y 2). */
const cabecera = () => ({
  schemaVersion: SCHEMA_VERSION,
  vigencia: "2026-1",
  procedencia: procedencia(),
  generadoPor: "scripts/pipeline.ts",
  nota: NOTA_COSTO_DIRECTO,
})

const agregados = () => ({
  min: 847218.13,
  max: 849240.44,
  mediana: 848229.28,
  promedio: 848229.28,
})

const catalogo = () => ({
  ...cabecera(),
  provincias: 140,
  items: [
    {
      codigo: "630.1.1",
      descripcion: "TIPO DE CONCRETO\n(Aplicable al suministro)",
      unidad: "m3",
      capitulo: "630",
      capituloNumero: 6,
      capituloNombre: "Estructuras y drenajes",
      clasificacion: "GENERAL",
      costoDirecto: agregados(),
      provinciasConDato: 140,
    },
  ],
})

const itemRegional = () => ({
  ...cabecera(),
  codigo: "630.1.1",
  descripcion: "TIPO DE CONCRETO\n(Aplicable al suministro)",
  unidad: "m3",
  capitulo: "630",
  capituloNumero: 6,
  capituloNombre: "Estructuras y drenajes",
  articulo: "Artículo 630 - 22\nConcreto estructural",
  clasificacion: "GENERAL",
  agregados: agregados(),
  provinciasConDato: 140,
  regiones: [
    {
      region: region(),
      totales: {
        equipo: 11154.78,
        materiales: 414028.36,
        transporte: 1696.39,
        manoDeObra: 82945.11,
      },
      costoDirecto: 509824.64,
    },
  ],
})

const provincia = () => ({
  ...cabecera(),
  region: region(),
  agregados: agregados(),
  itemsConDato: 524,
  items: [
    {
      codigo: "630.1.1",
      titulo: "TIPO DE CONCRETO",
      unidad: "m3",
      capitulo: "630",
      costoDirecto: 509824.64,
    },
  ],
})

const stats = () => ({
  ...cabecera(),
  conteos: {
    items: 526,
    provincias: 140,
    departamentos: 32,
    apus: 73640,
    lineas: 619920,
    insumos: 101500,
    lineasSinResolver: 840,
  },
  costoDirecto: agregados(),
  capitulos: [{ capitulo: "630", items: 42 }],
  capitulosInvias: [{ numero: 6, nombre: "Estructuras y drenajes", items: 42 }],
  departamentos: [{ codigoDane: "05", nombre: "Antioquia", provincias: 9 }],
  notables: {
    provinciaMasCara: {
      slug: "choco-pacifico-norte",
      departamento: "Chocó",
      provincia: "Pacífico Norte",
      medianaCostoDirecto: 158000,
    },
    provinciaMasBarata: {
      slug: "antioquia-valle-de-aburra",
      departamento: "Antioquia",
      provincia: "Valle de Aburrá",
      medianaCostoDirecto: 112000,
    },
  },
})

function sinCampo(objeto: Record<string, unknown>, campo: string) {
  const copia = { ...objeto }
  delete copia[campo]
  return copia
}

describe("cabecera común", () => {
  test("los cuatro artefactos exigen procedencia y schemaVersion", () => {
    const casos = [
      [CatalogoSchema, catalogo()],
      [ItemRegionalSchema, itemRegional()],
      [ProvinciaResumenSchema, provincia()],
      [StatsSchema, stats()],
    ] as const
    for (const [esquema, documento] of casos) {
      expect(esquema.safeParse(documento).success).toBe(true)
      expect(
        esquema.safeParse(sinCampo({ ...documento }, "procedencia")).success
      ).toBe(false)
      expect(
        esquema.safeParse(sinCampo({ ...documento }, "schemaVersion")).success
      ).toBe(false)
      expect(
        esquema.safeParse({ ...documento, schemaVersion: "0.0.1" }).success
      ).toBe(false)
      // La advertencia de costo directo es obligatoria (no negociable 2).
      expect(
        esquema.safeParse(sinCampo({ ...documento }, "nota")).success
      ).toBe(false)
    }
  })

  test("rechazan campos de AIU o precio total (esquemas strict)", () => {
    expect(
      ItemRegionalSchema.safeParse({ ...itemRegional(), aiu: 0.25 }).success
    ).toBe(false)
    expect(
      ProvinciaResumenSchema.safeParse({
        ...provincia(),
        precioTotal: 100,
      }).success
    ).toBe(false)
  })
})

describe("Agregados", () => {
  test("acepta ceros (ningún valor positivo) y rechaza negativos", () => {
    expect(
      AgregadosSchema.parse({ min: 0, max: 0, mediana: 0, promedio: 0 }).min
    ).toBe(0)
    expect(AgregadosSchema.safeParse({ ...agregados(), min: -1 }).success).toBe(
      false
    )
  })

  test("exige los cuatro agregados", () => {
    expect(
      AgregadosSchema.safeParse(sinCampo(agregados(), "mediana")).success
    ).toBe(false)
  })
})

describe("Catalogo", () => {
  test("rechaza un catálogo vacío", () => {
    expect(CatalogoSchema.safeParse({ ...catalogo(), items: [] }).success).toBe(
      false
    )
  })

  test("el capítulo son 3 dígitos y el código va normalizado con puntos", () => {
    const base = catalogo()
    const conComas = {
      ...base,
      items: [{ ...base.items[0]!, codigo: "630,1,1" }],
    }
    expect(CatalogoSchema.safeParse(conComas).success).toBe(false)
    const capituloMalo = {
      ...base,
      items: [{ ...base.items[0]!, capitulo: "6" }],
    }
    expect(CatalogoSchema.safeParse(capituloMalo).success).toBe(false)
  })

  test("acepta un ítem sin capítulo constructivo ni clasificación", () => {
    const base = catalogo()
    const minimo = {
      ...base,
      items: [
        sinCampo(
          sinCampo(
            sinCampo({ ...base.items[0]! }, "capituloNumero"),
            "capituloNombre"
          ),
          "clasificacion"
        ),
      ],
    }
    expect(CatalogoSchema.safeParse(minimo).success).toBe(true)
  })
})

describe("ItemRegional", () => {
  test("valida la región embebida de cada fila", () => {
    const base = itemRegional()
    const regionMala = {
      ...base,
      regiones: [
        { ...base.regiones[0]!, region: { ...region(), codigoDane: "08" } },
      ],
    }
    expect(ItemRegionalSchema.safeParse(regionMala).success).toBe(false)
  })

  test("exige los cuatro totales por componente", () => {
    const base = itemRegional()
    const sinTransporte = {
      ...base,
      regiones: [
        {
          ...base.regiones[0]!,
          totales: sinCampo({ ...base.regiones[0]!.totales }, "transporte"),
        },
      ],
    }
    expect(ItemRegionalSchema.safeParse(sinTransporte).success).toBe(false)
  })

  test("rechaza un ítem sin ninguna provincia", () => {
    expect(
      ItemRegionalSchema.safeParse({ ...itemRegional(), regiones: [] }).success
    ).toBe(false)
  })

  test("acepta notaFuente (líneas que INVIAS dejó sin resolver)", () => {
    const conNota = {
      ...itemRegional(),
      notaFuente: "El libro fuente deja 6 líneas sin resolver.",
    }
    expect(ItemRegionalSchema.safeParse(conNota).success).toBe(true)
  })
})

describe("ProvinciaResumen", () => {
  test("acepta el caso base y expone el título recortado", () => {
    const parsed = ProvinciaResumenSchema.parse(provincia())
    expect(parsed.items[0]!.titulo).toBe("TIPO DE CONCRETO")
    expect(parsed.region.slug).toBe("antioquia-valle-de-aburra")
  })

  test("rechaza un slug con mayúsculas o tildes", () => {
    const malo = {
      ...provincia(),
      region: { ...region(), slug: "antioquia-valle-de-aburrá" },
    }
    expect(ProvinciaResumenSchema.safeParse(malo).success).toBe(false)
  })

  test("rechaza costos negativos en el listado", () => {
    const base = provincia()
    const negativo = {
      ...base,
      items: [{ ...base.items[0]!, costoDirecto: -1 }],
    }
    expect(ProvinciaResumenSchema.safeParse(negativo).success).toBe(false)
  })

  test("acepta costoDirecto 0 (el ítem no aplica en la región)", () => {
    const base = provincia()
    const cero = { ...base, items: [{ ...base.items[0]!, costoDirecto: 0 }] }
    expect(ProvinciaResumenSchema.safeParse(cero).success).toBe(true)
  })
})

describe("Stats", () => {
  test("acepta el caso base", () => {
    const parsed = StatsSchema.parse(stats())
    expect(parsed.conteos.provincias).toBe(140)
    expect(parsed.notables.provinciaMasCara.slug).toBe("choco-pacifico-norte")
  })

  test("los conteos son enteros no negativos", () => {
    const base = stats()
    expect(
      StatsSchema.safeParse({
        ...base,
        conteos: { ...base.conteos, items: 526.5 },
      }).success
    ).toBe(false)
    expect(
      StatsSchema.safeParse({
        ...base,
        conteos: { ...base.conteos, lineasSinResolver: -1 },
      }).success
    ).toBe(false)
    // Cero líneas sin resolver es perfectamente válido.
    expect(
      StatsSchema.safeParse({
        ...base,
        conteos: { ...base.conteos, lineasSinResolver: 0 },
      }).success
    ).toBe(true)
  })

  test("exige el bloque de conteos completo", () => {
    const base = stats()
    expect(
      StatsSchema.safeParse({
        ...base,
        conteos: sinCampo({ ...base.conteos }, "insumos"),
      }).success
    ).toBe(false)
  })
})
