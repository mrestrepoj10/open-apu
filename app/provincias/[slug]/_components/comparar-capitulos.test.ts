/**
 * Pruebas de la comparación por capítulo del hub de provincia.
 *
 * Los casos se arman con literales (no dependen de que el pipeline haya
 * corrido), igual que en `lib/schema/artefactos.test.ts`. Lo que se vigila:
 * que un 0 nunca entre en una mediana y que la mediana nacional se calcule
 * sobre los mismos ítems que la provincia sí cotiza.
 *
 * Incluye también `puesto()`, el helper de ranking de la franja: es puro y no
 * toca el DOM, así que se prueba aquí y no hace falta un entorno de navegador.
 */
import { describe, expect, test } from "bun:test"

import { puesto, type PuntoFranja } from "@/components/charts/franja-provincias"
import { NOTA_COSTO_DIRECTO, SCHEMA_VERSION } from "@/lib/schema"
import type { Catalogo, CatalogoItem, ProvinciaItem } from "@/lib/schema"

import { compararCapitulos } from "./comparar-capitulos"

/**
 * La cabecera se anota: sin tipo de destino, `schemaVersion` se ensancharía a
 * `string` y dejaría de encajar en el literal del esquema.
 */
const cabecera = (): Pick<
  Catalogo,
  "schemaVersion" | "vigencia" | "procedencia" | "generadoPor" | "nota"
> => ({
  schemaVersion: SCHEMA_VERSION,
  vigencia: "2026-1",
  procedencia: {
    fuente: "INVIAS",
    url: "https://www.invias.gov.co/publicaciones/4149/",
    vigencia: "2026-1",
    fechaDescarga: "2026-08-03",
    licencia: "Dato público INVIAS; costo directo sin AIU.",
  },
  generadoPor: "scripts/pipeline.ts",
  nota: NOTA_COSTO_DIRECTO,
})

/** Fila de catálogo mínima: solo importan capítulo, código y la mediana. */
function itemCatalogo(
  codigo: string,
  capitulo: string,
  medianaNacional: number,
  capituloInvias?: { numero: number; nombre: string }
): CatalogoItem {
  return {
    codigo,
    descripcion: `Ítem ${codigo}`,
    unidad: "m3",
    capitulo,
    ...(capituloInvias
      ? {
          capituloNumero: capituloInvias.numero,
          capituloNombre: capituloInvias.nombre,
        }
      : {}),
    costoDirecto: {
      min: medianaNacional,
      max: medianaNacional,
      mediana: medianaNacional,
      promedio: medianaNacional,
    },
    provinciasConDato: 140,
  }
}

function itemProvincia(
  codigo: string,
  capitulo: string,
  costoDirecto: number
): ProvinciaItem {
  return {
    codigo,
    titulo: `Ítem ${codigo}`,
    unidad: "m3",
    capitulo,
    costoDirecto,
  }
}

const estructuras = { numero: 6, nombre: "Estructuras y drenajes" }
const explanaciones = { numero: 2, nombre: "Explanaciones" }

const catalogo = (): Catalogo => ({
  ...cabecera(),
  provincias: 140,
  items: [
    // Capítulo 6: tres ítems, el más caro no aplica en la provincia de prueba.
    itemCatalogo("630.1.1", "630", 100, estructuras),
    itemCatalogo("630.1.2", "630", 200, estructuras),
    itemCatalogo("630.1.3", "630", 900, estructuras),
    // Capítulo 2: ninguno aplica en la provincia de prueba.
    itemCatalogo("201.1", "201", 50, explanaciones),
    itemCatalogo("201.2", "201", 70, explanaciones),
    // Sin capítulo constructivo: el nombre sale del primer dígito del código.
    itemCatalogo("700.1", "700", 400),
  ],
})

/**
 * Provincia de prueba. El orden de entrada (6, 8, 2, 7) es deliberado: la
 * salida debe salir ordenada por número de capítulo.
 */
const items = (): ProvinciaItem[] => [
  itemProvincia("630.1.1", "630", 150),
  itemProvincia("630.1.2", "630", 250),
  itemProvincia("630.1.3", "630", 0), // no aplica aquí
  itemProvincia("800.1", "800", 300), // capítulo ausente del catálogo
  itemProvincia("201.1", "201", 0), // no aplica aquí
  itemProvincia("201.2", "201", 0), // no aplica aquí
  itemProvincia("700.1", "700", 500),
]

const porNumero = (numero: number) =>
  compararCapitulos(items(), catalogo()).find((c) => c.numero === numero)

describe("compararCapitulos", () => {
  test("excluye los ceros de la mediana provincial", () => {
    const capitulo = porNumero(6)
    // Mediana de 150 y 250 — el 0 de 630.1.3 no promedia ni arrastra a la baja.
    expect(capitulo?.medianaProvincia).toBe(200)
    expect(capitulo?.conDato).toBe(2)
    expect(capitulo?.total).toBe(3)
  })

  test("la mediana nacional se restringe a los ítems que aplican aquí", () => {
    const capitulo = porNumero(6)
    // Solo 630.1.1 (100) y 630.1.2 (200): sin restringir saldría 200, la
    // mediana de 100/200/900, y la provincia parecería estar en la media.
    expect(capitulo?.medianaNacional).toBe(150)
  })

  test("un capítulo sin ningún ítem aplicable no inventa un precio", () => {
    const capitulo = porNumero(2)
    expect(capitulo?.medianaProvincia).toBe(0)
    expect(capitulo?.conDato).toBe(0)
    expect(capitulo?.total).toBe(2)
    // Sin códigos con dato no hay con qué restringir: cae al capítulo entero,
    // mediana de 50 y 70.
    expect(capitulo?.medianaNacional).toBe(60)
  })

  test("nombra el capítulo por el primer dígito cuando el catálogo no lo trae", () => {
    expect(porNumero(7)).toMatchObject({
      numero: 7,
      nombre: "Capítulo 7",
      medianaProvincia: 500,
      medianaNacional: 400,
    })
  })

  test("un capítulo ausente del catálogo también recibe nombre de reserva", () => {
    expect(porNumero(8)).toMatchObject({
      numero: 8,
      nombre: "Capítulo 8",
      medianaProvincia: 300,
      medianaNacional: 0,
      conDato: 1,
      total: 1,
    })
  })

  test("la salida va ordenada por número de capítulo", () => {
    const numeros = compararCapitulos(items(), catalogo()).map((c) => c.numero)
    expect(numeros).toEqual([2, 6, 7, 8])
  })

  test("sin ítems no hay capítulos", () => {
    expect(compararCapitulos([], catalogo())).toEqual([])
  })
})

const punto = (slug: string, mediana: number): PuntoFranja => ({
  slug,
  provincia: slug,
  departamento: "Antioquia",
  mediana,
})

describe("puesto", () => {
  const puntos = [
    punto("cara", 300),
    punto("barata", 100),
    punto("media", 200),
    punto("sin-dato", 0),
  ]

  test("puesto 1 para la más barata", () => {
    expect(puesto(puntos, "barata")).toEqual({ puesto: 1, total: 3 })
  })

  test("último puesto para la más cara", () => {
    expect(puesto(puntos, "cara")).toEqual({ puesto: 3, total: 3 })
  })

  test("las provincias sin mediana no cuentan ni puntúan", () => {
    // Un 0 no es "la más barata": es ausencia de dato.
    expect(puesto(puntos, "sin-dato")).toBeNull()
    expect(puesto(puntos, "media")).toEqual({ puesto: 2, total: 3 })
  })

  test("null cuando el slug no está en la lista", () => {
    expect(puesto(puntos, "inexistente")).toBeNull()
  })

  test("no muta la lista recibida", () => {
    const original = [...puntos]
    puesto(puntos, "media")
    expect(puntos).toEqual(original)
  })
})
