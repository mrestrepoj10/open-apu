/**
 * Región = departamento × provincia (dirección territorial INVIAS).
 *
 * INVIAS publica un archivo por región, nombrado
 * `APU_<codigo>_<DEPARTAMENTO>__<PROVINCIA>_<vigencia>.xlsx`, donde `<codigo>`
 * son 4 dígitos, p. ej. `0509` → Antioquia / Valle de Aburrá.
 */
import { z } from "zod"
import { TextoSchema } from "./comun"

/**
 * Códigos DANE de departamento.
 *
 * SUPUESTO DOCUMENTADO: los dos primeros dígitos del código de 4 dígitos que
 * INVIAS usa en el nombre de archivo son el código DANE del departamento, y
 * los dos últimos son un consecutivo de provincia dentro del departamento
 * ("00" cuando el departamento no se subdivide, p. ej. `1800` Caquetá).
 * Se verificó contra los 140 archivos de la vigencia 2026-1: los 32 prefijos
 * presentes son exactamente códigos DANE de departamento válidos.
 *
 * Bogotá D.C. (11) aparece en el mapa por completitud del listado DANE, pero
 * está FUERA del alcance de INVIAS: no existe archivo `11xx`. La referencia de
 * precios para Bogotá es el IDU (ver AGENTS.md, no negociable 5).
 */
export const DEPARTAMENTOS_DANE: Readonly<Record<string, string>> =
  Object.freeze({
    "05": "Antioquia",
    "08": "Atlántico",
    "11": "Bogotá D.C.",
    "13": "Bolívar",
    "15": "Boyacá",
    "17": "Caldas",
    "18": "Caquetá",
    "19": "Cauca",
    "20": "Cesar",
    "23": "Córdoba",
    "25": "Cundinamarca",
    "27": "Chocó",
    "41": "Huila",
    "44": "La Guajira",
    "47": "Magdalena",
    "50": "Meta",
    "52": "Nariño",
    "54": "Norte de Santander",
    "63": "Quindío",
    "66": "Risaralda",
    "68": "Santander",
    "70": "Sucre",
    "73": "Tolima",
    "76": "Valle del Cauca",
    "81": "Arauca",
    "85": "Casanare",
    "86": "Putumayo",
    "88": "Archipiélago de San Andrés, Providencia y Santa Catalina",
    "91": "Amazonas",
    "94": "Guainía",
    "95": "Guaviare",
    "97": "Vaupés",
    "99": "Vichada",
  })

/** Código de región INVIAS: 4 dígitos, p. ej. "0509". */
export const CodigoRegionSchema = z
  .string()
  .regex(/^\d{4}$/, 'Código de región inválido: 4 dígitos, p. ej. "0509"')

/** Código DANE de departamento: 2 dígitos de la lista oficial. */
export const CodigoDaneSchema = z
  .string()
  .regex(/^\d{2}$/, "Código DANE inválido: 2 dígitos")
  .refine((c) => c in DEPARTAMENTOS_DANE, {
    message: "Código DANE de departamento desconocido",
  })

/** Slug apto para URL: minúsculas, sin tildes, separado por guiones. */
export const SlugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug inválido: minúsculas, dígitos y guiones, p. ej. "antioquia-valle-de-aburra"'
  )

export const RegionSchema = z
  .strictObject({
    /** Código INVIAS de 4 dígitos tomado del nombre del archivo, p. ej. "0509". */
    codigo: CodigoRegionSchema,
    /** Código DANE del departamento: los 2 primeros dígitos de `codigo`. */
    codigoDane: CodigoDaneSchema,
    /** Nombre del departamento tal como se muestra, p. ej. "Antioquia". */
    departamento: TextoSchema,
    /** Provincia / dirección territorial INVIAS, p. ej. "Valle de Aburrá". */
    provincia: TextoSchema,
    /** Identificador de URL, p. ej. "antioquia-valle-de-aburra". */
    slug: SlugSchema,
  })
  .refine((r) => r.codigoDane === r.codigo.slice(0, 2), {
    message:
      "codigoDane debe ser los dos primeros dígitos de codigo (prefijo DANE)",
    path: ["codigoDane"],
  })

export type Region = z.infer<typeof RegionSchema>

/** Extrae el código DANE de departamento de un código de región INVIAS. */
export function codigoDaneDeRegion(codigoRegion: string): string {
  return codigoRegion.slice(0, 2)
}

/** Nombre DANE del departamento, o `undefined` si el código no existe. */
export function nombreDepartamentoDane(codigoDane: string): string | undefined {
  return DEPARTAMENTOS_DANE[codigoDane]
}

/**
 * Construye un slug apto para URL a partir de partes de texto en español.
 * Quita tildes/diacríticos y colapsa todo lo que no sea `[a-z0-9]` en guiones.
 *
 * `slugRegion("Antioquia", "Valle de Aburrá")` → `"antioquia-valle-de-aburra"`
 */
export function slugRegion(...partes: string[]): string {
  return partes
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
