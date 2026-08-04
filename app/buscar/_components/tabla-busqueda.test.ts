/**
 * Pruebas de los ayudantes puros del buscador.
 *
 * Solo se prueba lo que es función: `normalizar` y `coincide`. La interacción
 * (teclear → `replaceState`, Atrás, ordenar) no se prueba aquí porque el repo
 * no tiene infraestructura de DOM y montar una para esto sería una dependencia
 * nueva por un caso (no negociable 5). Queda para la comprobación manual.
 */
import { describe, expect, test } from "bun:test"
import { coincide, normalizar } from "./tabla-busqueda"

describe("normalizar", () => {
  test("pasa a minúsculas", () => {
    expect(normalizar("CONCRETO CLASE D")).toBe("concreto clase d")
  })

  test("quita las tildes", () => {
    expect(normalizar("Excavación")).toBe("excavacion")
    expect(normalizar("Demolición de pavimento rígido")).toBe(
      "demolicion de pavimento rigido"
    )
  })

  test("deja el ASCII intacto", () => {
    expect(normalizar("630.1.1")).toBe("630.1.1")
    expect(normalizar("m3 (suelto)")).toBe("m3 (suelto)")
  })

  test("es idempotente", () => {
    const una = normalizar("Señalización horizontal")
    expect(normalizar(una)).toBe(una)
  })
})

describe("coincide", () => {
  const fila = { codigo: "630.1.1", titulo: "Concreto clase D — excavación" }

  test("la consulta vacía no filtra", () => {
    expect(coincide(fila, "")).toBe(true)
    expect(coincide(fila, "   ")).toBe(true)
  })

  test("busca en el código", () => {
    expect(coincide(fila, "630.1")).toBe(true)
    expect(coincide(fila, "640")).toBe(false)
  })

  test("busca en el título sin depender de tildes ni mayúsculas", () => {
    expect(coincide(fila, "EXCAVACION")).toBe(true)
    expect(coincide(fila, "excavación")).toBe(true)
    expect(coincide(fila, "clase d")).toBe(true)
  })

  test("no coincide con lo que no está", () => {
    expect(coincide(fila, "asfalto")).toBe(false)
  })
})
