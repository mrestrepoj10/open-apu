/**
 * Pruebas de la capa de lectura contra los datos REALES de
 * `data/json/2026-1/` y `data/parquet/vigencia=2026-1/`.
 *
 * A diferencia de `lib/schema/*.test.ts` (que construye casos a mano), aquí el
 * objetivo es justo el contrario: comprobar que lo que el pipeline publicó se
 * lee, valida y cuadra. Son lecturas de solo lectura y rápidas (~1 s).
 *
 * Se prueban las funciones PURAS (`leerX`, `listarX`, `elegirDestacados`), no
 * los envoltorios `getX` de `index.ts`: esos llevan la directiva `"use cache"`
 * y llaman a `cacheLife`/`cacheTag`, que necesitan un render de Next. Ver la
 * nota de arquitectura en `index.ts`.
 */
import { describe, expect, test } from "bun:test"
import { TOLERANCIA_COP } from "@/lib/schema"
import { N_DESTACADOS, VIGENCIA_ACTUAL } from "./constantes"
import {
  elegirDestacados,
  elegirFamiliaDestacada,
  leerCatalogo,
  leerItem,
  leerProvincia,
  leerStats,
  listarCodigos,
  listarSlugs,
} from "./leer"
import { leerDesglose } from "./desglose"

const ITEM = "630.1.1"
const SLUG = "antioquia-valle-de-aburra"
const ITEMS = 526
const PROVINCIAS = 140

describe("artefactos JSON", () => {
  test("el catálogo carga, valida y trae los 526 ítems", async () => {
    const catalogo = await leerCatalogo()
    expect(catalogo.items).toHaveLength(ITEMS)
    expect(catalogo.provincias).toBe(PROVINCIAS)
    expect(catalogo.vigencia).toBe(VIGENCIA_ACTUAL)
    // No negociable 1: procedencia en todo artefacto.
    expect(catalogo.procedencia.fuente).toBe("INVIAS")
    expect(catalogo.procedencia.vigencia).toBe(VIGENCIA_ACTUAL)
  })

  test("stats carga y sus conteos concuerdan con el catálogo", async () => {
    const stats = await leerStats()
    expect(stats.conteos.items).toBe(ITEMS)
    expect(stats.conteos.provincias).toBe(PROVINCIAS)
    expect(stats.conteos.apus).toBe(ITEMS * PROVINCIAS)
  })

  test(`${ITEM} trae las ${PROVINCIAS} provincias`, async () => {
    const item = await leerItem(ITEM)
    expect(item).not.toBeNull()
    expect(item!.codigo).toBe(ITEM)
    expect(item!.regiones).toHaveLength(PROVINCIAS)
    const region = item!.regiones.find((r) => r.region.slug === SLUG)
    expect(region).toBeDefined()
    expect(region!.costoDirecto).toBeGreaterThan(0)
  })

  test("un código desconocido devuelve null", async () => {
    expect(await leerItem("999.9.9")).toBeNull()
  })

  test("un código con forma inválida devuelve null sin tocar disco", async () => {
    // Blindaje de ruta: el código llega de la URL.
    expect(await leerItem("../../etc/passwd")).toBeNull()
    expect(await leerItem("630,1,1")).toBeNull()
  })

  test("una provincia carga con sus 526 ítems", async () => {
    const provincia = await leerProvincia(SLUG)
    expect(provincia).not.toBeNull()
    expect(provincia!.region.slug).toBe(SLUG)
    expect(provincia!.region.departamento).toBe("Antioquia")
    expect(provincia!.items).toHaveLength(ITEMS)
  })

  test("un slug desconocido o inválido devuelve null", async () => {
    expect(await leerProvincia("bogota-dc")).toBeNull()
    expect(await leerProvincia("../catalogo")).toBeNull()
  })
})

describe("helpers de generateStaticParams", () => {
  test(`hay ${ITEMS} códigos, en forma de puntos y sin repetir`, async () => {
    const codigos = await listarCodigos()
    expect(codigos).toHaveLength(ITEMS)
    expect(new Set(codigos).size).toBe(ITEMS)
    expect(codigos).toContain(ITEM)
    for (const codigo of codigos) expect(codigo).toMatch(/^\d{3}(?:\.\d+)*$/)
  })

  test(`hay ${PROVINCIAS} slugs, ordenados y sin repetir`, async () => {
    const slugs = await listarSlugs()
    expect(slugs).toHaveLength(PROVINCIAS)
    expect(new Set(slugs).size).toBe(PROVINCIAS)
    expect(slugs).toContain(SLUG)
    expect(slugs).toEqual([...slugs].sort())
    // Bogotá D.C. está fuera del alcance de INVIAS (no negociable 5).
    expect(slugs.some((s) => s.startsWith("bogota"))).toBe(false)
  })

  test(`los destacados son ${N_DESTACADOS} códigos del catálogo`, async () => {
    const catalogo = await leerCatalogo()
    const destacados = elegirDestacados(catalogo)
    expect(destacados).toHaveLength(N_DESTACADOS)
    expect(new Set(destacados).size).toBe(N_DESTACADOS)
    const conocidos = new Set(catalogo.items.map((i) => i.codigo))
    for (const codigo of destacados) expect(conocidos.has(codigo)).toBe(true)
  })

  test("los destacados traen la familia 630 completa y varios capítulos", async () => {
    const catalogo = await leerCatalogo()
    const destacados = elegirDestacados(catalogo)
    const familia630 = catalogo.items
      .filter((i) => i.capitulo === "630" && i.costoDirecto.mediana > 0)
      .map((i) => i.codigo)
    for (const codigo of familia630) expect(destacados).toContain(codigo)
    // La ronda por capítulo existe para dar cobertura, no un top de precio.
    const capitulos = new Set(destacados.map((c) => c.slice(0, 1)))
    expect(capitulos.size).toBeGreaterThanOrEqual(4)
  })

  test("es determinista", async () => {
    const catalogo = await leerCatalogo()
    expect(elegirDestacados(catalogo)).toEqual(elegirDestacados(catalogo))
  })

  // El corte prerrenderizado del desglose (ver `elegirFamiliaDestacada`):
  // los 9 fijan las 9 × 140 = 1 260 páginas que se generan en build.
  test("la familia destacada son los 9 de la 630, subconjunto de los destacados", async () => {
    const catalogo = await leerCatalogo()
    const familia = elegirFamiliaDestacada(catalogo)
    expect(familia).toHaveLength(9)
    const destacados = new Set(elegirDestacados(catalogo))
    for (const codigo of familia) {
      expect(codigo.startsWith("630.")).toBe(true)
      expect(destacados.has(codigo)).toBe(true)
    }
  })
})

describe("desglose (parquet)", () => {
  test(`${ITEM} / ${SLUG}: 4 componentes que suman el costo directo`, async () => {
    const desglose = await leerDesglose(ITEM, SLUG)
    expect(desglose).not.toBeNull()
    expect(desglose!.componentes).toHaveLength(4)
    expect(desglose!.componentes.map((c) => c.componente)).toEqual([
      "equipo",
      "materiales",
      "transporte",
      "manoDeObra",
    ])

    // Los subtotales por componente cuadran con los del artefacto JSON…
    const item = await leerItem(ITEM)
    const region = item!.regiones.find((r) => r.region.slug === SLUG)!
    for (const grupo of desglose!.componentes) {
      expect(grupo.subtotal).toBeCloseTo(region.totales[grupo.componente], 2)
    }
    // …y su suma es el costo directo publicado (tolerancia de redondeo).
    expect(Math.abs(desglose!.total - region.costoDirecto)).toBeLessThan(0.011)
    expect(Math.abs(desglose!.total - region.costoDirecto)).toBeLessThan(
      TOLERANCIA_COP
    )
  })

  test("las líneas van ordenadas por orden y traen datos utilizables", async () => {
    const desglose = await leerDesglose(ITEM, SLUG)
    const lineas = desglose!.componentes.flatMap((c) => c.lineas)
    expect(lineas).toHaveLength(desglose!.lineas)
    for (const grupo of desglose!.componentes) {
      const ordenes = grupo.lineas.map((l) => l.orden)
      expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b))
    }
    for (const linea of lineas) {
      expect(linea.descripcion.length).toBeGreaterThan(0)
      expect(linea.unidad.length).toBeGreaterThan(0)
      expect(linea.subtotal).toBeGreaterThanOrEqual(0)
    }
    // Mano de obra DIVIDE (cantidad = rendimiento): FORMATO.md §3.3.
    const manoDeObra = desglose!.componentes.find(
      (c) => c.componente === "manoDeObra"
    )!
    for (const linea of manoDeObra.lineas) {
      expect(linea.subtotal).toBeCloseTo(
        linea.precioUnitario / linea.cantidad,
        1
      )
    }
  })

  test("un par inexistente o inválido devuelve null", async () => {
    expect(await leerDesglose("999.9.9", SLUG)).toBeNull()
    expect(await leerDesglose(ITEM, "provincia-que-no-existe")).toBeNull()
    expect(await leerDesglose("../../x", SLUG)).toBeNull()
  })

  // NO CORRE EN CI (`test.skipIf(CI)`), a propósito.
  //
  // Vigila que `codigo` siga PODANDO grupos de fila: podando, la consulta lee
  // 85 KB de un solo grupo (~70 ms); sin podar, escanea los 76 y lee 2 388 KB
  // (~2 700 ms). El problema es que solo sabe medirlo con el reloj de pared, y
  // el reloj de pared mide la máquina: los ~6 ms del macOS arm64 donde se
  // diseñó son 40-80 ms en un contenedor Linux y 196 ms en el runner
  // compartido de CI, dominados por la E/S. Con un presupuesto de 50 ms tumbó
  // CI el 2026-08-04 sin que nada hubiera cambiado.
  //
  // En el runner no aporta —ahí solo mide con cuánta carga esté la máquina
  // ajena— así que se queda como herramienta local, donde el hardware es
  // estable y la señal sí vale. Si algún día importa vigilarlo en CI, hay que
  // medir BYTES leídos (85 KB contra 2 388 KB), que no dependen del hardware.
  const CI = !!process.env.CI
  test.skipIf(CI)("una consulta puntual en caliente no escanea el archivo", async () => {
    await leerDesglose(ITEM, SLUG) // calienta metadatos y caché de rangos
    const intentos: number[] = []
    for (let i = 0; i < 3; i++) {
      const inicio = performance.now()
      await leerDesglose("201.10", SLUG) // código hostil al orden lexicográfico
      intentos.push(performance.now() - inicio)
    }
    expect(Math.min(...intentos)).toBeLessThan(500)
  })
})
