/**
 * Rótulos de los cuatro componentes del desglose, con la forma del formato
 * FR-APU-1 (I. Equipo, II. Materiales, III. Transporte, IV. Mano de obra).
 *
 * Módulo puro, sin `"use client"`: lo importan la página del desglose (Server
 * Component, para la banda de totales) y la tabla (isla cliente). Si viviera
 * en el módulo de la tabla, todos sus exports serían referencias de cliente y
 * el servidor no podría leer `CONFIG`.
 *
 * ## El significado de `cantidad` cambia por componente
 *
 * `ApuLinea.cantidad` es un solo campo con cuatro lecturas (ver `lib/schema/
 * apu.ts`), así que el encabezado de esa columna se rotula por componente en
 * vez de poner un genérico "Cantidad" que sería falso en tres de los cuatro
 * casos:
 *
 * - `equipo`: horas de uso por unidad de obra ⇒ "Rendimiento (h)".
 * - `materiales`: cantidad de insumo por unidad de obra ⇒ "Cantidad".
 * - `transporte`: cantidad transportada, que se multiplica por la distancia
 *   ⇒ "Cantidad" + columna "Distancia (km)".
 * - `manoDeObra`: unidades de obra por jornal ⇒ "Rendimiento". Aquí el
 *   subtotal DIVIDE (jornal de la cuadrilla ÷ rendimiento), lo cual se explica
 *   bajo la tabla: un lector que multiplique no llegará al subtotal.
 */
import type { Componente } from "@/lib/schema"

export type Config = {
  /** Rótulo de la sección, en el orden del FR-APU-1. */
  titulo: string
  /** Encabezado de la primera columna. */
  insumo: string
  /** Encabezado de la columna de cantidad / rendimiento. */
  cantidad: string
  /** Encabezado de la columna de precio unitario. */
  precio: string
  /** El componente lleva columna de distancia (solo transporte). */
  distancia?: true
  /** Aclaración bajo la tabla, cuando el cálculo no es evidente. */
  nota?: string
}

export const CONFIG: Record<Componente, Config> = {
  equipo: {
    titulo: "I. Equipo",
    insumo: "Equipo",
    cantidad: "Rendimiento (h)",
    precio: "Tarifa",
  },
  materiales: {
    titulo: "II. Materiales",
    insumo: "Material",
    cantidad: "Cantidad",
    precio: "Precio unitario",
  },
  transporte: {
    titulo: "III. Transporte",
    insumo: "Transporte",
    cantidad: "Cantidad",
    precio: "Tarifa",
    distancia: true,
    nota: "Subtotal = cantidad × distancia × tarifa.",
  },
  manoDeObra: {
    titulo: "IV. Mano de obra",
    insumo: "Cuadrilla",
    cantidad: "Rendimiento",
    precio: "Jornal total",
    nota:
      "El rendimiento son unidades de obra por jornal, así que aquí el " +
      "subtotal divide: jornal total de la cuadrilla ÷ rendimiento. El jornal " +
      "total ya incluye el factor prestacional.",
  },
}
