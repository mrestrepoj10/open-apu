/**
 * Pruebas de la aritmética del AIU.
 *
 * Todo lo que se prueba aquí es puro: la isla cliente
 * (`components/aiu/calculadora.tsx`) no se prueba porque el repo no tiene
 * infraestructura de DOM y montarla sería una dependencia nueva por un caso
 * (no negociable 5), misma razón que en `busqueda.test.ts`. Toda la lógica
 * vive en este módulo justamente para que la parte no probable sea marcado.
 */
import { describe, expect, test } from "bun:test"

import {
  AIU_CERO,
  AIU_MAXIMO,
  IVA_GENERAL,
  barridoAiu,
  calcularAiu,
  escribirAiu,
  esAiuCero,
  leerAiu,
  leerBaseIva,
  normalizarPorcentaje,
  porcentajeTotal,
} from "./aiu"

/** Costo directo de referencia para los casos: redondo, para leer las cuentas. */
const BASE = 1_000_000

describe("calcularAiu", () => {
  test("sin AIU devuelve el costo directo intacto", () => {
    const detalle = calcularAiu(BASE, AIU_CERO)
    expect(detalle.totalAiu).toBe(0)
    expect(detalle.subtotal).toBe(BASE)
    expect(detalle.total).toBe(BASE)
    expect(detalle.fraccionAiu).toBe(0)
  })

  test("cada componente se calcula sobre el costo directo, no en cascada", () => {
    const detalle = calcularAiu(BASE, {
      administracion: 15,
      imprevistos: 3,
      utilidad: 5,
    })

    expect(detalle.administracion).toBe(150_000)
    // En cascada, los imprevistos serían 3 % de 1.150.000 = 34.500.
    expect(detalle.imprevistos).toBe(30_000)
    expect(detalle.utilidad).toBe(50_000)
    expect(detalle.totalAiu).toBe(230_000)
    expect(detalle.subtotal).toBe(1_230_000)
    expect(detalle.fraccionAiu).toBeCloseTo(0.23, 10)
  })

  test("sin IVA por defecto", () => {
    const detalle = calcularAiu(BASE, { ...AIU_CERO, utilidad: 5 })
    expect(detalle.iva).toBe(0)
    expect(detalle.total).toBe(detalle.subtotal)
  })

  test("el IVA recae sobre la utilidad, no sobre el total", () => {
    const detalle = calcularAiu(
      BASE,
      { administracion: 15, imprevistos: 3, utilidad: 5 },
      { baseIva: "utilidad" }
    )

    // 19 % de 50.000 (la utilidad), no de 1.230.000.
    expect(detalle.iva).toBe(50_000 * IVA_GENERAL)
    expect(detalle.iva).toBeCloseTo(9_500, 10)
    expect(detalle.total).toBeCloseTo(1_239_500, 10)
  })

  test("acepta una tarifa de IVA distinta de la general", () => {
    const detalle = calcularAiu(
      BASE,
      { ...AIU_CERO, utilidad: 10 },
      { baseIva: "utilidad", tarifaIva: 0.05 }
    )
    expect(detalle.iva).toBeCloseTo(5_000, 10)
  })

  test("un costo directo de 0 no produce NaN", () => {
    // El ítem no aplica en la región (FORMATO.md §6.5): la fracción sería 0/0.
    const detalle = calcularAiu(0, {
      administracion: 15,
      imprevistos: 3,
      utilidad: 5,
    })
    expect(detalle.fraccionAiu).toBe(0)
    expect(detalle.total).toBe(0)
    expect(Number.isNaN(detalle.total)).toBe(false)
  })

  test("conserva los decimales del costo directo publicado", () => {
    // Los precios de la fuente traen decimales largos y el esquema no redondea.
    const detalle = calcularAiu(709_617.1028062504, {
      ...AIU_CERO,
      utilidad: 10,
    })
    expect(detalle.utilidad).toBeCloseTo(70_961.71028062504, 8)
  })
})

describe("porcentajeTotal / esAiuCero", () => {
  test("suma los tres componentes", () => {
    expect(
      porcentajeTotal({ administracion: 15, imprevistos: 3, utilidad: 5 })
    ).toBe(23)
  })

  test("reconoce el cero", () => {
    expect(esAiuCero(AIU_CERO)).toBe(true)
    expect(esAiuCero({ ...AIU_CERO, imprevistos: 0.5 })).toBe(false)
  })
})

describe("normalizarPorcentaje", () => {
  test("deja pasar un porcentaje razonable", () => {
    expect(normalizarPorcentaje(15)).toBe(15)
    expect(normalizarPorcentaje("7.5")).toBe(7.5)
  })

  test("recorta al máximo", () => {
    expect(normalizarPorcentaje(999_999)).toBe(AIU_MAXIMO)
  })

  test("cualquier basura da cero en vez de lanzar", () => {
    // La entrada es una URL que puede escribir cualquiera.
    expect(normalizarPorcentaje("perro")).toBe(0)
    expect(normalizarPorcentaje(undefined)).toBe(0)
    expect(normalizarPorcentaje(null)).toBe(0)
    expect(normalizarPorcentaje(-5)).toBe(0)
    expect(normalizarPorcentaje(Number.NaN)).toBe(0)
    // Infinito no es «un porcentaje enorme» sino entrada rota: cae en el cero,
    // no en el tope.
    expect(normalizarPorcentaje(Number.POSITIVE_INFINITY)).toBe(0)
  })

  test("el tope se aplica a un número grande pero finito", () => {
    expect(normalizarPorcentaje(1e9)).toBe(AIU_MAXIMO)
  })
})

describe("leerAiu", () => {
  test("lee los tres parámetros", () => {
    const params = new URLSearchParams("a=15&i=3&u=5")
    expect(leerAiu(params)).toEqual({
      administracion: 15,
      imprevistos: 3,
      utilidad: 5,
    })
  })

  test("una URL sin parámetros da AIU cero", () => {
    expect(leerAiu(new URLSearchParams(""))).toEqual(AIU_CERO)
  })

  test("un parámetro inválido no rompe los demás", () => {
    const params = new URLSearchParams("a=perro&u=5")
    expect(leerAiu(params)).toEqual({
      administracion: 0,
      imprevistos: 0,
      utilidad: 5,
    })
  })

  test("el IVA solo se activa con ?iva=1", () => {
    expect(leerBaseIva(new URLSearchParams("iva=1"))).toBe("utilidad")
    expect(leerBaseIva(new URLSearchParams("iva=0"))).toBe("ninguna")
    expect(leerBaseIva(new URLSearchParams(""))).toBe("ninguna")
  })
})

describe("escribirAiu", () => {
  test("escribe solo lo que no es cero", () => {
    const params = escribirAiu(new URLSearchParams(), {
      administracion: 15,
      imprevistos: 0,
      utilidad: 5,
    })
    expect(params.toString()).toBe("a=15&u=5")
  })

  test("borra las claves que vuelven a cero en vez de dejar ?a=0", () => {
    const params = new URLSearchParams("a=15&i=3&u=5&iva=1")
    escribirAiu(params, AIU_CERO)
    expect(params.toString()).toBe("")
  })

  test("conserva los parámetros ajenos", () => {
    const params = new URLSearchParams("q=concreto")
    escribirAiu(params, { ...AIU_CERO, utilidad: 5 })
    expect(params.get("q")).toBe("concreto")
  })

  test("el IVA no se escribe sin utilidad sobre la que liquidarlo", () => {
    const params = escribirAiu(
      new URLSearchParams(),
      { administracion: 15, imprevistos: 0, utilidad: 0 },
      "utilidad"
    )
    expect(params.get("iva")).toBeNull()
  })

  test("ida y vuelta", () => {
    const original = { administracion: 12.5, imprevistos: 2, utilidad: 5 }
    const params = escribirAiu(new URLSearchParams(), original, "utilidad")
    expect(leerAiu(params)).toEqual(original)
    expect(leerBaseIva(params)).toBe("utilidad")
  })
})

describe("barridoAiu", () => {
  test("arranca en el costo directo exacto", () => {
    const puntos = barridoAiu(BASE)
    expect(puntos[0]).toEqual({ porcentaje: 0, total: BASE })
  })

  test("llega al tope pedido y es una recta", () => {
    const puntos = barridoAiu(BASE, { hasta: 40, paso: 10 })
    expect(puntos.map((p) => p.porcentaje)).toEqual([0, 10, 20, 30, 40])
    expect(puntos.map((p) => p.total)).toEqual([
      1_000_000, 1_100_000, 1_200_000, 1_300_000, 1_400_000,
    ])
  })

  test("coincide con calcularAiu en cada punto", () => {
    for (const punto of barridoAiu(BASE, { hasta: 30, paso: 5 })) {
      const detalle = calcularAiu(BASE, {
        ...AIU_CERO,
        administracion: punto.porcentaje,
      })
      expect(punto.total).toBeCloseTo(detalle.subtotal, 8)
    }
  })
})
