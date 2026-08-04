/**
 * Pruebas de los formateadores compartidos.
 *
 * El caso que importa es el umbral de centavos de `formatearCOP`: por encima
 * de 100 COP se redondea a peso entero y por debajo se muestran centavos, para
 * que los ítems de transporte en kg-km (650.3, 650.5, 650.9, con costos de 1 a
 * 15 pesos) no salgan todos con la misma cifra redondeada.
 *
 * `Intl` mete espacios duros y de no separación en la salida (`"$ 1.034.000"`
 * lleva U+00A0); se normalizan antes de comparar para que las expectativas se
 * puedan leer y escribir con un espacio normal.
 */
import { describe, expect, test } from "bun:test"
import {
  formatearCOP,
  formatearFecha,
  formatearNumero,
  formatearPorcentaje,
} from "./format"

/** Espacios duros / finos de `Intl` → espacio normal. */
const normalizar = (texto: string) => texto.replace(/[  ]/g, " ")

const cop = (valor: number) => normalizar(formatearCOP(valor))

describe("formatearCOP", () => {
  test("redondea a pesos enteros desde 100 COP", () => {
    expect(cop(1_034_000)).toBe("$ 1.034.000")
    expect(cop(1234.56)).toBe("$ 1.235")
    expect(cop(100)).toBe("$ 100")
    expect(cop(100.4)).toBe("$ 100")
  })

  test("muestra centavos por debajo de 100 COP", () => {
    expect(cop(99.99)).toBe("$ 99,99")
    expect(cop(14.49)).toBe("$ 14,49")
    expect(cop(1.21)).toBe("$ 1,21")
    expect(cop(0.5)).toBe("$ 0,50")
  })

  test("el cero se deja entero: no es un precio sino 'no aplica'", () => {
    expect(cop(0)).toBe("$ 0")
  })

  test("el umbral se mide en valor absoluto (descuadres negativos)", () => {
    expect(cop(-1234)).toBe("-$ 1.234")
    expect(cop(-14.49)).toBe("-$ 14,49")
  })
})

describe("otros formateadores", () => {
  test("formatearNumero usa separadores es-CO", () => {
    expect(normalizar(formatearNumero(1234.5))).toBe("1.234,5")
    expect(normalizar(formatearNumero(1234.5, 2))).toBe("1.234,50")
  })

  test("formatearPorcentaje parte de una fracción", () => {
    expect(normalizar(formatearPorcentaje(0.062))).toBe("6,2 %")
  })

  test("formatearFecha interpreta la fecha ISO en UTC", () => {
    expect(formatearFecha("2026-01-15")).toBe("15 de enero de 2026")
    // Una cadena que no es fecha se devuelve tal cual.
    expect(formatearFecha("sin fecha")).toBe("sin fecha")
  })
})
